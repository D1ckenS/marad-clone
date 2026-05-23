import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { conditionsOfClass } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type {
  CreateConditionOfClassDto,
  UpdateConditionOfClassDto,
} from './dto/condition-of-class.dto';

const ENTITY = 'ConditionOfClass';

@Injectable()
export class ConditionOfClassService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateConditionOfClassDto) {
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const syncFields = {
        vesselId: dto.vesselId,
        severity: dto.severity,
        title: dto.title,
        detail: dto.detail,
        raisedAt: dto.raisedAt,
        openedAt: dto.openedAt,
        dueAt: dto.dueAt ?? null,
        closedAt: dto.closedAt ?? null,
        linkedCertificateId: dto.linkedCertificateId ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId!, vesselId: dto.vesselId },
        ENTITY,
        id,
        syncFields,
      );
      const [row] = tx
        .insert(conditionsOfClass)
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

  findAll(auth: AuthContext, query: { vesselId?: string; severity?: string }) {
    const filters = [
      eq(conditionsOfClass.tenantId, auth.tenantId!),
      isNull(conditionsOfClass.deletedAt),
    ];
    if (query.vesselId) filters.push(eq(conditionsOfClass.vesselId, query.vesselId));
    if (query.severity) filters.push(eq(conditionsOfClass.severity, query.severity as never));
    return this.drizzle.db
      .select()
      .from(conditionsOfClass)
      .where(and(...filters))
      .orderBy(desc(conditionsOfClass.raisedAt))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(conditionsOfClass)
      .where(
        and(
          eq(conditionsOfClass.id, id),
          eq(conditionsOfClass.tenantId, auth.tenantId!),
          isNull(conditionsOfClass.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`ConditionOfClass ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateConditionOfClassDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.severity !== undefined) fields['severity'] = dto.severity;
    if (dto.title !== undefined) fields['title'] = dto.title;
    if (dto.detail !== undefined) fields['detail'] = dto.detail;
    if (dto.raisedAt !== undefined) fields['raisedAt'] = dto.raisedAt;
    if (dto.openedAt !== undefined) fields['openedAt'] = dto.openedAt;
    if (dto.dueAt !== undefined) fields['dueAt'] = dto.dueAt;
    if (dto.closedAt !== undefined) fields['closedAt'] = dto.closedAt;
    if (dto.linkedCertificateId !== undefined)
      fields['linkedCertificateId'] = dto.linkedCertificateId;

    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId!, vesselId: existing.vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(conditionsOfClass)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(conditionsOfClass.id, id))
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
      tx.update(conditionsOfClass)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(conditionsOfClass.id, id))
        .run();
    });
  }
}
