import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Length } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @Length(1, 100)
  title!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  memberUsernames!: string[];
}
