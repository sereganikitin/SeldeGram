import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class PhoneVerifyDto {
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone!: string;

  @IsString()
  @Length(4, 8)
  code!: string;

  // Если нового юзера регистрируем — нужны username и displayName.
  // Для существующего этих полей нет, сервер просто залогинит.
  @IsOptional()
  @IsString()
  @Length(3, 30)
  username?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  displayName?: string;
}
