import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulidx';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;
let prisma: PrismaService;
let token: string;

const tenantId = ulid();
const vesselId = ulid();
const userId = ulid();

const storageStub = { putJobHistoryPhoto: async () => 'stub/key', put: async () => 'stub/key' };

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue(storageStub)
    .compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  prisma = moduleRef.get(PrismaService);

  const hash = await bcrypt.hash('TestP@ss!1', 12);
  await prisma.tenant.create({ data: { id: tenantId, name: 'audit-e2e-test' } });
  await prisma.vessel.create({ data: { id: vesselId, tenantId, name: 'MV Audit Ship' } });
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      vesselId,
      email: 'audit@shore.test',
      passwordHash: hash,
      role: 'CHIEF_ENGINEER',
    },
  });

  const loginRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'audit@shore.test', password: 'TestP@ss!1' });
  token = (loginRes.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.jobHistory.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.jobInstance.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.job.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.component.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('P2-5 DNV evidence pack — shore', () => {
  let componentId: string;
  let jobId: string;
  let jobInstanceId: string;

  it('sets up a signed-off job for the evidence pack', async () => {
    // Create component
    const compRes = await request(app.getHttpServer())
      .post('/api/v1/components')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId, name: 'Main Engine', sfi: '210' });
    expect(compRes.status).toBe(201);
    componentId = (compRes.body as { id: string }).id;

    // Create job
    const jobRes = await request(app.getHttpServer())
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId, componentId, title: 'Oil change', intervalDays: 90 });
    expect(jobRes.status).toBe(201);
    jobId = (jobRes.body as { id: string }).id;

    // Create job instance
    const instRes = await request(app.getHttpServer())
      .post('/api/v1/job-instances')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId, jobId, componentId, dueAt: new Date().toISOString() });
    expect(instRes.status).toBe(201);
    jobInstanceId = (instRes.body as { id: string }).id;

    // Sign off
    const signRes = await request(app.getHttpServer())
      .post(`/api/v1/job-instances/${jobInstanceId}/sign-off`)
      .set('Authorization', `Bearer ${token}`)
      .field('notes', 'Completed on schedule')
      .field('hoursWorked', '2.5');
    expect(signRes.status).toBe(201);
  });

  it('JOB_SIGNED_OFF audit event is recorded after sign-off', async () => {
    // Small wait for the fire-and-forget audit record to complete
    await new Promise((r) => setTimeout(r, 100));

    const res = await request(app.getHttpServer())
      .get(`/api/v1/audit-events?vesselId=${vesselId}&action=JOB_SIGNED_OFF`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBeGreaterThan(0);
    const evt = (
      res.body as Array<{ action: string; actorUserId: string; entityType: string }>
    )[0]!;
    expect(evt.action).toBe('JOB_SIGNED_OFF');
    expect(evt.actorUserId).toBe(userId);
    expect(evt.entityType).toBe('JobHistory');
  });

  it('GET /audit-events/dnv-evidence/:vesselId returns structured evidence pack', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/audit-events/dnv-evidence/${vesselId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const pack = res.body as {
      standard: string;
      vessel: { id: string };
      immutabilityVerification: { trigger: string; verified: boolean };
      summary: { totalJobsCompleted: number; totalAuditEvents: number };
      jobHistories: unknown[];
      auditEvents: unknown[];
    };
    expect(pack.standard).toBe('DNV CG-0339');
    expect(pack.vessel.id).toBe(vesselId);
    expect(pack.immutabilityVerification.trigger).toBe('job_histories_immutable');
    expect(pack.immutabilityVerification.verified).toBe(true);
    expect(pack.summary.totalJobsCompleted).toBeGreaterThan(0);
    expect(pack.jobHistories.length).toBeGreaterThan(0);
    expect(pack.auditEvents.length).toBeGreaterThan(0);
  });

  it('job_histories_immutable trigger prevents UPDATE on JobHistory', async () => {
    const jobHistories = await prisma.jobHistory.findMany({
      where: { tenantId, vesselId },
    });
    expect(jobHistories.length).toBeGreaterThan(0);
    const histId = jobHistories[0]!.id;

    // Attempt raw UPDATE via Prisma — should raise due to DB trigger
    await expect(
      prisma.$executeRaw`
        UPDATE job_histories SET notes = 'tampered' WHERE id = ${histId}
      `,
    ).rejects.toThrow();
  });

  it('verifies RLS policy on audit_events', async () => {
    const rows = await prisma.$queryRaw<Array<{ policyname: string }>>`
      SELECT policyname FROM pg_policies WHERE tablename = 'audit_events'
    `;
    expect(rows.some((r) => r.policyname === 'audit_events_tenant_isolation')).toBe(true);
  });
});
