import { IsString, Length, Matches } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  @Length(1, 100)
  title!: string;

  @IsString()
  @Length(3, 32)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'slug may only contain letters, digits and underscore' })
  slug!: string;
}
