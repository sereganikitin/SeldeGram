import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreatePackDto {
  @IsString()
  @Length(1, 64)
  name!: string;

  @IsString()
  @Length(3, 32)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'slug may only contain letters, digits and underscore' })
  slug!: string;

  @IsOptional()
  @IsString()
  coverKey?: string;
}
