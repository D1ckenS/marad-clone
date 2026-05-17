import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { certificates, certificateTypes } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateCertificateDto } from './dto/create-certificate.dto';
import type { UpdateCertificateDto } from './dto/update-certificate.dto';

const ENTITY_TYPE = 'Certificate';

@Injectable()
export class CertificateService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateCertificateDto) {
    const vesselId = dto.vesselId ?? requireVesselId(auth);
    const id = newId();
    const nowIso = new Date().toISOString();

    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId,
        certificateTypeId: dto.certificateTypeId,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
        number: dto.number ?? null,
        issuedAt: dto.issuedAt ?? null,
        expiresAt: dto.expiresAt ?? null,
        issuedBy: dto.issuedBy ?? null,
        notes: dto.notes ?? null,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .insert(certificates)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
          certificateTypeId: dto.certificateTypeId,
          subjectType: dto.subjectType,
          subjectId: dto.subjectId,
          number: dto.number ?? null,
          issuedAt: dto.issuedAt ?? null,
          expiresAt: dto.expiresAt ?? null,
          issuedBy: dto.issuedBy ?? null,
          notes: dto.notes ?? null,
          createdAt: nowIso,
          updatedAt: nowIso,
          hlc,
        })
        .returning()
        .all();
      return row;
    });
  }

  findAll(
    auth: AuthContext,
    query: { subjectType?: string; subjectId?: string; vesselId?: string },
  ) {
    const filters = [eq(certificates.tenantId, auth.tenantId), isNull(certificates.deletedAt)];
    if (query.vesselId) filters.push(eq(certificates.vesselId, query.vesselId));
    if (query.subjectType) {
      filters.push(
        eq(certificates.subjectType, query.subjectType as 'VESSEL' | 'COMPONENT' | 'CREW_MEMBER'),
      );
    }
    if (query.subjectId) filters.push(eq(certificates.subjectId, query.subjectId));

    return this.drizzle.db
      .select()
      .from(certificates)
      .where(and(...filters))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(certificates)
      .where(
        and(
          eq(certificates.id, id),
          eq(certificates.tenantId, auth.tenantId),
          isNull(certificates.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`Certificate ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateCertificateDto) {
    const existing = this.findOne(auth, id);
    const vesselId = existing.vesselId ?? requireVesselId(auth);

    return this.drizzle.db.transaction((tx) => {
      const fields = {
        ...(dto.number !== undefined && { number: dto.number }),
        ...(dto.issuedAt !== undefined && { issuedAt: dto.issuedAt }),
        ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt }),
        ...(dto.issuedBy !== undefined && { issuedBy: dto.issuedBy }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .update(certificates)
        .set({ ...fields, updatedAt: new Date().toISOString(), hlc })
        .where(eq(certificates.id, id))
        .returning()
        .all();
      return row;
    });
  }

  softDelete(auth: AuthContext, id: string) {
    const existing = this.findOne(auth, id);
    const vesselId = existing.vesselId ?? requireVesselId(auth);
    this.drizzle.db.transaction((tx) => {
      this.recorder.recordDelete(tx, { tenantId: auth.tenantId, vesselId }, ENTITY_TYPE, id);
      tx.update(certificates)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(certificates.id, id))
        .run();
    });
  }

  findCertificateTypes(auth: AuthContext) {
    return this.drizzle.db
      .select()
      .from(certificateTypes)
      .where(and(eq(certificateTypes.tenantId, auth.tenantId), isNull(certificateTypes.deletedAt)))
      .all();
  }
}
