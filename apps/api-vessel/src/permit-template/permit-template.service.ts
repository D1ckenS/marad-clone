import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { permitTemplates } from '../db/schema';
import type {
  CreatePermitTemplateDto,
  UpdatePermitTemplateDto,
} from './dto/create-permit-template.dto';

@Injectable()
export class PermitTemplateService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(auth: AuthContext, dto: CreatePermitTemplateDto) {
    const id = newId();
    const nowIso = new Date().toISOString();
    const [row] = this.drizzle.db
      .insert(permitTemplates)
      .values({
        id,
        tenantId: auth.tenantId,
        permitType: dto.permitType,
        name: dto.name,
        checklistItemsJson: dto.checklistItemsJson ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .returning()
      .all();
    return row;
  }

  findAll(auth: AuthContext, permitType?: string) {
    const filters = [
      eq(permitTemplates.tenantId, auth.tenantId),
      isNull(permitTemplates.deletedAt),
    ];
    if (permitType) filters.push(eq(permitTemplates.permitType, permitType as never));
    return this.drizzle.db
      .select()
      .from(permitTemplates)
      .where(and(...filters))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(permitTemplates)
      .where(
        and(
          eq(permitTemplates.id, id),
          eq(permitTemplates.tenantId, auth.tenantId),
          isNull(permitTemplates.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`PermitTemplate ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdatePermitTemplateDto) {
    this.findOne(auth, id);
    const [row] = this.drizzle.db
      .update(permitTemplates)
      .set({
        ...(dto.permitType !== undefined && { permitType: dto.permitType }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.checklistItemsJson !== undefined && { checklistItemsJson: dto.checklistItemsJson }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(permitTemplates.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(permitTemplates)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(permitTemplates.id, id))
      .run();
  }
}
