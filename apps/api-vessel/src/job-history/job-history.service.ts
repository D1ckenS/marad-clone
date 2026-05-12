import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { jobHistories, jobInstances } from '../db/schema';
import { StorageService } from '../storage/storage.service';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { SignOffJobInstanceDto } from './dto/sign-off-job-instance.dto';

const HISTORY_ENTITY = 'JobHistory';
const INSTANCE_ENTITY = 'JobInstance';

type JobHistoryRow = typeof jobHistories.$inferSelect;

/**
 * Decodes the TEXT-stored JSON columns (`photos`, `partsConsumed`) into
 * real JS values so HTTP callers see the same shape as the shore API
 * (where Prisma auto-marshals JSON columns). Returned object keeps every
 * other column untouched.
 */
function deserialize(row: JobHistoryRow): Omit<JobHistoryRow, 'photos' | 'partsConsumed'> & {
  photos: unknown;
  partsConsumed: unknown;
} {
  return {
    ...row,
    photos: row.photos === null ? null : (JSON.parse(row.photos) as unknown),
    partsConsumed: row.partsConsumed === null ? null : (JSON.parse(row.partsConsumed) as unknown),
  };
}

@Injectable()
export class JobHistoryService {
  private readonly log = new Logger(JobHistoryService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
    private readonly storage: StorageService,
  ) {}

  findAll(auth: AuthContext, jobInstanceId?: string) {
    const vesselId = requireVesselId(auth);
    const conds = [
      eq(jobHistories.tenantId, auth.tenantId),
      eq(jobHistories.vesselId, vesselId),
      isNull(jobHistories.deletedAt),
    ];
    if (jobInstanceId !== undefined) conds.push(eq(jobHistories.jobInstanceId, jobInstanceId));
    const rows = this.drizzle.db
      .select()
      .from(jobHistories)
      .where(and(...conds))
      .orderBy(desc(jobHistories.completedAt))
      .all();
    return rows.map(deserialize);
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
    return deserialize(row);
  }

  /**
   * Sign-off flow (mirror of shore):
   *   1. Validate JobInstance is open (not DONE).
   *   2. Upload photos to S3/MinIO; collect keys. Failures abort before
   *      any DB write — uploaded-but-aborted bytes become orphans
   *      (acceptable; production GC is a separate concern).
   *   3. In one Drizzle tx, INSERT JobHistory + UPDATE JobInstance.status
   *      to DONE. Both go through OutboxRecorder so the shore mirror sees
   *      them with consistent HLCs. The P1-1 immutability trigger then
   *      seals the JobHistory row.
   *
   * Photo upload is async (S3 client), but better-sqlite3 transactions
   * are sync — we do all uploads first, then enter the sync tx with
   * photo keys already in hand.
   */
  async signOff(
    auth: AuthContext,
    jobInstanceId: string,
    dto: SignOffJobInstanceDto,
    photos: Express.Multer.File[],
  ) {
    const vesselId = requireVesselId(auth);

    const instance = this.drizzle.db
      .select()
      .from(jobInstances)
      .where(
        and(
          eq(jobInstances.id, jobInstanceId),
          eq(jobInstances.tenantId, auth.tenantId),
          eq(jobInstances.vesselId, vesselId),
          isNull(jobInstances.deletedAt),
        ),
      )
      .get();
    if (instance === undefined) {
      throw new NotFoundException(`JobInstance ${jobInstanceId} not found`);
    }
    if (instance.status === 'DONE') {
      throw new ConflictException('JobInstance is already signed off');
    }

    let partsConsumed: unknown = null;
    if (dto.partsConsumedJson !== undefined && dto.partsConsumedJson !== '') {
      try {
        partsConsumed = JSON.parse(dto.partsConsumedJson);
      } catch {
        throw new BadRequestException('partsConsumedJson is not valid JSON');
      }
    }

    const historyId = newId();
    const photoKeys: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const file = photos[i]!;
      const key = await this.storage.putJobHistoryPhoto(
        { tenantId: auth.tenantId, vesselId, jobHistoryId: historyId },
        i,
        file,
      );
      photoKeys.push(key);
    }

    const completedAtIso = new Date().toISOString();

    return this.drizzle.db.transaction((tx) => {
      const historyFields = {
        jobInstanceId,
        jobId: instance.jobId,
        componentId: instance.componentId,
        completedAt: completedAtIso,
        completedByUserId: auth.userId,
        hoursWorked: dto.hoursWorked ?? null,
        notes: dto.notes ?? null,
        signatureHash: dto.signatureHash ?? null,
        partsConsumed,
        photos: photoKeys,
        vesselId,
      };
      const { hlc: historyHlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        HISTORY_ENTITY,
        historyId,
        historyFields,
      );
      const [history] = tx
        .insert(jobHistories)
        .values({
          id: historyId,
          tenantId: auth.tenantId,
          vesselId,
          jobInstanceId,
          jobId: instance.jobId,
          componentId: instance.componentId,
          completedAt: completedAtIso,
          completedByUserId: auth.userId,
          hoursWorked: dto.hoursWorked ?? null,
          notes: dto.notes ?? null,
          signatureHash: dto.signatureHash ?? null,
          partsConsumed: partsConsumed === null ? null : JSON.stringify(partsConsumed),
          photos: JSON.stringify(photoKeys),
          hlc: historyHlc,
        })
        .returning()
        .all();

      const { hlc: instanceHlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        INSTANCE_ENTITY,
        jobInstanceId,
        { status: 'DONE' },
      );
      tx.update(jobInstances)
        .set({ status: 'DONE', hlc: instanceHlc, updatedAt: new Date().toISOString() })
        .where(eq(jobInstances.id, jobInstanceId))
        .run();

      this.log.log(
        `signoff history=${historyId} instance=${jobInstanceId} tenant=${auth.tenantId} vessel=${vesselId} photos=${photoKeys.length}`,
      );
      return history === undefined ? null : deserialize(history);
    });
  }
}
