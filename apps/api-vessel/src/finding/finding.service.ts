import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { findings } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateFindingDto, UpdateFindingDto } from './dto/create-finding.dto';

const ENTITY = 'Finding';

@Injectable()
export class FindingService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateFindingDto) {
    const vesselId = dto.vesselId ?? requireVesselId(auth);
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId,
        kind: dto.kind,
        title: dto.title,
        description: dto.description ?? null,
        raisedByUserId: dto.raisedByUserId ?? null,
        raisedAt: dto.raisedAt,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .insert(findings)
        .values({
          id,
          tenantId: auth.tenantId,
          ...fields,
          createdAt: nowIso,
          updatedAt: nowIso,
          hlc,
        } as never)
        .returning()
        .all();
      return row;
    });
  }

  findAll(auth: AuthContext, query: { vesselId?: string; kind?: string; status?: string }) {
    const filters = [eq(findings.tenantId, auth.tenantId), isNull(findings.deletedAt)];
    if (query.vesselId) filters.push(eq(findings.vesselId, query.vesselId));
    if (query.kind) filters.push(eq(findings.kind, query.kind as never));
    if (query.status) filters.push(eq(findings.status, query.status as never));
    return this.drizzle.db
      .select()
      .from(findings)
      .where(and(...filters))
      .orderBy(desc(findings.raisedAt))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(findings)
      .where(
        and(eq(findings.id, id), eq(findings.tenantId, auth.tenantId), isNull(findings.deletedAt)),
      )
      .get();
    if (!row) throw new NotFoundException(`Finding ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateFindingDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.status !== undefined) fields['status'] = dto.status;
    if (dto.title !== undefined) fields['title'] = dto.title;
    if (dto.description !== undefined) fields['description'] = dto.description;
    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: existing.vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(findings)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(findings.id, id))
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
        { tenantId: auth.tenantId, vesselId: existing.vesselId },
        ENTITY,
        id,
      );
      tx.update(findings)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(findings.id, id))
        .run();
    });
  }

  close(auth: AuthContext, id: string) {
    const existing = this.findOne(auth, id);
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: existing.vesselId },
        ENTITY,
        id,
        { status: 'CLOSED', closedAt: nowIso },
      );
      const [row] = tx
        .update(findings)
        .set({ status: 'CLOSED', closedAt: nowIso, updatedAt: nowIso, hlc } as never)
        .where(eq(findings.id, id))
        .returning()
        .all();
      return row;
    });
  }
}
