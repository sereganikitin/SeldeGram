import { IsUUID } from 'class-validator';

export class SummarizeDto {
  @IsUUID()
  chatId!: string;
}
