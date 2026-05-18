import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { crewMembers } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateCrewMemberDto, UpdateCrewMemberDto } from './dto/create-crew-member.dto';

const ENTITY = 'CrewMember';

@Injectable()
export class CrewMemberService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateCrewMemberDto) {
    const vesselId = dto.vesselId ?? requireVesselId(auth);
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        rank: dto.rank,
        nationality: dto.nationality ?? null,
        dateOfBirth: dto.dateOfBirth ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        signOnDate: dto.signOnDate ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .insert(crewMembers)
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
    const filters = [eq(crewMembers.tenantId, auth.tenantId), isNull(crewMembers.deletedAt)];
    if (query.vesselId) filters.push(eq(crewMembers.vesselId, query.vesselId));
    if (query.status) filters.push(eq(crewMembers.status, query.status as never));
    return this.drizzle.db
      .select()
      .from(crewMembers)
      .where(and(...filters))
      .orderBy(crewMembers.lastName, crewMembers.firstName)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(crewMembers)
      .where(
        and(
          eq(crewMembers.id, id),
          eq(crewMembers.tenantId, auth.tenantId),
          isNull(crewMembers.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`CrewMember ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateCrewMemberDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.firstName !== undefined) fields['firstName'] = dto.firstName;
    if (dto.lastName !== undefined) fields['lastName'] = dto.lastName;
    if (dto.rank !== undefined) fields['rank'] = dto.rank;
    if (dto.nationality !== undefined) fields['nationality'] = dto.nationality;
    if (dto.email !== undefined) fields['email'] = dto.email;
    if (dto.phone !== undefined) fields['phone'] = dto.phone;
    if (dto.status !== undefined) fields['status'] = dto.status;
    if (dto.signOnDate !== undefined) fields['signOnDate'] = dto.signOnDate ?? null;
    if (dto.signOffDate !== undefined) fields['signOffDate'] = dto.signOffDate ?? null;
    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: existing.vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(crewMembers)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(crewMembers.id, id))
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
      tx.update(crewMembers)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(crewMembers.id, id))
        .run();
    });
  }
}
