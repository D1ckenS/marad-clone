import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ApprovalFlowModule } from './approval-flow/approval-flow.module';
import { DrillTypeModule } from './drill-type/drill-type.module';
import { DrillModule } from './drill/drill.module';
import { PermitTemplateModule } from './permit-template/permit-template.module';
import { WorkPermitModule } from './work-permit/work-permit.module';
import { AuthModule } from './auth/auth.module';
import { CertificateModule } from './certificate/certificate.module';
import { CertificateTypeModule } from './certificate-type/certificate-type.module';
import { BarcodeBindingModule } from './barcode-binding/barcode-binding.module';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { QuoteModule } from './quote/quote.module';
import { RequisitionModule } from './requisition/requisition.module';
import { RfqModule } from './rfq/rfq.module';
import { SupplierModule } from './supplier/supplier.module';
import { ComponentModule } from './component/component.module';
import { DrizzleModule } from './db/drizzle.module';
import { JobHistoryModule } from './job-history/job-history.module';
import { JobInstanceModule } from './job-instance/job-instance.module';
import { JobModule } from './job/job.module';
import { MasterComponentModule } from './master-component/master-component.module';
import { PartCategoryModule } from './part-category/part-category.module';
import { PartModule } from './part/part.module';
import { RunningHourReadingModule } from './running-hour-reading/running-hour-reading.module';
import { StockLevelModule } from './stock-level/stock-level.module';
import { StockLocationModule } from './stock-location/stock-location.module';
import { StockMovementModule } from './stock-movement/stock-movement.module';
import { StorageModule } from './storage/storage.module';
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
    StorageModule,
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
    PartCategoryModule,
    PartModule,
    StockLocationModule,
    StockLevelModule,
    StockMovementModule,
    BarcodeBindingModule,
    SupplierModule,
    ApprovalFlowModule,
    RequisitionModule,
    RfqModule,
    QuoteModule,
    PurchaseOrderModule,
    CertificateTypeModule,
    CertificateModule,
    DrillTypeModule,
    DrillModule,
    PermitTemplateModule,
    WorkPermitModule,
  ],
})
export class AppModule {}
