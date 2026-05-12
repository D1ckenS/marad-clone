import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateRunningHourReadingDto } from './dto/create-running-hour-reading.dto';

const ENTITY_TYPE = 'RunningHourReading';
const COMPONENT_ENTITY = 'Component';

/**
 * Append-only log of running-hour values per Component. Each insert also
 * advances the parent Component's `runningHours` counter (the latest reading
 * IS the current running-hours value), which is what the scheduler reads
 * to fire RH-interval Jobs. Both writes share one transaction + one outbox
 * row per entity so they commit together.
 *
 * Readings cannot decrease — running hours are monotonic per the maritime
 * domain (an engine doesn't "un-run").
 */
@Injectable()
export class RunningHourReadingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recorder: OutboxRecorder,
  ) {}

  async create(auth: AuthContext, dto: CreateRunningHourReadingDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    const value = new Prisma.Decimal(dto.value);

    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const component = await tx.component.findFirst({
        where: { id: dto.componentId, tenantId: auth.tenantId, vesselId, deletedAt: null },
      });
      if (component === null) {
        throw new NotFoundException(`Component ${dto.componentId} not found`);
      }
      if (value.lt(component.runningHours)) {
        throw new BadRequestException(
          `Reading ${dto.value} is below current running hours ${component.runningHours.toString()}`,
        );
      }

      const readingFields = {
        componentId: dto.componentId,
        value: dto.value,
        source: dto.source,
        recordedAt: dto.recordedAt,
        recordedByUserId: auth.userId,
        vesselId,
      };
      const { hlc: readingHlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        readingFields,
      );
      const reading = await tx.runningHourReading.create({
        data: {
          id,
          tenantId: auth.tenantId,
          vesselId,
          componentId: dto.componentId,
          value,
          source: dto.source,
          recordedAt: new Date(dto.recordedAt),
          recordedByUserId: auth.userId,
          hlc: readingHlc,
        },
      });

      // Bump the Component's runningHours counter — same outbox flow so
      // the vessel-side mirror stays consistent with the latest reading.
      const { hlc: compHlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        COMPONENT_ENTITY,
        component.id,
        { runningHours: dto.value },
      );
      await tx.component.update({
        where: { id: component.id },
        data: { runningHours: value, hlc: compHlc },
      });

      return reading;
    });
  }

  findAll(auth: AuthContext, componentId?: string) {
    const vesselId = requireVesselId(auth);
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.runningHourReading.findMany({
        where: {
          tenantId: auth.tenantId,
          vesselId,
          deletedAt: null,
          ...(componentId !== undefined && { componentId }),
        },
        orderBy: { recordedAt: 'desc' },
      }),
    );
  }
}
