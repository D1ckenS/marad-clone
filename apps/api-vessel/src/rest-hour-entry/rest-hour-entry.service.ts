import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { newId, checkMlcRestHours } from '@fleetops/domain';
import type { RestHourDay } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { restHourEntries } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type {
  CreateRestHourEntryDto,
  UpdateRestHourEntryDto,
} from './dto/create-rest-hour-entry.dto';

const ENTITY = 'RestHourEntry';

@Injectable()
export class RestHourEntryService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateRestHourEntryDto) {
    const vesselId = dto.vesselId ?? requireVesselId(auth);
    const hoursWorked: boolean[] = JSON.parse(dto.hoursWorkedJson) as boolean[];
    if (!Array.isArray(hoursWorked) || hoursWorked.length !== 24) {
      throw new BadRequestException('hoursWorkedJson must be a JSON array of exactly 24 booleans');
    }

    const existing = this.drizzle.db
      .select()
      .from(restHourEntries)
      .where(
        and(
          eq(restHourEntries.crewMemberId, dto.crewMemberId),
          eq(restHourEntries.tenantId, auth.tenantId),
          isNull(restHourEntries.deletedAt),
        ),
      )
      .orderBy(desc(restHourEntries.date))
      .limit(6)
      .all();

    const window: RestHourDay[] = [
      ...existing.map((e) => ({
        date: e.date,
        hoursWorked: JSON.parse(e.hoursWorkedJson) as boolean[],
      })),
      { date: dto.date, hoursWorked },
    ];
    const mlcResult = checkMlcRestHours(window);

    if (!mlcResult.valid) {
      throw new BadRequestException({
        message: 'MLC 2006 rest-hour violation',
        violations: mlcResult.violations,
      });
    }

    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId,
        crewMemberId: dto.crewMemberId,
        date: dto.date,
        hoursWorkedJson: dto.hoursWorkedJson,
        mlcValid: mlcResult.valid,
        notes: dto.notes ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .insert(restHourEntries)
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

  findAll(auth: AuthContext, query: { vesselId?: string; crewMemberId?: string }) {
    const filters = [
      eq(restHourEntries.tenantId, auth.tenantId),
      isNull(restHourEntries.deletedAt),
    ];
    if (query.vesselId) filters.push(eq(restHourEntries.vesselId, query.vesselId));
    if (query.crewMemberId) filters.push(eq(restHourEntries.crewMemberId, query.crewMemberId));
    return this.drizzle.db
      .select()
      .from(restHourEntries)
      .where(and(...filters))
      .orderBy(desc(restHourEntries.date))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(restHourEntries)
      .where(
        and(
          eq(restHourEntries.id, id),
          eq(restHourEntries.tenantId, auth.tenantId),
          isNull(restHourEntries.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`RestHourEntry ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateRestHourEntryDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.hoursWorkedJson !== undefined) fields['hoursWorkedJson'] = dto.hoursWorkedJson;
    if (dto.notes !== undefined) fields['notes'] = dto.notes;
    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: existing.vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(restHourEntries)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(restHourEntries.id, id))
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
      tx.update(restHourEntries)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(restHourEntries.id, id))
        .run();
    });
  }
}
