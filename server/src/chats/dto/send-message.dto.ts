import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @Length(0, 4000)
  content?: string;

  @IsOptional()
  @IsString()
  mediaKey?: string;

  @IsOptional()
  @IsString()
  mediaType?: string;

  @IsOptional()
  @IsString()
  mediaName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50 * 1024 * 1024)
  mediaSize?: number;
}
