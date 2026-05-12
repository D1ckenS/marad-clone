import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { SignOffJobInstanceDto } from './dto/sign-off-job-instance.dto';

const HISTORY_ENTITY = 'JobHistory';
const INSTANCE_ENTITY = 'JobInstance';

@Injectable()
export class JobHistoryService {
  private readonly log = new Logger(JobHistoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recorder: OutboxRecorder,
    private readonly storage: StorageService,
  ) {}

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

  /**
   * Sign-off flow:
   *   1. Validate the JobInstance is open (PENDING or IN_PROGRESS).
   *   2. Upload each photo to S3/MinIO; collect the keys. Failures abort
   *      before any DB write — uploads that succeeded but later abort
   *      become orphans (acceptable; periodic GC handles this).
   *   3. In one Prisma tx, INSERT JobHistory + UPDATE JobInstance.status
   *      to DONE. Both go through OutboxRecorder so the vessel mirror
   *      sees them with consistent HLCs.
   *
   * The P1-1 immutability trigger seals the JobHistory row immediately;
   * subsequent UPDATEs of business columns will abort at the DB.
   */
  async signOff(
    auth: AuthContext,
    jobInstanceId: string,
    dto: SignOffJobInstanceDto,
    photos: Express.Multer.File[],
  ) {
    const vesselId = requireVesselId(auth);

    const instance = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.jobInstance.findFirst({
        where: { id: jobInstanceId, tenantId: auth.tenantId, vesselId, deletedAt: null },
      }),
    );
    if (instance === null) {
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

    // 2. Upload photos first.
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

    const completedAt = new Date();
    const hoursWorked = dto.hoursWorked === undefined ? null : new Prisma.Decimal(dto.hoursWorked);

    // 3. Atomic DB write.
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const historyFields = {
        jobInstanceId,
        jobId: instance.jobId,
        componentId: instance.componentId,
        completedAt: completedAt.toISOString(),
        completedByUserId: auth.userId,
        hoursWorked: dto.hoursWorked ?? null,
        notes: dto.notes ?? null,
        signatureHash: dto.signatureHash ?? null,
        partsConsumed,
        photos: photoKeys,
        vesselId,
      };
      const { hlc: historyHlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        HISTORY_ENTITY,
        historyId,
        historyFields,
      );
      const history = await tx.jobHistory.create({
        data: {
          id: historyId,
          tenantId: auth.tenantId,
          vesselId,
          jobInstanceId,
          jobId: instance.jobId,
          componentId: instance.componentId,
          completedAt,
          completedByUserId: auth.userId,
          hoursWorked,
          notes: dto.notes ?? null,
          signatureHash: dto.signatureHash ?? null,
          partsConsumed:
            partsConsumed === null ? Prisma.JsonNull : (partsConsumed as Prisma.InputJsonValue),
          photos: photoKeys as unknown as Prisma.InputJsonValue,
          hlc: historyHlc,
        },
      });

      // Mark the JobInstance done in the same tx.
      const { hlc: instanceHlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        INSTANCE_ENTITY,
        jobInstanceId,
        { status: 'DONE' },
      );
      await tx.jobInstance.update({
        where: { id: jobInstanceId },
        data: { status: 'DONE', hlc: instanceHlc },
      });

      this.log.log(
        `signoff history=${historyId} instance=${jobInstanceId} tenant=${auth.tenantId} vessel=${vesselId} photos=${photoKeys.length}`,
      );
      return history;
    });
  }
}
