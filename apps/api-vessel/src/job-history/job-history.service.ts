import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import {
  jobHistories,
  jobInstances,
  parts,
  requisitionLines,
  requisitions,
  stockLevels,
  stockMovements,
} from '../db/schema';
import { StorageService } from '../storage/storage.service';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { SignOffJobInstanceDto } from './dto/sign-off-job-instance.dto';

const HISTORY_ENTITY = 'JobHistory';
const INSTANCE_ENTITY = 'JobInstance';

interface PartConsumed {
  partId: string;
  locationId: string;
  quantity: string;
}

function extractValidConsumed(val: unknown): PartConsumed[] {
  if (!Array.isArray(val)) return [];
  return val.filter((item): item is PartConsumed => {
    if (typeof item !== 'object' || item === null) return false;
    const o = item as Record<string, unknown>;
    return (
      typeof o['partId'] === 'string' &&
      o['partId'] !== '' &&
      typeof o['locationId'] === 'string' &&
      o['locationId'] !== '' &&
      typeof o['quantity'] === 'string' &&
      o['quantity'] !== ''
    );
  });
}

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

      // P1-10: consume parts → StockMovements → reorder check → draft Requisition
      const consumed = extractValidConsumed(partsConsumed);
      if (consumed.length > 0) {
        for (const item of consumed) {
          const movId = newId();
          const negQty = String(-parseFloat(item.quantity));
          const { hlc: movHlc } = this.recorder.recordUpsert(
            tx,
            { tenantId: auth.tenantId, vesselId },
            'StockMovement',
            movId,
            {
              vesselId,
              partId: item.partId,
              locationId: item.locationId,
              movementType: 'CONSUMPTION',
              quantity: negQty,
              referenceType: 'JobHistory',
              referenceId: historyId,
              recordedAt: completedAtIso,
            },
          );
          tx.insert(stockMovements)
            .values({
              id: movId,
              tenantId: auth.tenantId,
              vesselId,
              partId: item.partId,
              locationId: item.locationId,
              movementType: 'CONSUMPTION',
              quantity: negQty,
              referenceType: 'JobHistory',
              referenceId: historyId,
              recordedAt: completedAtIso,
              hlc: movHlc,
            })
            .run();
        }

        const checkedKeys = new Set<string>();
        const reorderTriggers: Array<{ partId: string; locationId: string; qty: string }> = [];

        for (const item of consumed) {
          const key = `${item.partId}:${item.locationId}`;
          if (checkedKeys.has(key)) continue;
          checkedKeys.add(key);

          const robRow = tx
            .select({
              rob: sql<string>`COALESCE(SUM(CAST(${stockMovements.quantity} AS REAL)), 0)`,
            })
            .from(stockMovements)
            .where(
              and(
                eq(stockMovements.tenantId, auth.tenantId),
                eq(stockMovements.vesselId, vesselId),
                eq(stockMovements.partId, item.partId),
                eq(stockMovements.locationId, item.locationId),
                isNull(stockMovements.deletedAt),
              ),
            )
            .get();
          const rob = parseFloat(robRow?.rob ?? '0');

          const level = tx
            .select()
            .from(stockLevels)
            .where(
              and(
                eq(stockLevels.tenantId, auth.tenantId),
                eq(stockLevels.vesselId, vesselId),
                eq(stockLevels.partId, item.partId),
                eq(stockLevels.locationId, item.locationId),
                isNull(stockLevels.deletedAt),
              ),
            )
            .get();

          if (level?.reorderPoint != null) {
            const reorder = parseFloat(level.reorderPoint);
            if (rob <= reorder) {
              const deficit = reorder - rob;
              reorderTriggers.push({
                partId: item.partId,
                locationId: item.locationId,
                qty: String(Math.max(deficit, 1)),
              });
            }
          }
        }

        if (reorderTriggers.length > 0) {
          const reqId = newId();
          const reqTitle = `Restock — job sign-off ${jobInstanceId}`;
          const { hlc: reqHlc } = this.recorder.recordUpsert(
            tx,
            { tenantId: auth.tenantId, vesselId },
            'Requisition',
            reqId,
            { vesselId, title: reqTitle, status: 'DRAFT', requestedAt: completedAtIso },
          );
          tx.insert(requisitions)
            .values({
              id: reqId,
              tenantId: auth.tenantId,
              vesselId,
              title: reqTitle,
              status: 'DRAFT',
              totalAmount: '0',
              currency: 'USD',
              requestedByUserId: auth.userId ?? null,
              requestedAt: completedAtIso,
              hlc: reqHlc,
            })
            .run();

          for (const trigger of reorderTriggers) {
            const partRow = tx
              .select({ name: parts.name, unit: parts.unit })
              .from(parts)
              .where(and(eq(parts.id, trigger.partId), eq(parts.tenantId, auth.tenantId)))
              .get();
            const lineId = newId();
            const description = partRow?.name ?? trigger.partId;
            const { hlc: lineHlc } = this.recorder.recordUpsert(
              tx,
              { tenantId: auth.tenantId, vesselId },
              'RequisitionLine',
              lineId,
              {
                vesselId,
                requisitionId: reqId,
                partId: trigger.partId,
                description,
                quantity: trigger.qty,
              },
            );
            tx.insert(requisitionLines)
              .values({
                id: lineId,
                tenantId: auth.tenantId,
                vesselId,
                requisitionId: reqId,
                partId: trigger.partId,
                description,
                quantity: trigger.qty,
                unit: partRow?.unit ?? 'pcs',
                hlc: lineHlc,
              })
              .run();
          }

          this.log.log(
            `reorder-suggest req=${reqId} triggers=${reorderTriggers.length} instance=${jobInstanceId}`,
          );
        }
      }

      return history === undefined ? null : deserialize(history);
    });
  }
}
