import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { ComponentModule } from './component/component.module';
import { DrizzleModule } from './db/drizzle.module';
import { JobHistoryModule } from './job-history/job-history.module';
import { JobInstanceModule } from './job-instance/job-instance.module';
import { JobModule } from './job/job.module';
import { MasterComponentModule } from './master-component/master-component.module';
import { RunningHourReadingModule } from './running-hour-reading/running-hour-reading.module';
import { SyncModule } from './sync/sync.module';
import { TenantModule } from './tenant/tenant.module';
import { UserModule } from './user/user.module';
import { VesselModule } from './vessel/vessel.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
        redact: ['req.headers.authorization'],
      },
    }),
    DrizzleModule,
    SyncModule,
    AuthModule,
    TenantModule,
    VesselModule,
    UserModule,
    MasterComponentModule,
    ComponentModule,
    JobModule,
    JobInstanceModule,
    JobHistoryModule,
    RunningHourReadingModule,
  ],
})
export class AppModule {}
