import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuditInterceptor } from './audit-event/audit.interceptor';
import { MailModule } from './mail/mail.module';
import { BudgetModule } from './budget/budget.module';
import { FleetviewModule } from './fleetview/fleetview.module';
import { TechLibraryModule } from './tech-library/tech-library.module';
import { OcimfInspectionModule } from './ocimf-inspection/ocimf-inspection.module';
import { AccountingModule } from './accounting/accounting.module';
import { ClassSocietyModule } from './class-society/class-society.module';
import { BiModule } from './bi/bi.module';
import { ComplianceModule } from './compliance/compliance.module';
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
import { AuditEventModule } from './audit-event/audit-event.module';
import { BunkerDeliveryNoteModule } from './bunker-delivery-note/bunker-delivery-note.module';
import { ConsumptionLogModule } from './consumption-log/consumption-log.module';
import { FlgoReportModule } from './flgo-report/flgo-report.module';
import { FuelProductModule } from './fuel-product/fuel-product.module';
import { TankModule } from './tank/tank.module';
import { TankReadingModule } from './tank-reading/tank-reading.module';
import { CrewMemberModule } from './crew-member/crew-member.module';
import { RotationModule } from './rotation/rotation.module';
import { RestHourEntryModule } from './rest-hour-entry/rest-hour-entry.module';
import { CrewCertificateModule } from './crew-certificate/crew-certificate.module';
import { ApprovalFlowModule } from './approval-flow/approval-flow.module';
import { ProjectModule } from './project/project.module';
import { DrillTypeModule } from './drill-type/drill-type.module';
import { DrillModule } from './drill/drill.module';
import { PermitTemplateModule } from './permit-template/permit-template.module';
import { WorkPermitModule } from './work-permit/work-permit.module';
import { CertificateModule } from './certificate/certificate.module';
import { CertificateTypeModule } from './certificate-type/certificate-type.module';
import { NotificationModule } from './notification/notification.module';
import { AuthModule } from './auth/auth.module';
import { BarcodeBindingModule } from './barcode-binding/barcode-binding.module';
import { ComponentModule } from './component/component.module';
import { JobHistoryModule } from './job-history/job-history.module';
import { JobInstanceModule } from './job-instance/job-instance.module';
import { JobModule } from './job/job.module';
import { MasterComponentModule } from './master-component/master-component.module';
import { PartCategoryModule } from './part-category/part-category.module';
import { PartModule } from './part/part.module';
import { PrismaModule } from './prisma/prisma.module';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { QuoteModule } from './quote/quote.module';
import { RequisitionModule } from './requisition/requisition.module';
import { RfqModule } from './rfq/rfq.module';
import { RunningHourReadingModule } from './running-hour-reading/running-hour-reading.module';
import { StockLevelModule } from './stock-level/stock-level.module';
import { StockLocationModule } from './stock-location/stock-location.module';
import { StockMovementModule } from './stock-movement/stock-movement.module';
import { StorageModule } from './storage/storage.module';
import { SupplierModule } from './supplier/supplier.module';
import { SyncModule } from './sync/sync.module';
import { TenantModule } from './tenant/tenant.module';
import { UserModule } from './user/user.module';
import { VesselModule } from './vessel/vessel.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
        redact: ['req.headers.authorization'],
      },
    }),
    PrismaModule,
    SyncModule,
    StorageModule,
    MailModule,
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
    NotificationModule,
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
    AuditEventModule,
    FuelProductModule,
    TankModule,
    TankReadingModule,
    BunkerDeliveryNoteModule,
    ConsumptionLogModule,
    FlgoReportModule,
    ProjectModule,
    BudgetModule,
    FleetviewModule,
    TechLibraryModule,
    OcimfInspectionModule,
    AccountingModule,
    ClassSocietyModule,
    BiModule,
    ComplianceModule,
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
  providers: [
    // B7: global write-audit interceptor. Records every successful POST /
    // PATCH / DELETE / PUT into the AuditEvent log with the actor's userId
    // taken from the JWT context.
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
