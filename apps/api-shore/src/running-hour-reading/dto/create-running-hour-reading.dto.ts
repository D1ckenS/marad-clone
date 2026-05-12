import { RunningHourSource } from '@prisma/client';
import { IsDateString, IsEnum, IsString } from 'class-validator';

export class CreateRunningHourReadingDto {
  @IsString()
  componentId!: string;

  /** Decimal string. Must be ≥ the component's current running_hours (enforced at service layer). */
  @IsString()
  value!: string;

  @IsEnum(RunningHourSource)
  source!: RunningHourSource;

  @IsDateString()
  recordedAt!: string;
}
