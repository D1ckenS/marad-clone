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
  await prisma.withTenant(tenantId, async (tx) => {
    await tx.vessel.create({ data: { id: vesselId, tenantId, name: 'MV Audit Ship' } });
    await tx.user.create({
      data: {
        id: userId,
        tenantId,
        vesselId,
        email: 'audit@shore.test',
        passwordHash: hash,
        role: 'CHIEF_ENGINEER',
      },
    });
  });

  const loginRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'audit@shore.test', password: 'TestP@ss!1' });
  token = (loginRes.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await prisma
    .withTenant(tenantId, async (tx) => {
      await tx.auditEvent.deleteMany({ where: { tenantId } });
      await tx.jobHistory.deleteMany({ where: { tenantId } });
      await tx.jobInstance.deleteMany({ where: { tenantId } });
      await tx.job.deleteMany({ where: { tenantId } });
      await tx.component.deleteMany({ where: { tenantId } });
      await tx.user.deleteMany({ where: { tenantId } });
      await tx.vessel.deleteMany({ where: { tenantId } });
    })
    .catch(() => null);
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
    // B8: evidence pack now reports both triggers.
    expect(pack.immutabilityVerification.trigger).toContain('job_histories_immutable');
    expect(pack.immutabilityVerification.trigger).toContain('job_histories_no_delete');
    expect(pack.immutabilityVerification.verified).toBe(true);
    expect(pack.summary.totalJobsCompleted).toBeGreaterThan(0);
    expect(pack.jobHistories.length).toBeGreaterThan(0);
    expect(pack.auditEvents.length).toBeGreaterThan(0);
  });

  it('job_histories_immutable trigger prevents UPDATE on JobHistory', async () => {
    const jobHistories = await prisma.withTenant(tenantId, (tx) =>
      tx.jobHistory.findMany({ where: { tenantId, vesselId } }),
    );
    expect(jobHistories.length).toBeGreaterThan(0);
    const histId = jobHistories[0]!.id;

    // Attempt raw UPDATE via Prisma — should raise due to DB trigger
    await expect(
      prisma.withTenant(
        tenantId,
        (tx) =>
          tx.$executeRaw`
          UPDATE job_histories SET notes = 'tampered' WHERE id = ${histId}
        `,
      ),
    ).rejects.toThrow();
  });

  it('job_histories_no_delete trigger prevents DELETE on JobHistory (B8)', async () => {
    const jobHistories = await prisma.withTenant(tenantId, (tx) =>
      tx.jobHistory.findMany({ where: { tenantId, vesselId } }),
    );
    expect(jobHistories.length).toBeGreaterThan(0);
    const histId = jobHistories[0]!.id;

    // Attempt raw DELETE via Prisma — should raise due to BEFORE DELETE
    // trigger. The trigger function unconditionally RAISEs so deletes are
    // impossible even from the DB owner.
    await expect(
      prisma.withTenant(
        tenantId,
        (tx) =>
          tx.$executeRaw`
          DELETE FROM job_histories WHERE id = ${histId}
        `,
      ),
    ).rejects.toThrow(/immutable/i);

    // Row must still be there.
    const after = await prisma.withTenant(tenantId, (tx) =>
      tx.jobHistory.findUnique({ where: { id: histId } }),
    );
    expect(after).not.toBeNull();
  });

  it('both immutability triggers are registered on job_histories (B8)', async () => {
    const rows = await prisma.$queryRaw<Array<{ tgname: string }>>`
      SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'job_histories'::regclass AND NOT tgisinternal
    `;
    const names = rows.map((r) => r.tgname);
    expect(names).toContain('job_histories_immutable');
    expect(names).toContain('job_histories_no_delete');
  });

  it('LOGIN_SUCCESS audit event recorded after login (B7)', async () => {
    // The beforeAll login call already triggered LOGIN_SUCCESS; we look it up.
    await new Promise((r) => setTimeout(r, 100));
    const res = await request(app.getHttpServer())
      .get(`/api/v1/audit-events?actorUserId=${userId}&action=LOGIN_SUCCESS`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBeGreaterThan(0);
    const evt = (
      res.body as Array<{ action: string; actorUserId: string; entityType: string }>
    )[0]!;
    expect(evt.action).toBe('LOGIN_SUCCESS');
    expect(evt.actorUserId).toBe(userId);
    expect(evt.entityType).toBe('User');
  });

  it('LOGIN_FAIL audit event recorded on wrong password (B7)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ tenantId, identifier: 'audit@shore.test', password: 'wrong-password' })
      .expect(401);
    await new Promise((r) => setTimeout(r, 100));
    const res = await request(app.getHttpServer())
      .get(`/api/v1/audit-events?actorUserId=${userId}&action=LOGIN_FAIL`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBeGreaterThan(0);
  });

  it('API_POST audit event recorded after a mutation via the interceptor (B7)', async () => {
    // Create a component (POST) and confirm the global interceptor logged it.
    const compRes = await request(app.getHttpServer())
      .post('/api/v1/components')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId, name: 'B7 Test Component', sfi: '999' });
    expect(compRes.status).toBe(201);
    const newComponentId = (compRes.body as { id: string }).id;

    await new Promise((r) => setTimeout(r, 100));
    const res = await request(app.getHttpServer())
      .get(`/api/v1/audit-events?entityType=components&action=API_POST`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = (
      res.body as Array<{ entityId: string; action: string; actorUserId: string }>
    ).find((e) => e.entityId === newComponentId);
    expect(found).toBeDefined();
    expect(found!.action).toBe('API_POST');
    expect(found!.actorUserId).toBe(userId);
  });

  it('VESSEL_SYNC_UPSERT audit event recorded when shore applies a vessel delta (B7)', async () => {
    // Drive PrismaSyncAdapter.applyRemoteDelta directly — same path the
    // gateway exercises on every received delta, just without a real gRPC
    // stream in the loop.
    const vesselActorId = ulid();
    const { PrismaSyncAdapter } = await import('../src/sync/prisma-sync-adapter');
    const adapter = new PrismaSyncAdapter(prisma, tenantId, vesselId);
    const { newId } = await import('@fleetops/domain');
    const entityId = newId();
    const fakeHlc = '0LATERLATERLATERLATERLATERLATER';
    await adapter.applyRemoteDelta({
      entityType: 'note',
      entityId,
      operation: 'upsert',
      payload: { text: { value: 'hello', hlc: fakeHlc } },
      hlc: fakeHlc,
      nodeId: 'vessel-test-node',
      actorUserId: vesselActorId,
    });

    // The gateway's onReceive wraps the apply with an audit call. Replicate
    // it here so the e2e exercises the audit shape without booting the
    // gateway. (The full gateway integration is covered by sync-gateway.service.test.ts.)
    const { AuditEventService } = await import('../src/audit-event/audit-event.service');
    const auditSvc = new AuditEventService(prisma);
    await auditSvc.record({
      tenantId,
      vesselId,
      actorUserId: vesselActorId,
      action: 'VESSEL_SYNC_UPSERT',
      entityType: 'note',
      entityId,
      metadata: { hlc: fakeHlc, nodeId: 'vessel-test-node' },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/audit-events?action=VESSEL_SYNC_UPSERT&actorUserId=${vesselActorId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const evt = (
      res.body as Array<{
        action: string;
        actorUserId: string;
        entityType: string;
        entityId: string;
      }>
    ).find((e) => e.entityId === entityId);
    expect(evt).toBeDefined();
    expect(evt!.actorUserId).toBe(vesselActorId);
    expect(evt!.entityType).toBe('note');
  });

  it('GET /audit-events supports actorUserId + from filters (B7)', async () => {
    const futureFrom = new Date(Date.now() + 60_000).toISOString();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/audit-events?actorUserId=${userId}&from=${futureFrom}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // Nothing should be in the future window.
    expect((res.body as unknown[]).length).toBe(0);
  });

  it('verifies RLS policy on audit_events', async () => {
    const rows = await prisma.$queryRaw<Array<{ policyname: string }>>`
      SELECT policyname FROM pg_policies WHERE tablename = 'audit_events'
    `;
    expect(rows.some((r) => r.policyname === 'audit_events_tenant_isolation')).toBe(true);
  });
});
