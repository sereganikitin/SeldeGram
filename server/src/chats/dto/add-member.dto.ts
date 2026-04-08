import { IsString, Length } from 'class-validator';

export class AddMemberDto {
  @IsString()
  @Length(3, 32)
  username!: string;
}
