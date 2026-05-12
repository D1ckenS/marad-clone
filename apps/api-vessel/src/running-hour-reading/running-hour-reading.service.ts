import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { checkRunningHourThresholds, newId } from '@fleetops/domain';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { components, jobInstances, jobs, runningHourReadings } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateRunningHourReadingDto } from './dto/create-running-hour-reading.dto';

const ENTITY_TYPE = 'RunningHourReading';
const COMPONENT_ENTITY = 'Component';

/**
 * Append-only log of running-hour values per Component. Each insert also
 * advances the parent Component's `runningHours` counter — readings cannot
 * decrease (engines don't un-run).
 */
@Injectable()
export class RunningHourReadingService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateRunningHourReadingDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();

    return this.drizzle.db.transaction((tx) => {
      const component = tx
        .select()
        .from(components)
        .where(
          and(
            eq(components.id, dto.componentId),
            eq(components.tenantId, auth.tenantId),
            eq(components.vesselId, vesselId),
            isNull(components.deletedAt),
          ),
        )
        .get();
      if (component === undefined) {
        throw new NotFoundException(`Component ${dto.componentId} not found`);
      }
      // SQLite stores numeric as TEXT; compare as floats. Acceptable for
      // running hours (≤ 7 sig fig) — full Decimal comparison waits until
      // we have a need (P3 fuel/quantity work).
      if (Number(dto.value) < Number(component.runningHours)) {
        throw new BadRequestException(
          `Reading ${dto.value} is below current running hours ${component.runningHours}`,
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
      const { hlc: readingHlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        readingFields,
      );
      const [reading] = tx
        .insert(runningHourReadings)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
          componentId: dto.componentId,
          value: dto.value,
          source: dto.source,
          recordedAt: dto.recordedAt,
          recordedByUserId: auth.userId,
          hlc: readingHlc,
        })
        .returning()
        .all();

      // Bump the Component's runningHours counter.
      const { hlc: compHlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        COMPONENT_ENTITY,
        component.id,
        { runningHours: dto.value },
      );
      tx.update(components)
        .set({ runningHours: dto.value, hlc: compHlc, updatedAt: new Date().toISOString() })
        .where(eq(components.id, component.id))
        .run();

      // Running-hour interval scheduling: open a new JobInstance for every
      // interval boundary the reading crosses.
      const rhJobs = tx
        .select({ id: jobs.id, intervalRunningHours: jobs.intervalRunningHours })
        .from(jobs)
        .where(
          and(
            eq(jobs.componentId, component.id),
            eq(jobs.tenantId, auth.tenantId),
            eq(jobs.vesselId, vesselId),
            isNull(jobs.deletedAt),
            isNotNull(jobs.intervalRunningHours),
          ),
        )
        .all();

      const prevHours = Number(component.runningHours);
      const newHoursNum = Number(dto.value);

      for (const job of rhJobs) {
        const thresholds = checkRunningHourThresholds({
          intervalHours: Number(job.intervalRunningHours),
          prevHours,
          newHours: newHoursNum,
        });

        for (const threshold of thresholds) {
          const thresholdStr = threshold.toString();
          // Idempotency: skip if a JobInstance already exists at this threshold.
          const existing = tx
            .select({ id: jobInstances.id })
            .from(jobInstances)
            .where(
              and(
                eq(jobInstances.jobId, job.id),
                eq(jobInstances.tenantId, auth.tenantId),
                eq(jobInstances.dueAtRunningHours, thresholdStr),
                isNull(jobInstances.deletedAt),
              ),
            )
            .get();
          if (existing !== undefined) continue;

          const iid = newId();
          const { hlc: ihlc } = this.recorder.recordUpsert(
            tx,
            { tenantId: auth.tenantId, vesselId },
            'JobInstance',
            iid,
            {
              jobId: job.id,
              componentId: component.id,
              status: 'PENDING',
              dueAtRunningHours: thresholdStr,
              vesselId,
            },
          );
          tx.insert(jobInstances)
            .values({
              id: iid,
              tenantId: auth.tenantId,
              vesselId,
              jobId: job.id,
              componentId: component.id,
              status: 'PENDING',
              dueAtRunningHours: thresholdStr,
              hlc: ihlc,
            })
            .run();
        }
      }

      return reading;
    });
  }

  findAll(auth: AuthContext, componentId?: string) {
    const vesselId = requireVesselId(auth);
    const conds = [
      eq(runningHourReadings.tenantId, auth.tenantId),
      eq(runningHourReadings.vesselId, vesselId),
      isNull(runningHourReadings.deletedAt),
    ];
    if (componentId !== undefined) {
      conds.push(eq(runningHourReadings.componentId, componentId));
    }
    return this.drizzle.db
      .select()
      .from(runningHourReadings)
      .where(and(...conds))
      .orderBy(desc(runningHourReadings.recordedAt))
      .all();
  }
}
