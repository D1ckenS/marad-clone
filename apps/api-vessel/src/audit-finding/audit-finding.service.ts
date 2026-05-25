import { Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { auditFindings, audits } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateAuditFindingDto, UpdateAuditFindingDto } from './dto/audit-finding.dto';

const ENTITY = 'AuditFinding';

@Injectable()
export class AuditFindingService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateAuditFindingDto) {
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const syncFields = {
        vesselId: dto.vesselId,
        auditId: dto.auditId ?? null,
        classification: dto.classification,
        smsRef: dto.smsRef ?? null,
        title: dto.title,
        detail: dto.detail ?? null,
        owner: dto.owner ?? null,
        openedAt: dto.openedAt,
        dueAt: dto.dueAt ?? null,
        closedAt: dto.closedAt ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId!, vesselId: dto.vesselId },
        ENTITY,
        id,
        syncFields,
      );
      const [row] = tx
        .insert(auditFindings)
        .values({
          id,
          tenantId: auth.tenantId!,
          ...syncFields,
          createdAt: nowIso,
          updatedAt: nowIso,
          hlc,
        })
        .returning()
        .all();
      recomputeAuditFindings(tx, row?.auditId ?? null);
      return row;
    });
  }

  findAll(auth: AuthContext, query: { vesselId?: string; auditId?: string }) {
    const filters = [eq(auditFindings.tenantId, auth.tenantId!), isNull(auditFindings.deletedAt)];
    if (query.vesselId) filters.push(eq(auditFindings.vesselId, query.vesselId));
    if (query.auditId) filters.push(eq(auditFindings.auditId, query.auditId));
    return this.drizzle.db
      .select()
      .from(auditFindings)
      .where(and(...filters))
      .orderBy(desc(auditFindings.openedAt))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(auditFindings)
      .where(
        and(
          eq(auditFindings.id, id),
          eq(auditFindings.tenantId, auth.tenantId!),
          isNull(auditFindings.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`AuditFinding ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateAuditFindingDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.auditId !== undefined) fields['auditId'] = dto.auditId;
    if (dto.classification !== undefined) fields['classification'] = dto.classification;
    if (dto.smsRef !== undefined) fields['smsRef'] = dto.smsRef;
    if (dto.title !== undefined) fields['title'] = dto.title;
    if (dto.detail !== undefined) fields['detail'] = dto.detail;
    if (dto.owner !== undefined) fields['owner'] = dto.owner;
    if (dto.openedAt !== undefined) fields['openedAt'] = dto.openedAt;
    if (dto.dueAt !== undefined) fields['dueAt'] = dto.dueAt;
    if (dto.closedAt !== undefined) fields['closedAt'] = dto.closedAt;

    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId!, vesselId: existing.vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(auditFindings)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(auditFindings.id, id))
        .returning()
        .all();
      // Reparenting: recompute both old + new parent counts.
      if (dto.auditId !== undefined && dto.auditId !== existing.auditId) {
        recomputeAuditFindings(tx, existing.auditId);
      }
      recomputeAuditFindings(tx, row?.auditId ?? null);
      return row;
    });
  }

  softDelete(auth: AuthContext, id: string) {
    const existing = this.findOne(auth, id);
    this.drizzle.db.transaction((tx) => {
      this.recorder.recordDelete(
        tx,
        { tenantId: auth.tenantId!, vesselId: existing.vesselId },
        ENTITY,
        id,
      );
      tx.update(auditFindings)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(auditFindings.id, id))
        .run();
      recomputeAuditFindings(tx, existing.auditId);
    });
  }
}

/**
 * Re-derive `audits.findings` from
 * `COUNT(audit_findings WHERE audit_id = X AND deleted_at IS NULL)`.
 * Called inside every AuditFinding create/update/softDelete transaction
 * so the parent's denormalised count stays consistent. If `auditId` is
 * null (finding logged without a parent audit) this is a no-op.
 *
 * Standalone function rather than a method on `AuditService` so we don't
 * need to wire AuditService through DI just for this one-liner.
 */
function recomputeAuditFindings(
  tx: Parameters<Parameters<DrizzleService['db']['transaction']>[0]>[0],
  auditId: string | null,
) {
  if (!auditId) return;
  const result = tx
    .select({ n: count() })
    .from(auditFindings)
    .where(and(eq(auditFindings.auditId, auditId), isNull(auditFindings.deletedAt)))
    .get();
  const n = result?.n ?? 0;
  tx.update(audits)
    .set({ findings: n, updatedAt: new Date().toISOString() })
    .where(eq(audits.id, auditId))
    .run();
}
