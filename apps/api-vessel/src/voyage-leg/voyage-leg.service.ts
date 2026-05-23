import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { voyageLegs } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateVoyageLegDto, UpdateVoyageLegDto } from './dto/voyage-leg.dto';

const ENTITY = 'VoyageLeg';

@Injectable()
export class VoyageLegService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateVoyageLegDto) {
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const syncFields = {
        vesselId: dto.vesselId,
        route: dto.route,
        departureAt: dto.departureAt,
        arrivalAt: dto.arrivalAt,
        nm: dto.nm,
        fuelTonnes: dto.fuelTonnes,
        co2Tonnes: dto.co2Tonnes,
        soxTonnes: dto.soxTonnes,
        noxTonnes: dto.noxTonnes,
        hours: dto.hours,
        mode: dto.mode,
        cargo: dto.cargo ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId!, vesselId: dto.vesselId },
        ENTITY,
        id,
        syncFields,
      );
      const [row] = tx
        .insert(voyageLegs)
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

  findAll(auth: AuthContext, query: { vesselId?: string; mode?: string }) {
    const filters = [eq(voyageLegs.tenantId, auth.tenantId!), isNull(voyageLegs.deletedAt)];
    if (query.vesselId) filters.push(eq(voyageLegs.vesselId, query.vesselId));
    if (query.mode) filters.push(eq(voyageLegs.mode, query.mode as never));
    return this.drizzle.db
      .select()
      .from(voyageLegs)
      .where(and(...filters))
      .orderBy(desc(voyageLegs.departureAt))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(voyageLegs)
      .where(
        and(
          eq(voyageLegs.id, id),
          eq(voyageLegs.tenantId, auth.tenantId!),
          isNull(voyageLegs.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`VoyageLeg ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateVoyageLegDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.route !== undefined) fields['route'] = dto.route;
    if (dto.departureAt !== undefined) fields['departureAt'] = dto.departureAt;
    if (dto.arrivalAt !== undefined) fields['arrivalAt'] = dto.arrivalAt;
    if (dto.nm !== undefined) fields['nm'] = dto.nm;
    if (dto.fuelTonnes !== undefined) fields['fuelTonnes'] = dto.fuelTonnes;
    if (dto.co2Tonnes !== undefined) fields['co2Tonnes'] = dto.co2Tonnes;
    if (dto.soxTonnes !== undefined) fields['soxTonnes'] = dto.soxTonnes;
    if (dto.noxTonnes !== undefined) fields['noxTonnes'] = dto.noxTonnes;
    if (dto.hours !== undefined) fields['hours'] = dto.hours;
    if (dto.mode !== undefined) fields['mode'] = dto.mode;
    if (dto.cargo !== undefined) fields['cargo'] = dto.cargo;

    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId!, vesselId: existing.vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(voyageLegs)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(voyageLegs.id, id))
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
      tx.update(voyageLegs)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(voyageLegs.id, id))
        .run();
    });
  }
}
