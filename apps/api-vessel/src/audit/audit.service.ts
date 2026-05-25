import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { audits } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateAuditDto, UpdateAuditDto } from './dto/audit.dto';

const ENTITY = 'Audit';

@Injectable()
export class AuditService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateAuditDto) {
    const id = newId();
    const nowIso = new Date().toISOString();
    // Outbox key requires a vessel-scoped record; for fleet-level audits we
    // route the sync payload through the user's primary vessel (auth.vesselId).
    const vesselForSync = dto.vesselId ?? auth.vesselId ?? null;
    return this.drizzle.db.transaction((tx) => {
      const syncFields = {
        vesselId: dto.vesselId ?? null,
        kind: dto.kind,
        scope: dto.scope,
        scheduledAt: dto.scheduledAt,
        auditor: dto.auditor,
        status: dto.status ?? 'SCHEDULED',
        // findings starts at 0; recomputed by `recomputeFindings` whenever
        // an audit_findings row is added or soft-deleted.
        findings: 0,
        notes: dto.notes ?? null,
      };
      let hlc: string | null = null;
      if (vesselForSync) {
        const recorded = this.recorder.recordUpsert(
          tx,
          { tenantId: auth.tenantId!, vesselId: vesselForSync },
          ENTITY,
          id,
          syncFields,
        );
        hlc = recorded.hlc;
      }
      const [row] = tx
        .insert(audits)
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
      return row;
    });
  }

  findAll(auth: AuthContext, query: { vesselId?: string; kind?: string; status?: string }) {
    const filters = [eq(audits.tenantId, auth.tenantId!), isNull(audits.deletedAt)];
    if (query.vesselId) filters.push(eq(audits.vesselId, query.vesselId));
    if (query.kind) filters.push(eq(audits.kind, query.kind as never));
    if (query.status) filters.push(eq(audits.status, query.status as never));
    return this.drizzle.db
      .select()
      .from(audits)
      .where(and(...filters))
      .orderBy(desc(audits.scheduledAt))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(audits)
      .where(and(eq(audits.id, id), eq(audits.tenantId, auth.tenantId!), isNull(audits.deletedAt)))
      .get();
    if (!row) throw new NotFoundException(`Audit ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateAuditDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.vesselId !== undefined) fields['vesselId'] = dto.vesselId;
    if (dto.kind !== undefined) fields['kind'] = dto.kind;
    if (dto.scope !== undefined) fields['scope'] = dto.scope;
    if (dto.scheduledAt !== undefined) fields['scheduledAt'] = dto.scheduledAt;
    if (dto.auditor !== undefined) fields['auditor'] = dto.auditor;
    if (dto.status !== undefined) fields['status'] = dto.status;
    // findings is derived; see `recomputeFindings`.
    if (dto.notes !== undefined) fields['notes'] = dto.notes;

    const vesselForSync = existing.vesselId ?? auth.vesselId ?? null;
    return this.drizzle.db.transaction((tx) => {
      let hlc: string | null = existing.hlc;
      if (vesselForSync) {
        const recorded = this.recorder.recordUpsert(
          tx,
          { tenantId: auth.tenantId!, vesselId: vesselForSync },
          ENTITY,
          id,
          fields,
        );
        hlc = recorded.hlc;
      }
      const [row] = tx
        .update(audits)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(audits.id, id))
        .returning()
        .all();
      return row;
    });
  }

  softDelete(auth: AuthContext, id: string) {
    const existing = this.findOne(auth, id);
    const vesselForSync = existing.vesselId ?? auth.vesselId ?? null;
    this.drizzle.db.transaction((tx) => {
      if (vesselForSync) {
        this.recorder.recordDelete(
          tx,
          { tenantId: auth.tenantId!, vesselId: vesselForSync },
          ENTITY,
          id,
        );
      }
      tx.update(audits)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(audits.id, id))
        .run();
    });
  }

  // NOTE: `findings` is derived from audit_findings row count. The
  // recompute helper lives in audit-finding/audit-finding.service.ts
  // since that's where the mutations happen — keeping the recompute next
  // to the only thing that triggers it.
}
