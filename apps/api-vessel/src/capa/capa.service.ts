import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { capas } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateCapaDto, UpdateCapaDto } from './dto/create-capa.dto';

const ENTITY = 'Capa';

@Injectable()
export class CapaService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateCapaDto) {
    const vesselId = dto.vesselId ?? requireVesselId(auth);
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId,
        findingId: dto.findingId ?? null,
        type: dto.type,
        description: dto.description,
        ownerUserId: dto.ownerUserId ?? null,
        dueDate: dto.dueDate ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .insert(capas)
        .values({
          id,
          tenantId: auth.tenantId,
          ...fields,
          createdAt: nowIso,
          updatedAt: nowIso,
          hlc,
        })
        .returning()
        .all();
      return row;
    });
  }

  findAll(auth: AuthContext, query: { vesselId?: string; findingId?: string; status?: string }) {
    const filters = [eq(capas.tenantId, auth.tenantId), isNull(capas.deletedAt)];
    if (query.vesselId) filters.push(eq(capas.vesselId, query.vesselId));
    if (query.findingId) filters.push(eq(capas.findingId, query.findingId));
    if (query.status) filters.push(eq(capas.status, query.status as never));
    return this.drizzle.db
      .select()
      .from(capas)
      .where(and(...filters))
      .orderBy(desc(capas.createdAt))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(capas)
      .where(and(eq(capas.id, id), eq(capas.tenantId, auth.tenantId), isNull(capas.deletedAt)))
      .get();
    if (!row) throw new NotFoundException(`CAPA ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateCapaDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.status !== undefined) fields['status'] = dto.status;
    if (dto.description !== undefined) fields['description'] = dto.description;
    if (dto.ownerUserId !== undefined) fields['ownerUserId'] = dto.ownerUserId;
    if (dto.dueDate !== undefined) fields['dueDate'] = dto.dueDate ?? null;
    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: existing.vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(capas)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(capas.id, id))
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
      tx.update(capas)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(capas.id, id))
        .run();
    });
  }

  verify(auth: AuthContext, id: string) {
    const existing = this.findOne(auth, id);
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: existing.vesselId },
        ENTITY,
        id,
        { status: 'VERIFIED', verifiedAt: nowIso },
      );
      const [row] = tx
        .update(capas)
        .set({ status: 'VERIFIED', verifiedAt: nowIso, updatedAt: nowIso, hlc } as never)
        .where(eq(capas.id, id))
        .returning()
        .all();
      return row;
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
        .update(capas)
        .set({ status: 'CLOSED', closedAt: nowIso, updatedAt: nowIso, hlc } as never)
        .where(eq(capas.id, id))
        .returning()
        .all();
      return row;
    });
  }
}
