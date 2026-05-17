import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { drillRecords, drills } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateDrillDto, CreateDrillRecordDto, UpdateDrillDto } from './dto/create-drill.dto';

const DRILL_ENTITY = 'Drill';
const DRILL_RECORD_ENTITY = 'DrillRecord';

@Injectable()
export class DrillService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateDrillDto) {
    const vesselId = dto.vesselId ?? requireVesselId(auth);
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const syncFields = {
        drillTypeId: dto.drillTypeId,
        scheduledAt: dto.scheduledAt,
        location: dto.location ?? null,
        leadOfficer: dto.leadOfficer ?? null,
        notes: dto.notes ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        DRILL_ENTITY,
        id,
        { vesselId, ...syncFields },
      );
      const [row] = tx
        .insert(drills)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
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

  findAll(auth: AuthContext, query: { status?: string; vesselId?: string }) {
    const filters = [eq(drills.tenantId, auth.tenantId), isNull(drills.deletedAt)];
    if (query.vesselId) filters.push(eq(drills.vesselId, query.vesselId));
    if (query.status) filters.push(eq(drills.status, query.status as never));
    return this.drizzle.db
      .select()
      .from(drills)
      .where(and(...filters))
      .orderBy(desc(drills.scheduledAt))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(drills)
      .where(and(eq(drills.id, id), eq(drills.tenantId, auth.tenantId), isNull(drills.deletedAt)))
      .get();
    if (!row) throw new NotFoundException(`Drill ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateDrillDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.status !== undefined) fields['status'] = dto.status;
    if (dto.conductedAt !== undefined) fields['conductedAt'] = dto.conductedAt;
    if (dto.durationMinutes !== undefined) fields['durationMinutes'] = dto.durationMinutes;
    if (dto.location !== undefined) fields['location'] = dto.location;
    if (dto.leadOfficer !== undefined) fields['leadOfficer'] = dto.leadOfficer;
    if (dto.notes !== undefined) fields['notes'] = dto.notes;
    if (dto.reportKey !== undefined) fields['reportKey'] = dto.reportKey;

    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: existing.vesselId },
        DRILL_ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(drills)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(drills.id, id))
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
        DRILL_ENTITY,
        id,
      );
      tx.update(drills)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(drills.id, id))
        .run();
    });
  }

  addRecord(auth: AuthContext, drillId: string, dto: CreateDrillRecordDto) {
    const drill = this.findOne(auth, drillId);
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId: drill.vesselId,
        drillId,
        participantName: dto.participantName,
        role: dto.role ?? null,
        signedAt: dto.signedAt ?? null,
        signatureHash: dto.signatureHash ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: drill.vesselId },
        DRILL_RECORD_ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .insert(drillRecords)
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
}
