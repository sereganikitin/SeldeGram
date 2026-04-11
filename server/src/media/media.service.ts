import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private readonly internalClient: S3Client;
  private readonly publicClient: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET', 'seldegram-media');
    const region = config.get<string>('S3_REGION', 'us-east-1');
    const credentials = {
      accessKeyId: config.get<string>('S3_ACCESS_KEY', 'seldegram'),
      secretAccessKey: config.get<string>('S3_SECRET_KEY', 'seldegram_dev_password'),
    };

    this.internalClient = new S3Client({
      endpoint: config.get<string>('S3_ENDPOINT', 'http://localhost:9000'),
      region,
      credentials,
      forcePathStyle: true,
    });

    this.publicClient = new S3Client({
      endpoint: config.get<string>('S3_PUBLIC_ENDPOINT', 'http://localhost:9000'),
      region,
      credentials,
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    try {
      await this.internalClient.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`S3 bucket '${this.bucket}' exists`);
    } catch {
      this.logger.log(`Creating S3 bucket '${this.bucket}'`);
      await this.internalClient.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  validateUpload(size: number, contentType: string) {
    if (size <= 0 || size > MAX_SIZE) {
      throw new Error(`Invalid size (max ${MAX_SIZE} bytes)`);
    }
    if (!contentType || contentType.length > 100) {
      throw new Error('Invalid content type');
    }
  }

  async createUploadUrl(userId: string, contentType: string, size: number) {
    this.validateUpload(size, contentType);
    const ext = contentType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'bin';
    const key = `u/${userId}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;

    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    });
    const uploadUrl = await getSignedUrl(this.publicClient, cmd, { expiresIn: 600 });
    return { uploadUrl, key };
  }

  async createDownloadUrl(key: string) {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.publicClient, cmd, { expiresIn: 3600 });
  }

  async downloadToFile(key: string, filePath: string): Promise<void> {
    const resp = await this.internalClient.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const chunks: Buffer[] = [];
    const stream = resp.Body as NodeJS.ReadableStream;
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    await fs.writeFile(filePath, Buffer.concat(chunks));
  }

  async uploadFile(filePath: string, key: string, contentType: string): Promise<void> {
    const body = await fs.readFile(filePath);
    await this.internalClient.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.internalClient.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /**
   * Конвертирует WebM-стикер в MP4 (h264) для совместимости с iOS AVPlayer.
   * Возвращает новый ключ MP4 файла. Старый WebM удаляется.
   */
  async convertWebmStickerToMp4(userId: string, webmKey: string): Promise<string> {
    const tmpId = crypto.randomBytes(8).toString('hex');
    const tmpDir = os.tmpdir();
    const webmPath = path.join(tmpDir, `${tmpId}.webm`);
    const mp4Path = path.join(tmpDir, `${tmpId}.mp4`);
    const newKey = `u/${userId}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.mp4`;

    try {
      await this.downloadToFile(webmKey, webmPath);
      await this.runFfmpeg([
        '-y',
        '-i', webmPath,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-an', // без аудио
        '-movflags', '+faststart',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // h264 требует чётные размеры
        mp4Path,
      ]);
      await this.uploadFile(mp4Path, newKey, 'video/mp4');
      // Удаляем оригинал webm из MinIO
      await this.deleteObject(webmKey).catch((e) =>
        this.logger.warn(`Failed to delete original webm: ${(e as Error).message}`),
      );
      return newKey;
    } finally {
      await fs.unlink(webmPath).catch(() => undefined);
      await fs.unlink(mp4Path).catch(() => undefined);
    }
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args);
      let stderr = '';
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      proc.on('error', (err) => reject(err));
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      });
    });
  }
}
