import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { and, eq, isNull } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { partCategories } from '../db/schema';
import type { CreatePartCategoryDto } from './dto/create-part-category.dto';
import type { UpdatePartCategoryDto } from './dto/update-part-category.dto';

@Injectable()
export class PartCategoryService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(auth: AuthContext, dto: CreatePartCategoryDto) {
    const [row] = this.drizzle.db
      .insert(partCategories)
      .values({
        id: newId(),
        tenantId: auth.tenantId,
        name: dto.name,
        description: dto.description ?? null,
        parentId: dto.parentId ?? null,
      })
      .returning()
      .all();
    return row;
  }

  findAll(auth: AuthContext) {
    return this.drizzle.db
      .select()
      .from(partCategories)
      .where(and(eq(partCategories.tenantId, auth.tenantId), isNull(partCategories.deletedAt)))
      .orderBy(partCategories.name)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(partCategories)
      .where(
        and(
          eq(partCategories.id, id),
          eq(partCategories.tenantId, auth.tenantId),
          isNull(partCategories.deletedAt),
        ),
      )
      .get();
    if (row === undefined) throw new NotFoundException(`PartCategory ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdatePartCategoryDto) {
    this.findOne(auth, id);
    const [row] = this.drizzle.db
      .update(partCategories)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(partCategories.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(partCategories)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(partCategories.id, id))
      .run();
  }
}
