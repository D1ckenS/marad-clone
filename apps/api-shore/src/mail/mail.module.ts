import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

// @Global so any feature module (CertificateService, future
// AuthService password reset, etc.) can inject MailService without
// having to wire MailModule into its own imports list.
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
