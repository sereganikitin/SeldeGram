import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class InitiateCallDto {
  @IsUUID()
  calleeId!: string;

  @IsOptional()
  @IsString()
  @IsIn(['audio', 'video'])
  kind?: 'audio' | 'video';
}
