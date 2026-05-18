import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { checklistInstances } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type {
  CreateChecklistInstanceDto,
  SignChecklistItemDto,
  UpdateChecklistInstanceDto,
} from './dto/create-checklist-instance.dto';

const ENTITY = 'ChecklistInstance';

interface ItemResponse {
  itemId: string;
  text?: string;
  checked: boolean;
  signatureKey?: string | null;
  signedByUserId?: string | null;
  signedAt?: string | null;
}

@Injectable()
export class ChecklistInstanceService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateChecklistInstanceDto) {
    const vesselId = dto.vesselId ?? requireVesselId(auth);
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId,
        templateId: dto.templateId ?? null,
        title: dto.title,
        responsesJson: dto.responsesJson ?? '[]',
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .insert(checklistInstances)
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

  findAll(auth: AuthContext, query: { vesselId?: string; status?: string }) {
    const filters = [
      eq(checklistInstances.tenantId, auth.tenantId),
      isNull(checklistInstances.deletedAt),
    ];
    if (query.vesselId) filters.push(eq(checklistInstances.vesselId, query.vesselId));
    if (query.status) filters.push(eq(checklistInstances.status, query.status as never));
    return this.drizzle.db
      .select()
      .from(checklistInstances)
      .where(and(...filters))
      .orderBy(desc(checklistInstances.createdAt))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(checklistInstances)
      .where(
        and(
          eq(checklistInstances.id, id),
          eq(checklistInstances.tenantId, auth.tenantId),
          isNull(checklistInstances.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`ChecklistInstance ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateChecklistInstanceDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.title !== undefined) fields['title'] = dto.title;
    if (dto.status !== undefined) fields['status'] = dto.status;
    if (dto.responsesJson !== undefined) fields['responsesJson'] = dto.responsesJson;
    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: existing.vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(checklistInstances)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(checklistInstances.id, id))
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
      tx.update(checklistInstances)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(checklistInstances.id, id))
        .run();
    });
  }

  signItem(auth: AuthContext, id: string, dto: SignChecklistItemDto) {
    const instance = this.findOne(auth, id);
    if (instance.status === 'COMPLETED')
      throw new BadRequestException('Cannot modify a completed checklist');
    const responses: ItemResponse[] = JSON.parse(instance.responsesJson) as ItemResponse[];
    const idx = responses.findIndex((r) => r.itemId === dto.itemId);
    const entry: ItemResponse = {
      itemId: dto.itemId,
      checked: dto.checked ?? true,
      signatureKey: dto.signatureKey ?? null,
      signedByUserId: dto.signedByUserId,
      signedAt: dto.signedAt,
      ...(idx >= 0 && responses[idx]?.text !== undefined ? { text: responses[idx].text } : {}),
    };
    if (idx >= 0) responses[idx] = entry;
    else responses.push(entry);
    const updatedJson = JSON.stringify(responses);
    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: instance.vesselId },
        ENTITY,
        id,
        { responsesJson: updatedJson },
      );
      const [row] = tx
        .update(checklistInstances)
        .set({ responsesJson: updatedJson, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(checklistInstances.id, id))
        .returning()
        .all();
      return row;
    });
  }

  complete(auth: AuthContext, id: string) {
    const instance = this.findOne(auth, id);
    if (instance.status === 'COMPLETED') throw new BadRequestException('Already completed');
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: instance.vesselId },
        ENTITY,
        id,
        { status: 'COMPLETED', completedAt: nowIso },
      );
      const [row] = tx
        .update(checklistInstances)
        .set({ status: 'COMPLETED', completedAt: nowIso, updatedAt: nowIso, hlc } as never)
        .where(eq(checklistInstances.id, id))
        .returning()
        .all();
      return row;
    });
  }
}
