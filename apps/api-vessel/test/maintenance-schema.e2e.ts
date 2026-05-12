import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulidx';
import { eq } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DrizzleService } from '../src/db/drizzle.service';
import {
  components,
  jobInstances,
  jobHistories,
  jobs,
  masterComponents,
  runningHourReadings,
  tenants,
  users,
  vessels,
} from '../src/db/schema';

// ── bootstrap ────────────────────────────────────────────────────────────────

let app: INestApplication;
let drizzle: DrizzleService;

const tenantId = ulid();
const vesselId = ulid();
const userId = ulid();

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  drizzle = moduleRef.get(DrizzleService);

  await drizzle.db.insert(tenants).values({ id: tenantId, name: 'maintenance-vessel-test' }).run();
  await drizzle.db.insert(vessels).values({ id: vesselId, tenantId, name: 'MV Drizzle' }).run();
  await drizzle.db
    .insert(users)
    .values({ id: userId, tenantId, vesselId, email: 'eng@vessel.test', role: 'CHIEF_ENGINEER' })
    .run();
});

afterAll(async () => {
  await app.close();
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('P1-1 maintenance schema — SQLite', () => {
  it('round-trips MasterComponent → Component → Job → JobInstance', async () => {
    const masterId = ulid();
    const componentId = ulid();
    const jobId = ulid();
    const instanceId = ulid();

    await drizzle.db
      .insert(masterComponents)
      .values({ id: masterId, tenantId, name: 'Pump (template)', sfi: '651' })
      .run();
    await drizzle.db
      .insert(components)
      .values({
        id: componentId,
        tenantId,
        vesselId,
        masterId,
        name: 'Bilge Pump #1',
        runningHours: '102.50',
      })
      .run();
    await drizzle.db
      .insert(jobs)
      .values({
        id: jobId,
        tenantId,
        vesselId,
        componentId,
        title: 'Quarterly check',
        intervalDays: 90,
        priority: 'NORMAL',
      })
      .run();
    await drizzle.db
      .insert(jobInstances)
      .values({
        id: instanceId,
        tenantId,
        vesselId,
        jobId,
        componentId,
        status: 'PENDING',
        dueAt: '2026-08-04T00:00:00.000Z',
      })
      .run();

    const stored = await drizzle.db
      .select()
      .from(components)
      .where(eq(components.id, componentId))
      .all();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.runningHours).toBe('102.5');
    expect(stored[0]?.masterId).toBe(masterId);
  });

  it('rejects a Job whose interval columns are both null (CHECK constraint)', () => {
    const componentId = ulid();
    drizzle.db
      .insert(components)
      .values({ id: componentId, tenantId, vesselId, name: 'C-chk' })
      .run();
    expect(() =>
      drizzle.db
        .insert(jobs)
        .values({
          id: ulid(),
          tenantId,
          vesselId,
          componentId,
          title: 'Bad job',
          intervalDays: null,
          intervalRunningHours: null,
        })
        .run(),
    ).toThrow(/jobs_interval_required_chk|CHECK constraint/i);
  });

  it('blocks UPDATE of business columns on JobHistory (immutability trigger)', async () => {
    const componentId = ulid();
    const jobId = ulid();
    const instanceId = ulid();
    const historyId = ulid();

    drizzle.db
      .insert(components)
      .values({ id: componentId, tenantId, vesselId, name: 'C-trigger' })
      .run();
    drizzle.db
      .insert(jobs)
      .values({
        id: jobId,
        tenantId,
        vesselId,
        componentId,
        title: 'tj',
        intervalDays: 30,
      })
      .run();
    drizzle.db
      .insert(jobInstances)
      .values({ id: instanceId, tenantId, vesselId, jobId, componentId })
      .run();
    drizzle.db
      .insert(jobHistories)
      .values({
        id: historyId,
        tenantId,
        vesselId,
        jobInstanceId: instanceId,
        jobId,
        componentId,
        completedAt: '2026-05-06T10:00:00.000Z',
        completedByUserId: userId,
        notes: 'initial',
      })
      .run();

    expect(() =>
      drizzle.db
        .update(jobHistories)
        .set({ notes: 'tampered' })
        .where(eq(jobHistories.id, historyId))
        .run(),
    ).toThrow(/immutable/);

    // Sync-meta change must still succeed (soft-delete + HLC bump).
    drizzle.db
      .update(jobHistories)
      .set({ deletedAt: '2026-05-06T11:00:00.000Z', hlc: '0000000abcdef-0000-vessel' })
      .where(eq(jobHistories.id, historyId))
      .run();

    const after = drizzle.db
      .select()
      .from(jobHistories)
      .where(eq(jobHistories.id, historyId))
      .all();
    expect(after[0]?.deletedAt).toBe('2026-05-06T11:00:00.000Z');
    expect(after[0]?.hlc).toBe('0000000abcdef-0000-vessel');
    expect(after[0]?.notes).toBe('initial');
  });

  it('records a RunningHourReading', () => {
    const componentId = ulid();
    drizzle.db
      .insert(components)
      .values({ id: componentId, tenantId, vesselId, name: 'C-rh' })
      .run();
    drizzle.db
      .insert(runningHourReadings)
      .values({
        id: ulid(),
        tenantId,
        vesselId,
        componentId,
        value: '500.00',
        source: 'PLC',
        recordedAt: '2026-05-06T08:00:00.000Z',
      })
      .run();

    const rows = drizzle.db
      .select()
      .from(runningHourReadings)
      .where(eq(runningHourReadings.componentId, componentId))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe('500');
    expect(rows[0]?.source).toBe('PLC');
  });
});
