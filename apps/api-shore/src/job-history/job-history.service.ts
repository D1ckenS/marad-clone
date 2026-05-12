import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Read-only service for now: JobHistory rows are immutable in the DB
 * (BEFORE UPDATE trigger from P1-1). Creation happens through the
 * sign-off endpoint that lands in PR 4 (P1-2d), where multipart photo
 * upload + S3 storage is wired up.
 */
@Injectable()
export class JobHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(auth: AuthContext, jobInstanceId?: string) {
    const vesselId = requireVesselId(auth);
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.jobHistory.findMany({
        where: {
          tenantId: auth.tenantId,
          vesselId,
          deletedAt: null,
          ...(jobInstanceId !== undefined && { jobInstanceId }),
        },
        orderBy: { completedAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.jobHistory.findFirst({
        where: { id, tenantId: auth.tenantId, vesselId, deletedAt: null },
      }),
    );
    if (row === null) throw new NotFoundException(`JobHistory ${id} not found`);
    return row;
  }
}
