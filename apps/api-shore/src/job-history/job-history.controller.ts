/// <reference types="multer" />
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SignOffJobInstanceDto } from './dto/sign-off-job-instance.dto';
import { JobHistoryService } from './job-history.service';

const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MiB per photo

@Controller()
@UseGuards(JwtAuthGuard)
export class JobHistoryController {
  constructor(private readonly histories: JobHistoryService) {}

  @Get('job-histories')
  findAll(@AuthCtx() auth: AuthContext, @Query('jobInstanceId') jobInstanceId?: string) {
    return this.histories.findAll(auth, jobInstanceId);
  }

  @Get('job-histories/:id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.histories.findOne(auth, id);
  }

  /**
   * Sign off a JobInstance: creates the immutable JobHistory row + flips
   * the parent instance to DONE. Photos are multipart files under the
   * field name `photos`; metadata (hoursWorked, notes, signatureHash,
   * partsConsumedJson) arrive as form fields alongside.
   *
   * Mounted under JobInstance's path so the URL reads as the action it is.
   */
  @Post('job-instances/:id/sign-off')
  @UseInterceptors(
    FilesInterceptor('photos', MAX_PHOTOS, {
      limits: { fileSize: MAX_PHOTO_BYTES },
    }),
  )
  signOff(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: SignOffJobInstanceDto,
    @UploadedFiles() photos: Express.Multer.File[] = [],
  ) {
    return this.histories.signOff(auth, id, dto, photos);
  }
}
