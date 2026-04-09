import { IsOptional, IsString, Length } from 'class-validator';

export class AddStickerDto {
  @IsString()
  mediaKey!: string;

  @IsOptional()
  @IsString()
  mediaType?: string;

  @IsString()
  @Length(1, 8)
  emoji!: string;
}
