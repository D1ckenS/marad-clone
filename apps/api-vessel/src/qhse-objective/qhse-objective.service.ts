import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { qhseObjectives } from '../db/schema';
import type { CreateQhseObjectiveDto, UpdateQhseObjectiveDto } from './dto/qhse-objective.dto';

@Injectable()
export class QhseObjectiveService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(auth: AuthContext, dto: CreateQhseObjectiveDto) {
    const id = newId();
    const nowIso = new Date().toISOString();
    const [row] = this.drizzle.db
      .insert(qhseObjectives)
      .values({
        id,
        tenantId: auth.tenantId!,
        category: dto.category,
        label: dto.label,
        target: dto.target,
        actual: dto.actual,
        unit: dto.unit,
        status: dto.status ?? 'GREEN',
        delta: dto.delta ?? null,
        trend: dto.trend ? JSON.stringify(dto.trend) : null,
        periodFrom: dto.periodFrom ?? null,
        periodTo: dto.periodTo ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .returning()
      .all();
    return row;
  }

  findAll(auth: AuthContext, query: { category?: string }) {
    const filters = [eq(qhseObjectives.tenantId, auth.tenantId!), isNull(qhseObjectives.deletedAt)];
    if (query.category) filters.push(eq(qhseObjectives.category, query.category as never));
    return this.drizzle.db
      .select()
      .from(qhseObjectives)
      .where(and(...filters))
      .orderBy(asc(qhseObjectives.category), asc(qhseObjectives.label))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(qhseObjectives)
      .where(
        and(
          eq(qhseObjectives.id, id),
          eq(qhseObjectives.tenantId, auth.tenantId!),
          isNull(qhseObjectives.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`QhseObjective ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateQhseObjectiveDto) {
    this.findOne(auth, id);
    const [row] = this.drizzle.db
      .update(qhseObjectives)
      .set({
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.target !== undefined && { target: dto.target }),
        ...(dto.actual !== undefined && { actual: dto.actual }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.delta !== undefined && { delta: dto.delta }),
        ...(dto.trend !== undefined && {
          trend: dto.trend === null ? null : JSON.stringify(dto.trend),
        }),
        ...(dto.periodFrom !== undefined && { periodFrom: dto.periodFrom }),
        ...(dto.periodTo !== undefined && { periodTo: dto.periodTo }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(qhseObjectives.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(qhseObjectives)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(qhseObjectives.id, id))
      .run();
  }
}
