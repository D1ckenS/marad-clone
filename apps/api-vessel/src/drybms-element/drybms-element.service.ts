import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { drybmsElements } from '../db/schema';
import type { CreateDrybmsElementDto, UpdateDrybmsElementDto } from './dto/drybms-element.dto';

@Injectable()
export class DrybmsElementService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(auth: AuthContext, dto: CreateDrybmsElementDto) {
    const id = newId();
    const nowIso = new Date().toISOString();
    const [row] = this.drizzle.db
      .insert(drybmsElements)
      .values({
        id,
        tenantId: auth.tenantId!,
        chapter: dto.chapter,
        chapterTitle: dto.chapterTitle,
        name: dto.name,
        score: dto.score ?? 1,
        stage: dto.stage ?? null,
        evidence: dto.evidence ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .returning()
      .all();
    return row;
  }

  findAll(auth: AuthContext, query: { chapter?: string }) {
    const filters = [eq(drybmsElements.tenantId, auth.tenantId!), isNull(drybmsElements.deletedAt)];
    if (query.chapter) filters.push(eq(drybmsElements.chapter, query.chapter));
    return this.drizzle.db
      .select()
      .from(drybmsElements)
      .where(and(...filters))
      .orderBy(asc(drybmsElements.chapter), asc(drybmsElements.name))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(drybmsElements)
      .where(
        and(
          eq(drybmsElements.id, id),
          eq(drybmsElements.tenantId, auth.tenantId!),
          isNull(drybmsElements.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`DrybmsElement ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateDrybmsElementDto) {
    this.findOne(auth, id);
    const [row] = this.drizzle.db
      .update(drybmsElements)
      .set({
        ...(dto.chapter !== undefined && { chapter: dto.chapter }),
        ...(dto.chapterTitle !== undefined && { chapterTitle: dto.chapterTitle }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.score !== undefined && { score: dto.score }),
        ...(dto.stage !== undefined && { stage: dto.stage }),
        ...(dto.evidence !== undefined && { evidence: dto.evidence }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(drybmsElements.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(drybmsElements)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(drybmsElements.id, id))
      .run();
  }
}
