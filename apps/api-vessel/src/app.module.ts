import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { SurveyModule } from './survey/survey.module';
import { ConditionOfClassModule } from './condition-of-class/condition-of-class.module';
import { InspectionModule } from './inspection/inspection.module';
import { JhaModule } from './jha/jha.module';
import { SafetyEquipmentModule } from './safety-equipment/safety-equipment.module';
import { QhseObjectiveModule } from './qhse-objective/qhse-objective.module';
import { AuditModule } from './audit/audit.module';
import { AuditFindingModule } from './audit-finding/audit-finding.module';
import { VoyageLegModule } from './voyage-leg/voyage-leg.module';
import { DischargeLogModule } from './discharge-log/discharge-log.module';
import { DrybmsElementModule } from './drybms-element/drybms-element.module';
import { ManagementReviewModule } from './management-review/management-review.module';
import { CapaModule } from './capa/capa.module';
import { ChecklistInstanceModule } from './checklist-instance/checklist-instance.module';
import { ChecklistTemplateModule } from './checklist-template/checklist-template.module';
import { FindingModule } from './finding/finding.module';
import { QhseDocumentModule } from './qhse-document/qhse-document.module';
import { CrewMemberModule } from './crew-member/crew-member.module';
import { RotationModule } from './rotation/rotation.module';
import { RestHourEntryModule } from './rest-hour-entry/rest-hour-entry.module';
import { CrewCertificateModule } from './crew-certificate/crew-certificate.module';
import { BunkerDeliveryNoteModule } from './bunker-delivery-note/bunker-delivery-note.module';
import { ConsumptionLogModule } from './consumption-log/consumption-log.module';
import { ProjectModule } from './project/project.module';
import { FuelProductModule } from './fuel-product/fuel-product.module';
import { TankModule } from './tank/tank.module';
import { TankReadingModule } from './tank-reading/tank-reading.module';
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
    // H4: default 10/min/IP. The /auth/login route also stacks a per-route
    // @Throttle for explicitness; this baseline catches abusive bursts on
    // any other endpoint too.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
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
    QhseDocumentModule,
    ChecklistTemplateModule,
    ChecklistInstanceModule,
    FindingModule,
    CapaModule,
    CrewMemberModule,
    RotationModule,
    RestHourEntryModule,
    CrewCertificateModule,
    FuelProductModule,
    TankModule,
    TankReadingModule,
    BunkerDeliveryNoteModule,
    ConsumptionLogModule,
    ProjectModule,
    SurveyModule,
    ConditionOfClassModule,
    InspectionModule,
    JhaModule,
    SafetyEquipmentModule,
    QhseObjectiveModule,
    AuditModule,
    AuditFindingModule,
    VoyageLegModule,
    DischargeLogModule,
    DrybmsElementModule,
    ManagementReviewModule,
  ],
})
export class AppModule {}
