import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { permitApprovals, workPermits } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type {
  AddPermitApprovalDto,
  CreateWorkPermitDto,
  UpdateWorkPermitDto,
} from './dto/create-work-permit.dto';

const WP_ENTITY = 'WorkPermit';
const WPA_ENTITY = 'PermitApproval';

type ChecklistItem = { itemId: string; description: string; checked: boolean; required?: boolean };

@Injectable()
export class WorkPermitService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateWorkPermitDto) {
    const vesselId = dto.vesselId ?? requireVesselId(auth);
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId,
        permitType: dto.permitType,
        templateId: dto.templateId ?? null,
        title: dto.title,
        location: dto.location ?? null,
        workDescription: dto.workDescription ?? null,
        requestedByUserId: dto.requestedByUserId ?? null,
        validFrom: dto.validFrom ?? null,
        validUntil: dto.validUntil ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        WP_ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .insert(workPermits)
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

  findAll(auth: AuthContext, query: { status?: string; vesselId?: string; permitType?: string }) {
    const filters = [eq(workPermits.tenantId, auth.tenantId), isNull(workPermits.deletedAt)];
    if (query.vesselId) filters.push(eq(workPermits.vesselId, query.vesselId));
    if (query.status) filters.push(eq(workPermits.status, query.status as never));
    if (query.permitType) filters.push(eq(workPermits.permitType, query.permitType as never));
    return this.drizzle.db
      .select()
      .from(workPermits)
      .where(and(...filters))
      .orderBy(desc(workPermits.createdAt))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(workPermits)
      .where(
        and(
          eq(workPermits.id, id),
          eq(workPermits.tenantId, auth.tenantId),
          isNull(workPermits.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`WorkPermit ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateWorkPermitDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.title !== undefined) fields['title'] = dto.title;
    if (dto.location !== undefined) fields['location'] = dto.location;
    if (dto.workDescription !== undefined) fields['workDescription'] = dto.workDescription;
    if (dto.validFrom !== undefined) fields['validFrom'] = dto.validFrom;
    if (dto.validUntil !== undefined) fields['validUntil'] = dto.validUntil;
    if (dto.riskAssessmentJson !== undefined) fields['riskAssessmentJson'] = dto.riskAssessmentJson;
    if (dto.gasTestJson !== undefined) fields['gasTestJson'] = dto.gasTestJson;
    if (dto.hazardsJson !== undefined) fields['hazardsJson'] = dto.hazardsJson;

    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: existing.vesselId },
        WP_ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(workPermits)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(workPermits.id, id))
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
        WP_ENTITY,
        id,
      );
      tx.update(workPermits)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(workPermits.id, id))
        .run();
    });
  }

  private transition(
    auth: AuthContext,
    id: string,
    from: string,
    to: string,
    extra: Record<string, unknown> = {},
  ) {
    const permit = this.findOne(auth, id);
    if (permit.status !== from)
      throw new BadRequestException(`Cannot transition from ${permit.status} to ${to}`);
    return this.drizzle.db.transaction((tx) => {
      const fields = { status: to, ...extra };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: permit.vesselId },
        WP_ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(workPermits)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(workPermits.id, id))
        .returning()
        .all();
      return row;
    });
  }

  approve(auth: AuthContext, id: string) {
    return this.transition(auth, id, 'REQUESTED', 'APPROVED');
  }

  activate(auth: AuthContext, id: string) {
    const permit = this.findOne(auth, id);
    if (permit.status !== 'APPROVED')
      throw new BadRequestException(`Cannot activate permit in status ${permit.status}`);
    if (permit.permitType === 'HOT_WORK') {
      if (!permit.riskAssessmentJson) {
        throw new BadRequestException(
          'HOT_WORK permit requires a completed risk assessment before activation',
        );
      }
      const items: ChecklistItem[] = JSON.parse(permit.riskAssessmentJson) as ChecklistItem[];
      const incomplete = items.filter((i) => i.required !== false && !i.checked);
      if (incomplete.length > 0) {
        throw new BadRequestException(
          `HOT_WORK permit has ${incomplete.length} required risk assessment item(s) not yet checked`,
        );
      }
    }
    return this.transition(auth, id, 'APPROVED', 'ACTIVE');
  }

  close(auth: AuthContext, id: string) {
    return this.transition(auth, id, 'ACTIVE', 'CLOSED', { closedAt: new Date().toISOString() });
  }

  cancel(auth: AuthContext, id: string) {
    const permit = this.findOne(auth, id);
    if (permit.status === 'CLOSED' || permit.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel permit in status ${permit.status}`);
    }
    return this.drizzle.db.transaction((tx) => {
      const fields = { status: 'CANCELLED' };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: permit.vesselId },
        WP_ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(workPermits)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(workPermits.id, id))
        .returning()
        .all();
      return row;
    });
  }

  addApproval(auth: AuthContext, permitId: string, dto: AddPermitApprovalDto) {
    const permit = this.findOne(auth, permitId);
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId: permit.vesselId,
        permitId,
        approvedBy: dto.approvedBy,
        role: dto.role,
        approvedAt: nowIso,
        signatureHash: dto.signatureHash ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: permit.vesselId },
        WPA_ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .insert(permitApprovals)
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

  findApprovals(auth: AuthContext, permitId: string) {
    this.findOne(auth, permitId);
    return this.drizzle.db
      .select()
      .from(permitApprovals)
      .where(
        and(
          eq(permitApprovals.permitId, permitId),
          eq(permitApprovals.tenantId, auth.tenantId),
          isNull(permitApprovals.deletedAt),
        ),
      )
      .all();
  }
}
