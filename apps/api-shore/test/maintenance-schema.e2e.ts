import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulidx';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ── bootstrap ────────────────────────────────────────────────────────────────

let app: INestApplication;
let prisma: PrismaService;

const tenantId = ulid();
const vesselId = ulid();
const userId = ulid();

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  prisma = moduleRef.get(PrismaService);

  await prisma.tenant.create({ data: { id: tenantId, name: 'maintenance-schema-test' } });
  await prisma.vessel.create({ data: { id: vesselId, tenantId, name: 'MV Schema' } });
  await prisma.user.create({
    data: { id: userId, tenantId, vesselId, email: 'eng@test.invalid', role: 'CHIEF_ENGINEER' },
  });
});

afterAll(async () => {
  await prisma.runningHourReading.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.jobHistory.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.jobInstance.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.job.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.component.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.masterComponent.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('P1-1 maintenance schema — Postgres', () => {
  it('round-trips a hierarchical Component with a master link', async () => {
    const masterId = ulid();
    const parentId = ulid();
    const childId = ulid();

    await prisma.masterComponent.create({
      data: { id: masterId, tenantId, name: 'Diesel Generator (template)', sfi: '601' },
    });
    await prisma.component.create({
      data: {
        id: parentId,
        tenantId,
        vesselId,
        masterId,
        name: 'Main Engine',
        runningHours: new Prisma.Decimal('1234.50'),
      },
    });
    await prisma.component.create({
      data: { id: childId, tenantId, vesselId, parentId, name: 'Cooling Pump' },
    });

    const child = await prisma.component.findUnique({
      where: { id: childId },
      include: { parent: true },
    });
    expect(child?.parent?.id).toBe(parentId);
    expect(child?.parent?.runningHours.toString()).toBe('1234.5');

    const parent = await prisma.component.findUnique({
      where: { id: parentId },
      include: { master: true, children: true },
    });
    expect(parent?.master?.id).toBe(masterId);
    expect(parent?.children).toHaveLength(1);
  });

  it('rejects a Job whose interval columns are both null (CHECK constraint)', async () => {
    const componentId = ulid();
    await prisma.component.create({
      data: { id: componentId, tenantId, vesselId, name: 'C-no-interval' },
    });

    await expect(
      prisma.job.create({
        data: {
          id: ulid(),
          tenantId,
          vesselId,
          componentId,
          title: 'Bad job',
          intervalDays: null,
          intervalRunningHours: null,
        },
      }),
    ).rejects.toThrow(/jobs_interval_required_chk/);
  });

  it('schedules a JobInstance and signs it off via JobHistory', async () => {
    const componentId = ulid();
    const jobId = ulid();
    const instanceId = ulid();
    const historyId = ulid();

    await prisma.component.create({
      data: { id: componentId, tenantId, vesselId, name: 'Pump' },
    });
    await prisma.job.create({
      data: {
        id: jobId,
        tenantId,
        vesselId,
        componentId,
        title: '250-hour service',
        intervalRunningHours: new Prisma.Decimal('250'),
        priority: 'HIGH',
      },
    });
    await prisma.jobInstance.create({
      data: {
        id: instanceId,
        tenantId,
        vesselId,
        jobId,
        componentId,
        status: 'IN_PROGRESS',
        dueAtRunningHours: new Prisma.Decimal('250'),
      },
    });
    await prisma.jobHistory.create({
      data: {
        id: historyId,
        tenantId,
        vesselId,
        jobInstanceId: instanceId,
        jobId,
        componentId,
        completedAt: new Date('2026-05-06T10:00:00Z'),
        completedByUserId: userId,
        hoursWorked: new Prisma.Decimal('2.5'),
        notes: 'Replaced impeller',
        signatureHash: 'sha256:abc',
        partsConsumed: [{ partId: 'part-1', qty: 1 }],
      },
    });

    const stored = await prisma.jobHistory.findUnique({ where: { id: historyId } });
    expect(stored?.notes).toBe('Replaced impeller');
    expect(stored?.hoursWorked?.toString()).toBe('2.5');
    expect(stored?.partsConsumed).toEqual([{ partId: 'part-1', qty: 1 }]);
  });

  it('blocks UPDATE of business columns on JobHistory (immutability trigger)', async () => {
    const componentId = ulid();
    const jobId = ulid();
    const instanceId = ulid();
    const historyId = ulid();

    await prisma.component.create({
      data: { id: componentId, tenantId, vesselId, name: 'Trigger-component' },
    });
    await prisma.job.create({
      data: { id: jobId, tenantId, vesselId, componentId, title: 'tj', intervalDays: 30 },
    });
    await prisma.jobInstance.create({
      data: { id: instanceId, tenantId, vesselId, jobId, componentId },
    });
    await prisma.jobHistory.create({
      data: {
        id: historyId,
        tenantId,
        vesselId,
        jobInstanceId: instanceId,
        jobId,
        componentId,
        completedAt: new Date(),
        completedByUserId: userId,
        notes: 'initial',
      },
    });

    await expect(
      prisma.jobHistory.update({
        where: { id: historyId },
        data: { notes: 'tampered' },
      }),
    ).rejects.toThrow(/immutable/);

    // Sync-meta change must still succeed (soft-delete path).
    const softDeleted = await prisma.jobHistory.update({
      where: { id: historyId },
      data: { deletedAt: new Date(), hlc: '0000000abcdef-0000-shore' },
    });
    expect(softDeleted.deletedAt).not.toBeNull();
    expect(softDeleted.hlc).toBe('0000000abcdef-0000-shore');
  });

  it('records a RunningHourReading', async () => {
    const componentId = ulid();
    await prisma.component.create({
      data: { id: componentId, tenantId, vesselId, name: 'RH-component' },
    });
    await prisma.runningHourReading.create({
      data: {
        id: ulid(),
        tenantId,
        vesselId,
        componentId,
        value: new Prisma.Decimal('501.25'),
        source: 'MANUAL',
        recordedAt: new Date(),
        recordedByUserId: userId,
      },
    });

    const readings = await prisma.runningHourReading.findMany({
      where: { tenantId, vesselId, componentId },
    });
    expect(readings).toHaveLength(1);
    expect(readings[0]?.value.toString()).toBe('501.25');
    expect(readings[0]?.source).toBe('MANUAL');
  });

  it('declares RLS tenant_isolation policies on every new maintenance table', async () => {
    const tables = [
      'master_components',
      'components',
      'jobs',
      'job_instances',
      'job_histories',
      'running_hour_readings',
    ];
    const rows = await prisma.$queryRaw<{ tablename: string; policyname: string }[]>`
      SELECT tablename, policyname FROM pg_policies
      WHERE schemaname = 'public' AND policyname LIKE '%_tenant_isolation'
    `;
    const found = new Set(rows.map((r) => r.tablename));
    for (const t of tables) {
      expect(found.has(t), `pg_policies missing tenant_isolation on ${t}`).toBe(true);
    }
  });
});
