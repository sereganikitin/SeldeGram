import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class TranslateDto {
  @IsUUID()
  messageId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lang?: string;
}
