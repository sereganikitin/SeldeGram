import { IsOptional, IsString, Length } from 'class-validator';

export class RegisterTokenDto {
  @IsString()
  @Length(10, 200)
  token!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  deviceName?: string;
}
