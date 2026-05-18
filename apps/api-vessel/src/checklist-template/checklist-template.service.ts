import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { checklistTemplates } from '../db/schema';
import type {
  CreateChecklistTemplateDto,
  UpdateChecklistTemplateDto,
} from './dto/create-checklist-template.dto';

@Injectable()
export class ChecklistTemplateService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(auth: AuthContext, dto: CreateChecklistTemplateDto) {
    const nowIso = new Date().toISOString();
    const [row] = this.drizzle.db
      .insert(checklistTemplates)
      .values({
        id: newId(),
        tenantId: auth.tenantId,
        title: dto.title,
        description: dto.description ?? null,
        itemsJson: dto.itemsJson,
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
      .from(checklistTemplates)
      .where(
        and(eq(checklistTemplates.tenantId, auth.tenantId), isNull(checklistTemplates.deletedAt)),
      )
      .orderBy(checklistTemplates.title)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(checklistTemplates)
      .where(
        and(
          eq(checklistTemplates.id, id),
          eq(checklistTemplates.tenantId, auth.tenantId),
          isNull(checklistTemplates.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`ChecklistTemplate ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateChecklistTemplateDto) {
    this.findOne(auth, id);
    const fields: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (dto.title !== undefined) fields['title'] = dto.title;
    if (dto.description !== undefined) fields['description'] = dto.description;
    if (dto.itemsJson !== undefined) fields['itemsJson'] = dto.itemsJson;
    const [row] = this.drizzle.db
      .update(checklistTemplates)
      .set(fields as never)
      .where(eq(checklistTemplates.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(checklistTemplates)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(checklistTemplates.id, id))
      .run();
  }
}
