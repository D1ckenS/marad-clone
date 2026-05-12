import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { and, eq, isNull } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { components } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateComponentDto } from './dto/create-component.dto';
import type { UpdateComponentDto } from './dto/update-component.dto';

const ENTITY_TYPE = 'Component';

@Injectable()
export class ComponentService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateComponentDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    const runningHours = dto.runningHours ?? '0';

    return this.drizzle.db.transaction((tx) => {
      const fields = {
        name: dto.name,
        description: dto.description ?? null,
        sfi: dto.sfi ?? null,
        parentId: dto.parentId ?? null,
        masterId: dto.masterId ?? null,
        runningHours,
        vesselId,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .insert(components)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
          name: dto.name,
          description: dto.description ?? null,
          sfi: dto.sfi ?? null,
          parentId: dto.parentId ?? null,
          masterId: dto.masterId ?? null,
          runningHours,
          hlc,
        })
        .returning()
        .all();
      return row;
    });
  }

  findAll(auth: AuthContext) {
    const vesselId = requireVesselId(auth);
    return this.drizzle.db
      .select()
      .from(components)
      .where(
        and(
          eq(components.tenantId, auth.tenantId),
          eq(components.vesselId, vesselId),
          isNull(components.deletedAt),
        ),
      )
      .orderBy(components.name)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = this.drizzle.db
      .select()
      .from(components)
      .where(
        and(
          eq(components.id, id),
          eq(components.tenantId, auth.tenantId),
          eq(components.vesselId, vesselId),
          isNull(components.deletedAt),
        ),
      )
      .get();
    if (row === undefined) throw new NotFoundException(`Component ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateComponentDto) {
    const vesselId = requireVesselId(auth);
    this.findOne(auth, id);

    const fields: Record<string, unknown> = {};
    if (dto.name !== undefined) fields['name'] = dto.name;
    if (dto.description !== undefined) fields['description'] = dto.description;
    if (dto.sfi !== undefined) fields['sfi'] = dto.sfi;
    if (dto.parentId !== undefined) fields['parentId'] = dto.parentId;
    if (dto.runningHours !== undefined) fields['runningHours'] = dto.runningHours;

    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .update(components)
        .set({
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.sfi !== undefined && { sfi: dto.sfi }),
          ...(dto.parentId !== undefined && { parentId: dto.parentId }),
          ...(dto.runningHours !== undefined && { runningHours: dto.runningHours }),
          hlc,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(components.id, id))
        .returning()
        .all();
      return row;
    });
  }

  softDelete(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    this.findOne(auth, id);

    this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordDelete(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
      );
      tx.update(components)
        .set({ deletedAt: new Date().toISOString(), hlc, updatedAt: new Date().toISOString() })
        .where(eq(components.id, id))
        .run();
    });
  }
}
