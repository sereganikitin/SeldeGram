import { IsString, Length } from 'class-validator';

export class AddStickerDto {
  @IsString()
  mediaKey!: string;

  @IsString()
  @Length(1, 8)
  emoji!: string;
}
