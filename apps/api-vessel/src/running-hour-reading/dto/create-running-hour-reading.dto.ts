import { IsDateString, IsIn, IsString } from 'class-validator';
import { RUNNING_HOUR_SOURCES, type RunningHourSource } from '../../db/schema';

export class CreateRunningHourReadingDto {
  @IsString()
  componentId!: string;

  @IsString()
  value!: string;

  @IsIn(RUNNING_HOUR_SOURCES)
  source!: RunningHourSource;

  @IsDateString()
  recordedAt!: string;
}
