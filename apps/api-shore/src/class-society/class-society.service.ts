import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ClassSociety, ClassSocietyReportType, ClassSocietySubmissionStatus } from '@prisma/client';
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
      webhookSecret?: string;
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
          webhookSecret: dto.webhookSecret ?? null,
        },
        update: {
          ...(dto.apiKey !== undefined && { apiKey: dto.apiKey }),
          ...(dto.apiEndpoint !== undefined && { apiEndpoint: dto.apiEndpoint }),
          ...(dto.vesselRegistrations !== undefined && {
            vesselRegistrations: dto.vesselRegistrations as never,
          }),
          ...(dto.enabled !== undefined && { enabled: dto.enabled }),
          ...(dto.webhookSecret !== undefined && { webhookSecret: dto.webhookSecret }),
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
      // H9: capture the society's external reference number so the cron
      // poller knows what to ask about. Best-effort JSON parse — every
      // society returns a different shape, common keys are tried in order.
      const externalRef = extractExternalRef(responseText);

      return this.prisma.withTenant(auth.tenantId!, (tx) =>
        tx.classSocietySubmission.update({
          where: { id: record.id },
          data: {
            status,
            submittedAt: new Date(),
            responseCode: res.status,
            responseMessage: responseText.slice(0, 500),
            ...(externalRef !== null && { externalRef }),
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
      immutabilityMechanism:
        'database_triggers_job_histories_immutable_and_job_histories_no_delete',
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

  // ── H9: lifecycle (polling + webhook) ──────────────────────────────────────

  /**
   * Pulled out for use by both the cron poller and ad-hoc admin calls.
   * Scans the oldest-polled SUBMITTED rows across ALL tenants, asks the
   * society's status endpoint, and transitions to ACCEPTED / REJECTED.
   * No tenant context required — the poller runs as a system process.
   *
   * Returns counts so the cron has something to log + tests can assert.
   */
  async pollPendingSubmissions(batchSize = 50): Promise<{
    polled: number;
    accepted: number;
    rejected: number;
    errors: number;
  }> {
    // System-wide scan across ALL tenants. Bypass RLS via the empty-string
    // `app.current_tenant_id` sentinel — same pattern used by createSuperAdmin
    // and getMe (the policy explicitly allows '' as a bypass for system
    // processes). Subsequent per-row updates use withTenant(row.tenantId)
    // so the write is RLS-checked normally.
    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = ''`);
      return tx.classSocietySubmission.findMany({
        where: { status: 'SUBMITTED' },
        include: { connector: true },
        orderBy: [{ lastPolledAt: { sort: 'asc', nulls: 'first' } }, { submittedAt: 'asc' }],
        take: batchSize,
      });
    });
    if (rows.length === 0) return { polled: 0, accepted: 0, rejected: 0, errors: 0 };

    let accepted = 0;
    let rejected = 0;
    let errors = 0;

    for (const row of rows) {
      const endpoint = row.connector.apiEndpoint ?? DEFAULT_ENDPOINTS[row.society];
      if (!endpoint || !row.connector.apiKey || !row.externalRef) {
        // Nothing to poll — record the attempt timestamp so we don't busy-loop.
        await this.prisma.withTenant(row.tenantId, (tx) =>
          tx.classSocietySubmission.update({
            where: { id: row.id },
            data: { lastPolledAt: new Date() },
          }),
        );
        continue;
      }

      try {
        const res = await fetch(
          `${endpoint}/submissions/${encodeURIComponent(row.externalRef)}/status`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${row.connector.apiKey}` },
            signal: AbortSignal.timeout(15_000),
          },
        );
        const body = await res.text().catch(() => '');
        const status = mapPolledStatus(body, res.status);
        if (status === null) {
          // Society returned a non-terminal status (still PENDING / IN_REVIEW
          // / etc.) — just bump lastPolledAt.
          await this.prisma.withTenant(row.tenantId, (tx) =>
            tx.classSocietySubmission.update({
              where: { id: row.id },
              data: { lastPolledAt: new Date(), responseCode: res.status },
            }),
          );
          continue;
        }
        await this.prisma.withTenant(row.tenantId, (tx) =>
          tx.classSocietySubmission.update({
            where: { id: row.id },
            data: {
              status,
              lastPolledAt: new Date(),
              responseCode: res.status,
              responseMessage: body.slice(0, 500),
              updatedAt: new Date(),
            },
          }),
        );
        if (status === 'ACCEPTED') accepted++;
        else if (status === 'REJECTED') rejected++;
      } catch (err) {
        errors++;
        this.logger.warn({
          msg: 'Class society poll failed',
          society: row.society,
          submissionId: row.id,
          err: err instanceof Error ? err.message : String(err),
        });
        await this.prisma.withTenant(row.tenantId, (tx) =>
          tx.classSocietySubmission.update({
            where: { id: row.id },
            data: { lastPolledAt: new Date() },
          }),
        );
      }
    }

    return { polled: rows.length, accepted, rejected, errors };
  }

  /**
   * Apply an inbound webhook from a class society. Authenticated by
   * matching the `X-FleetOps-Webhook-Secret` header against the per-
   * connector `webhookSecret`. Tenant is resolved from `externalRef`
   * (looked up across all connectors of that society) — class societies
   * don't know our tenantId so this is the only safe way to route.
   *
   * Returns the updated submission row; throws UnauthorizedException on
   * bad secret, NotFoundException on unknown externalRef.
   */
  async applyWebhook(
    society: ClassSociety,
    headerSecret: string | undefined,
    body: { externalRef: string; status: 'ACCEPTED' | 'REJECTED'; message?: string },
  ) {
    if (!headerSecret) throw new UnauthorizedException('Missing X-FleetOps-Webhook-Secret');
    if (!body.externalRef) throw new NotFoundException('webhook body missing externalRef');

    // Find the submission via externalRef + society. The society doesn't
    // know our tenantId, so this lookup has to cross all tenants — bypass
    // RLS with the empty-string sentinel. Once we have submission.tenantId
    // the subsequent update is RLS-checked normally via withTenant.
    const submission = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = ''`);
      return tx.classSocietySubmission.findFirst({
        where: { society, externalRef: body.externalRef },
        include: { connector: true },
      });
    });
    if (!submission) {
      throw new NotFoundException(
        `No submission for ${society}/${body.externalRef} — webhook arrived for unknown ref`,
      );
    }
    if (
      !submission.connector.webhookSecret ||
      submission.connector.webhookSecret !== headerSecret
    ) {
      throw new UnauthorizedException('Invalid X-FleetOps-Webhook-Secret');
    }

    return this.prisma.withTenant(submission.tenantId, (tx) =>
      tx.classSocietySubmission.update({
        where: { id: submission.id },
        data: {
          status: body.status,
          webhookReceivedAt: new Date(),
          responseMessage: body.message?.slice(0, 500) ?? submission.responseMessage,
          updatedAt: new Date(),
        },
      }),
    );
  }
}

// ── H9 helpers ───────────────────────────────────────────────────────────────

/**
 * Best-effort extraction of a society-assigned reference from a submission
 * response body. Each society returns a different shape; we try the common
 * keys in order. Returns null when nothing recognisable is found.
 */
function extractExternalRef(responseText: string): string | null {
  if (!responseText) return null;
  try {
    const parsed = JSON.parse(responseText) as Record<string, unknown>;
    for (const key of [
      'submissionId',
      'submission_id',
      'reference',
      'referenceNumber',
      'reference_number',
      'id',
      'externalRef',
      'external_ref',
    ]) {
      const v = parsed[key];
      if (typeof v === 'string' && v.length > 0) return v;
      if (typeof v === 'number') return String(v);
    }
  } catch {
    // not JSON — give up; operator can backfill manually if needed
  }
  return null;
}

/**
 * Translate the society's status endpoint response into our terminal
 * states. Returns null for non-terminal responses so the poller leaves
 * the row as SUBMITTED and tries again next tick.
 *
 * Each society has its own taxonomy; this matches the common subset.
 * Extend per-society as we learn the real shapes during pilot.
 */
function mapPolledStatus(
  responseText: string,
  httpStatus: number,
): ClassSocietySubmissionStatus | null {
  // Non-2xx: leave SUBMITTED so the next poll can retry. 404 is a special
  // case — the society doesn't know about the externalRef, which means our
  // submit succeeded but the row never landed on their side. Mark as
  // REJECTED so an operator looks at it.
  if (httpStatus === 404) return 'REJECTED';
  if (httpStatus >= 400) return null;
  try {
    const parsed = JSON.parse(responseText) as Record<string, unknown>;
    const raw = parsed['status'] ?? parsed['state'] ?? parsed['decision'];
    if (typeof raw !== 'string') return null;
    const norm = raw.toUpperCase();
    if (['ACCEPTED', 'APPROVED', 'CLOSED', 'COMPLETE', 'COMPLETED'].includes(norm)) {
      return 'ACCEPTED';
    }
    if (['REJECTED', 'DENIED', 'FAILED', 'INVALID'].includes(norm)) {
      return 'REJECTED';
    }
  } catch {
    /* leave as SUBMITTED */
  }
  return null;
}
