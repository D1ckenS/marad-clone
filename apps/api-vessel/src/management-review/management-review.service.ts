import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { managementReviews } from '../db/schema';
import type {
  CreateManagementReviewDto,
  UpdateManagementReviewDto,
} from './dto/management-review.dto';

@Injectable()
export class ManagementReviewService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(auth: AuthContext, dto: CreateManagementReviewDto) {
    const id = newId();
    const nowIso = new Date().toISOString();
    const [row] = this.drizzle.db
      .insert(managementReviews)
      .values({
        id,
        tenantId: auth.tenantId!,
        kind: dto.kind,
        scheduledAt: dto.scheduledAt,
        chair: dto.chair,
        attendees: dto.attendees ?? 0,
        status: dto.status ?? 'SCHEDULED',
        actionsTotal: dto.actionsTotal ?? 0,
        actionsDone: dto.actionsDone ?? 0,
        summary: dto.summary ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .returning()
      .all();
    return row;
  }

  findAll(auth: AuthContext, query: { status?: string }) {
    const filters = [
      eq(managementReviews.tenantId, auth.tenantId!),
      isNull(managementReviews.deletedAt),
    ];
    if (query.status) filters.push(eq(managementReviews.status, query.status as never));
    return this.drizzle.db
      .select()
      .from(managementReviews)
      .where(and(...filters))
      .orderBy(desc(managementReviews.scheduledAt))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(managementReviews)
      .where(
        and(
          eq(managementReviews.id, id),
          eq(managementReviews.tenantId, auth.tenantId!),
          isNull(managementReviews.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`ManagementReview ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateManagementReviewDto) {
    this.findOne(auth, id);
    const [row] = this.drizzle.db
      .update(managementReviews)
      .set({
        ...(dto.kind !== undefined && { kind: dto.kind }),
        ...(dto.scheduledAt !== undefined && { scheduledAt: dto.scheduledAt }),
        ...(dto.chair !== undefined && { chair: dto.chair }),
        ...(dto.attendees !== undefined && { attendees: dto.attendees }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.actionsTotal !== undefined && { actionsTotal: dto.actionsTotal }),
        ...(dto.actionsDone !== undefined && { actionsDone: dto.actionsDone }),
        ...(dto.summary !== undefined && { summary: dto.summary }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(managementReviews.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(managementReviews)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(managementReviews.id, id))
      .run();
  }
}
