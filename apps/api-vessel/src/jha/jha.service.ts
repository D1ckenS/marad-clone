import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { jhas } from '../db/schema';
import type { CreateJhaDto, UpdateJhaDto } from './dto/jha.dto';

@Injectable()
export class JhaService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(auth: AuthContext, dto: CreateJhaDto) {
    const id = newId();
    const nowIso = new Date().toISOString();
    const [row] = this.drizzle.db
      .insert(jhas)
      .values({
        id,
        tenantId: auth.tenantId!,
        ref: dto.ref,
        title: dto.title,
        activity: dto.activity ?? null,
        hazards: JSON.stringify(dto.hazards),
        controls: JSON.stringify(dto.controls),
        residualL: dto.residualL ?? 1,
        residualS: dto.residualS ?? 1,
        reviewedAt: dto.reviewedAt ?? null,
        reviewedBy: dto.reviewedBy ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .returning()
      .all();
    return row;
  }

  findAll(auth: AuthContext) {
    return this.drizzle.db
      .select()
      .from(jhas)
      .where(and(eq(jhas.tenantId, auth.tenantId!), isNull(jhas.deletedAt)))
      .orderBy(asc(jhas.ref))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(jhas)
      .where(and(eq(jhas.id, id), eq(jhas.tenantId, auth.tenantId!), isNull(jhas.deletedAt)))
      .get();
    if (!row) throw new NotFoundException(`JHA ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateJhaDto) {
    this.findOne(auth, id);
    const [row] = this.drizzle.db
      .update(jhas)
      .set({
        ...(dto.ref !== undefined && { ref: dto.ref }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.activity !== undefined && { activity: dto.activity }),
        ...(dto.hazards !== undefined && { hazards: JSON.stringify(dto.hazards) }),
        ...(dto.controls !== undefined && { controls: JSON.stringify(dto.controls) }),
        ...(dto.residualL !== undefined && { residualL: dto.residualL }),
        ...(dto.residualS !== undefined && { residualS: dto.residualS }),
        ...(dto.reviewedAt !== undefined && { reviewedAt: dto.reviewedAt }),
        ...(dto.reviewedBy !== undefined && { reviewedBy: dto.reviewedBy }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(jhas.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(jhas)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(jhas.id, id))
      .run();
  }
}
