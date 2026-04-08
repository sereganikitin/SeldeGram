import { IsString, Length } from 'class-validator';

export class UpdateChatDto {
  @IsString()
  @Length(1, 100)
  title!: string;
}
