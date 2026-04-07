import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, CreateBucketCommand, HeadBucketCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

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

    // Внутренний клиент — для управления bucket'ом и upload-операций (бэкенд → MinIO напрямую)
    this.internalClient = new S3Client({
      endpoint: config.get<string>('S3_ENDPOINT', 'http://localhost:9000'),
      region,
      credentials,
      forcePathStyle: true,
    });

    // Публичный клиент — генерирует URL'ы под публичный домен (https://media.infoseledka.ru)
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
}
