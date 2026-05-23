import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { inspections } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateInspectionDto, UpdateInspectionDto } from './dto/inspection.dto';

const ENTITY = 'Inspection';

@Injectable()
export class InspectionService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateInspectionDto) {
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const syncFields = {
        vesselId: dto.vesselId,
        inspectedAt: dto.inspectedAt,
        kind: dto.kind,
        mou: dto.mou ?? null,
        port: dto.port,
        inspector: dto.inspector,
        deficiencies: dto.deficiencies ?? 0,
        detained: dto.detained ?? false,
        status: dto.status,
        findings: dto.findings ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId!, vesselId: dto.vesselId },
        ENTITY,
        id,
        syncFields,
      );
      const [row] = tx
        .insert(inspections)
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

  findAll(auth: AuthContext, query: { vesselId?: string; kind?: string }) {
    const filters = [eq(inspections.tenantId, auth.tenantId!), isNull(inspections.deletedAt)];
    if (query.vesselId) filters.push(eq(inspections.vesselId, query.vesselId));
    if (query.kind) filters.push(eq(inspections.kind, query.kind as never));
    return this.drizzle.db
      .select()
      .from(inspections)
      .where(and(...filters))
      .orderBy(desc(inspections.inspectedAt))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(inspections)
      .where(
        and(
          eq(inspections.id, id),
          eq(inspections.tenantId, auth.tenantId!),
          isNull(inspections.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`Inspection ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateInspectionDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.inspectedAt !== undefined) fields['inspectedAt'] = dto.inspectedAt;
    if (dto.kind !== undefined) fields['kind'] = dto.kind;
    if (dto.mou !== undefined) fields['mou'] = dto.mou;
    if (dto.port !== undefined) fields['port'] = dto.port;
    if (dto.inspector !== undefined) fields['inspector'] = dto.inspector;
    if (dto.deficiencies !== undefined) fields['deficiencies'] = dto.deficiencies;
    if (dto.detained !== undefined) fields['detained'] = dto.detained;
    if (dto.status !== undefined) fields['status'] = dto.status;
    if (dto.findings !== undefined) fields['findings'] = dto.findings;

    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId!, vesselId: existing.vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(inspections)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(inspections.id, id))
        .returning()
        .all();
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
      tx.update(inspections)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(inspections.id, id))
        .run();
    });
  }
}
