import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Length } from 'class-validator';

export class CreatePollDto {
  @IsString()
  @Length(1, 300)
  question!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  options!: string[];
}
