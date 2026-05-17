import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { certificateTypes } from '../db/schema';
import type { CreateCertificateTypeDto } from './dto/create-certificate-type.dto';
import type { UpdateCertificateTypeDto } from './dto/update-certificate-type.dto';

@Injectable()
export class CertificateTypeService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(auth: AuthContext, dto: CreateCertificateTypeDto) {
    const nowIso = new Date().toISOString();
    const [row] = this.drizzle.db
      .insert(certificateTypes)
      .values({
        id: newId(),
        tenantId: auth.tenantId,
        name: dto.name,
        description: dto.description ?? null,
        alertDaysJson: dto.alertDays
          ? JSON.stringify(dto.alertDays)
          : JSON.stringify([90, 60, 30, 7]),
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
      .from(certificateTypes)
      .where(and(eq(certificateTypes.tenantId, auth.tenantId), isNull(certificateTypes.deletedAt)))
      .orderBy(certificateTypes.name)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(certificateTypes)
      .where(
        and(
          eq(certificateTypes.id, id),
          eq(certificateTypes.tenantId, auth.tenantId),
          isNull(certificateTypes.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`CertificateType ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateCertificateTypeDto) {
    this.findOne(auth, id);
    const [row] = this.drizzle.db
      .update(certificateTypes)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.alertDays !== undefined && { alertDaysJson: JSON.stringify(dto.alertDays) }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(certificateTypes.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(certificateTypes)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(certificateTypes.id, id))
      .run();
  }
}
