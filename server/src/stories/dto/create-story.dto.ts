import { IsString } from 'class-validator';

export class CreateStoryDto {
  @IsString()
  mediaKey!: string;

  @IsString()
  mediaType!: string;
}
