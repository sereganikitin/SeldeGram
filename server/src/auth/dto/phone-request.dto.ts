import { IsString, Matches } from 'class-validator';

export class PhoneRequestDto {
  // E.164: + и 8-15 цифр
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'Phone must be in E.164 format (+...)' })
  phone!: string;
}
