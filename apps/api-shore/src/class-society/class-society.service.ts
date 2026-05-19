import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClassSociety, ClassSocietyReportType } from '@prisma/client';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';

// Known default API endpoints for each society (customers must register separately)
const DEFAULT_ENDPOINTS: Partial<Record<ClassSociety, string>> = {
  DNV: 'https://api.veracity.com/dnv/pms/v1',
  ABS: 'https://services.eagle.org/abs-api/v1',
  LR: 'https://api.classdirect.lr.org/v1',
  RINA: 'https://api.rina.org/classservices/v1',
  BV: 'https://api.veristar.com/classservices/v1',
  NK: 'https://api.classnk.or.jp/classservices/v1',
};

@Injectable()
export class ClassSocietyService {
  private readonly logger = new Logger(ClassSocietyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Connector config ───────────────────────────────────────────────────────

  listConnectors(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.classSocietyConnector.findMany({ where: { tenantId: auth.tenantId! } }),
    );
  }

  upsertConnector(
    auth: AuthContext,
    dto: {
      society: ClassSociety;
      apiKey?: string;
      apiEndpoint?: string;
      vesselRegistrations?: Record<string, string>;
      enabled?: boolean;
    },
  ) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.classSocietyConnector.upsert({
        where: { tenantId_society: { tenantId: auth.tenantId!, society: dto.society } },
        create: {
          id: newId(),
          tenantId: auth.tenantId!,
          society: dto.society,
          apiKey: dto.apiKey ?? null,
          apiEndpoint: dto.apiEndpoint ?? null,
          vesselRegistrations: (dto.vesselRegistrations as never) ?? {},
          enabled: dto.enabled ?? true,
        },
        update: {
          ...(dto.apiKey !== undefined && { apiKey: dto.apiKey }),
          ...(dto.apiEndpoint !== undefined && { apiEndpoint: dto.apiEndpoint }),
          ...(dto.vesselRegistrations !== undefined && {
            vesselRegistrations: dto.vesselRegistrations as never,
          }),
          ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        },
      }),
    );
  }

  // ── Submissions ────────────────────────────────────────────────────────────

  listSubmissions(auth: AuthContext, vesselId?: string, society?: ClassSociety) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.classSocietySubmission.findMany({
        where: {
          tenantId: auth.tenantId!,
          ...(vesselId && { vesselId }),
          ...(society && { society }),
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    );
  }

  async buildAndSubmit(
    auth: AuthContext,
    vesselId: string,
    society: ClassSociety,
    reportType: ClassSocietyReportType,
    submit: boolean,
  ) {
    const connector = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.classSocietyConnector.findFirst({
        where: { tenantId: auth.tenantId!, society, enabled: true },
      }),
    );
    if (!connector) {
      throw new NotFoundException(
        `No ${society} connector configured. Add credentials in Integrations → Class Societies.`,
      );
    }

    const payload = await this.buildPayload(auth, vesselId, society, reportType, connector);

    const record = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.classSocietySubmission.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId,
          connectorId: connector.id,
          society,
          reportType,
          status: 'DRAFT',
          payloadJson: payload as never,
          updatedAt: new Date(),
        },
      }),
    );

    if (!submit) return record;

    // Attempt live API submission
    const endpoint = connector.apiEndpoint ?? DEFAULT_ENDPOINTS[society];
    if (!endpoint || !connector.apiKey) {
      this.logger.warn({ msg: 'No API endpoint/key — submission kept as DRAFT', society });
      return record;
    }

    try {
      const res = await fetch(`${endpoint}/submissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${connector.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });

      const responseText = await res.text().catch(() => '');
      const status = res.ok ? 'SUBMITTED' : 'ERROR';

      return this.prisma.withTenant(auth.tenantId!, (tx) =>
        tx.classSocietySubmission.update({
          where: { id: record.id },
          data: {
            status,
            submittedAt: new Date(),
            responseCode: res.status,
            responseMessage: responseText.slice(0, 500),
            updatedAt: new Date(),
          },
        }),
      );
    } catch (err) {
      this.logger.error({ msg: 'Class society submission failed', society, err });
      return this.prisma.withTenant(auth.tenantId!, (tx) =>
        tx.classSocietySubmission.update({
          where: { id: record.id },
          data: {
            status: 'ERROR',
            submittedAt: new Date(),
            responseMessage: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
            updatedAt: new Date(),
          },
        }),
      );
    }
  }

  async exportPayload(
    auth: AuthContext,
    vesselId: string,
    society: ClassSociety,
    reportType: ClassSocietyReportType,
  ) {
    const connector = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.classSocietyConnector.findFirst({ where: { tenantId: auth.tenantId!, society } }),
    );
    return this.buildPayload(auth, vesselId, society, reportType, connector);
  }

  // ── Report builders ────────────────────────────────────────────────────────

  private async buildPayload(
    auth: AuthContext,
    vesselId: string,
    society: ClassSociety,
    reportType: ClassSocietyReportType,
    connector: { vesselRegistrations: unknown } | null,
  ) {
    const regs = (connector?.vesselRegistrations ?? {}) as Record<string, string>;
    const classNumber = regs[vesselId] ?? null;

    const vessel = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.vessel.findFirst({ where: { id: vesselId, tenantId: auth.tenantId! } }),
    );
    if (!vessel) throw new NotFoundException(`Vessel ${vesselId} not found`);

    const base = {
      society,
      reportType,
      vessel: { id: vesselId, name: vessel.name, imoNumber: vessel.imoNumber, classNumber },
      generatedAt: new Date().toISOString(),
      source: 'FleetOps',
    };

    switch (reportType) {
      case 'PMS_EVIDENCE':
        return { ...base, ...(await this.buildPmsEvidence(auth, vesselId, society)) };
      case 'CERTIFICATES':
        return { ...base, ...(await this.buildCertificates(auth, vesselId)) };
      case 'FINDINGS':
        return { ...base, ...(await this.buildFindings(auth, vesselId)) };
      case 'SURVEY_STATUS':
        return { ...base, ...(await this.buildSurveyStatus(auth, vesselId)) };
    }
  }

  private async buildPmsEvidence(auth: AuthContext, vesselId: string, society: ClassSociety) {
    const [jobHistories, auditEvents] = await Promise.all([
      this.prisma.withTenant(auth.tenantId!, (tx) =>
        tx.jobHistory.findMany({
          where: { tenantId: auth.tenantId!, vesselId, deletedAt: null },
          include: {
            job: { select: { title: true, intervalRunningHours: true, intervalDays: true } },
          },
          orderBy: { completedAt: 'desc' },
          take: 500,
        }),
      ),
      this.prisma.withTenant(auth.tenantId!, (tx) =>
        tx.auditEvent.findMany({
          where: { tenantId: auth.tenantId!, vesselId, action: 'JOB_SIGNED_OFF' },
          orderBy: { recordedAt: 'desc' },
          take: 200,
        }),
      ),
    ]);

    // DNV CG-0339 format; also used as the base for other societies
    const record = {
      standard: society === 'DNV' ? 'DNV CG-0339' : `${society} PMS Evidence`,
      immutabilityMechanism: 'database_trigger_job_histories_immutable',
      summary: { totalJobs: jobHistories.length, totalAuditEvents: auditEvents.length },
      jobHistories: jobHistories.map((h) => ({
        id: h.id,
        jobTitle: h.job?.title ?? 'Unknown',
        completedAt: h.completedAt,
        completedByUserId: h.completedByUserId,
        hoursWorked: h.hoursWorked,
        notes: h.notes,
      })),
      auditTrail: auditEvents.map((e) => ({
        id: e.id,
        action: e.action,
        entityId: e.entityId,
        actorUserId: e.actorUserId,
        recordedAt: e.recordedAt,
      })),
    };

    return { pmsEvidence: record };
  }

  private async buildCertificates(auth: AuthContext, vesselId: string) {
    const certs = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.certificate.findMany({
        where: { tenantId: auth.tenantId!, vesselId, deletedAt: null },
        include: { certificateType: { select: { name: true } } },
        orderBy: { expiresAt: 'asc' },
      }),
    );

    const now = new Date();
    return {
      certificates: {
        total: certs.length,
        expiringSoon: certs.filter(
          (c) =>
            c.expiresAt &&
            c.expiresAt > now &&
            c.expiresAt < new Date(now.getTime() + 90 * 86_400_000),
        ).length,
        expired: certs.filter((c) => c.expiresAt && c.expiresAt < now).length,
        records: certs.map((c) => ({
          id: c.id,
          type: c.certificateType?.name ?? 'Unknown',
          subjectType: c.subjectType,
          number: c.number,
          issuedAt: c.issuedAt,
          expiresAt: c.expiresAt,
          issuedBy: c.issuedBy,
        })),
      },
    };
  }

  private async buildFindings(auth: AuthContext, vesselId: string) {
    const [findings, capas] = await Promise.all([
      this.prisma.withTenant(auth.tenantId!, (tx) =>
        tx.finding.findMany({
          where: { tenantId: auth.tenantId!, vesselId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        }),
      ),
      this.prisma.withTenant(auth.tenantId!, (tx) =>
        tx.capa.findMany({
          where: { tenantId: auth.tenantId!, vesselId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        }),
      ),
    ]);

    return {
      findings: {
        total: findings.length,
        open: findings.filter((f) => f.status !== 'CLOSED').length,
        records: findings.map((f) => ({
          id: f.id,
          title: f.title,
          kind: f.kind,
          status: f.status,
          createdAt: f.createdAt,
        })),
      },
      capas: {
        total: capas.length,
        open: capas.filter((c) => c.status !== 'CLOSED').length,
        records: capas.map((c) => ({
          id: c.id,
          description: c.description,
          status: c.status,
          dueDate: c.dueDate,
          ownerUserId: c.ownerUserId,
        })),
      },
    };
  }

  private async buildSurveyStatus(auth: AuthContext, vesselId: string) {
    const now = new Date();
    const in90d = new Date(now.getTime() + 90 * 86_400_000);

    const [overdueJobs, dueJobs, components] = await Promise.all([
      this.prisma.withTenant(auth.tenantId!, (tx) =>
        tx.jobInstance.findMany({
          where: {
            tenantId: auth.tenantId!,
            vesselId,
            deletedAt: null,
            status: { not: 'DONE' },
            dueAt: { lt: now },
          },
          include: { job: { select: { title: true } } },
          orderBy: { dueAt: 'asc' },
          take: 100,
        }),
      ),
      this.prisma.withTenant(auth.tenantId!, (tx) =>
        tx.jobInstance.findMany({
          where: {
            tenantId: auth.tenantId!,
            vesselId,
            deletedAt: null,
            status: { not: 'DONE' },
            dueAt: { gte: now, lte: in90d },
          },
          include: { job: { select: { title: true } } },
          orderBy: { dueAt: 'asc' },
          take: 100,
        }),
      ),
      this.prisma.withTenant(auth.tenantId!, (tx) =>
        tx.component.count({ where: { tenantId: auth.tenantId!, vesselId, deletedAt: null } }),
      ),
    ]);

    return {
      surveyStatus: {
        totalComponents: components,
        overdueJobs: overdueJobs.length,
        dueSoon: dueJobs.length,
        overdueDetails: overdueJobs.map((j) => ({
          instanceId: j.id,
          jobTitle: j.job?.title ?? 'Unknown',
          dueAt: j.dueAt,
          status: j.status,
        })),
        dueSoonDetails: dueJobs.map((j) => ({
          instanceId: j.id,
          jobTitle: j.job?.title ?? 'Unknown',
          dueAt: j.dueAt,
        })),
      },
    };
  }

  async getConnectorByVessel(
    auth: AuthContext,
    vesselId: string,
    society: ClassSociety,
  ): Promise<string | null> {
    const connector = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.classSocietyConnector.findFirst({ where: { tenantId: auth.tenantId!, society } }),
    );
    const regs = (connector?.vesselRegistrations ?? {}) as Record<string, string>;
    return regs[vesselId] ?? null;
  }
}
