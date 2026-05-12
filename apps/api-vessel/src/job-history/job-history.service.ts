import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { jobHistories } from '../db/schema';

/**
 * Read-only on the vessel side: JobHistory rows are immutable in the DB
 * (BEFORE UPDATE trigger from P1-1) and creation comes via the sign-off
 * endpoint that lands in PR 4 with multipart photo upload.
 */
@Injectable()
export class JobHistoryService {
  constructor(private readonly drizzle: DrizzleService) {}

  findAll(auth: AuthContext, jobInstanceId?: string) {
    const vesselId = requireVesselId(auth);
    const conds = [
      eq(jobHistories.tenantId, auth.tenantId),
      eq(jobHistories.vesselId, vesselId),
      isNull(jobHistories.deletedAt),
    ];
    if (jobInstanceId !== undefined) conds.push(eq(jobHistories.jobInstanceId, jobInstanceId));
    return this.drizzle.db
      .select()
      .from(jobHistories)
      .where(and(...conds))
      .orderBy(desc(jobHistories.completedAt))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = this.drizzle.db
      .select()
      .from(jobHistories)
      .where(
        and(
          eq(jobHistories.id, id),
          eq(jobHistories.tenantId, auth.tenantId),
          eq(jobHistories.vesselId, vesselId),
          isNull(jobHistories.deletedAt),
        ),
      )
      .get();
    if (row === undefined) throw new NotFoundException(`JobHistory ${id} not found`);
    return row;
  }
}
