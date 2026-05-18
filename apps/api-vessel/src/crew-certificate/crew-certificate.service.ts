import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { crewCertificates } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type {
  CreateCrewCertificateDto,
  UpdateCrewCertificateDto,
} from './dto/create-crew-certificate.dto';

const ENTITY = 'CrewCertificate';

@Injectable()
export class CrewCertificateService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateCrewCertificateDto) {
    const vesselId = dto.vesselId ?? requireVesselId(auth);
    const id = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId,
        crewMemberId: dto.crewMemberId,
        certificateType: dto.certificateType,
        number: dto.number ?? null,
        issuedAt: dto.issuedAt ?? null,
        expiresAt: dto.expiresAt ?? null,
        issuedBy: dto.issuedBy ?? null,
        notes: dto.notes ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .insert(crewCertificates)
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

  findAll(auth: AuthContext, query: { vesselId?: string; crewMemberId?: string }) {
    const filters = [
      eq(crewCertificates.tenantId, auth.tenantId),
      isNull(crewCertificates.deletedAt),
    ];
    if (query.vesselId) filters.push(eq(crewCertificates.vesselId, query.vesselId));
    if (query.crewMemberId) filters.push(eq(crewCertificates.crewMemberId, query.crewMemberId));
    return this.drizzle.db
      .select()
      .from(crewCertificates)
      .where(and(...filters))
      .orderBy(crewCertificates.expiresAt)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(crewCertificates)
      .where(
        and(
          eq(crewCertificates.id, id),
          eq(crewCertificates.tenantId, auth.tenantId),
          isNull(crewCertificates.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`CrewCertificate ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateCrewCertificateDto) {
    const existing = this.findOne(auth, id);
    const fields: Record<string, unknown> = {};
    if (dto.certificateType !== undefined) fields['certificateType'] = dto.certificateType;
    if (dto.number !== undefined) fields['number'] = dto.number;
    if (dto.issuedAt !== undefined) fields['issuedAt'] = dto.issuedAt ?? null;
    if (dto.expiresAt !== undefined) fields['expiresAt'] = dto.expiresAt ?? null;
    if (dto.issuedBy !== undefined) fields['issuedBy'] = dto.issuedBy;
    if (dto.notes !== undefined) fields['notes'] = dto.notes;
    return this.drizzle.db.transaction((tx) => {
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId: existing.vesselId },
        ENTITY,
        id,
        fields,
      );
      const [row] = tx
        .update(crewCertificates)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc } as never)
        .where(eq(crewCertificates.id, id))
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
      tx.update(crewCertificates)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(crewCertificates.id, id))
        .run();
    });
  }
}
