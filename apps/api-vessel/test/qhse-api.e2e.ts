import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;
let token = '';
const ctx = { tenantId: '', vesselId: '', userId: '' };

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue({ putJobHistoryPhoto: async () => 'stub/key', put: async () => 'stub/key' })
    .compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const tenantRes = await request(app.getHttpServer())
    .post('/api/v1/tenants')
    .send({
      name: 'qhse-api-vessel',
      admin: { email: 'admin@qhse-vessel.test', password: 'AdminP@ss1' },
    });
  ctx.tenantId = (tenantRes.body as { tenant: { id: string } }).tenant.id;

  const adminLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId: ctx.tenantId, email: 'admin@qhse-vessel.test', password: 'AdminP@ss1' });
  const adminToken = (adminLogin.body as { access_token: string }).access_token;

  const vesselRes = await request(app.getHttpServer())
    .post('/api/v1/vessels')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'MV QHSE Vessel' });
  ctx.vesselId = (vesselRes.body as { id: string }).id;

  const userRes = await request(app.getHttpServer())
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: 'chief@qhse-vessel.test',
      password: 'TestP@ss!1',
      role: 'CHIEF_ENGINEER',
      vesselId: ctx.vesselId,
    });
  ctx.userId = (userRes.body as { id: string }).id;

  const chiefLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId: ctx.tenantId, email: 'chief@qhse-vessel.test', password: 'TestP@ss!1' });
  token = (chiefLogin.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await app.close();
});

describe('P2-3 QHSE API — vessel', () => {
  let documentId: string;
  let templateId: string;
  let instanceId: string;
  let findingId: string;
  let capaId: string;

  // ── Document control ───────────────────────────────────────────────────────

  it('creates a QhseDocument', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/qhse-documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Emergency Procedures', category: 'SMS', isControlled: true });
    expect(res.status).toBe(201);
    documentId = (res.body as { id: string }).id;
    expect(typeof documentId).toBe('string');
  });

  it('adds a revision — revision 1', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/qhse-documents/${documentId}/revisions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ s3Key: 'docs/emergency-v1.pdf', summary: 'Initial' });
    expect(res.status).toBe(201);
    expect((res.body as { revisionNumber: number }).revisionNumber).toBe(1);
  });

  it('adds revision 2 — old revision remains in history', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/qhse-documents/${documentId}/revisions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ s3Key: 'docs/emergency-v2.pdf', summary: 'Updated muster stations' });
    expect(res.status).toBe(201);
    expect((res.body as { revisionNumber: number }).revisionNumber).toBe(2);
  });

  it('lists all revisions — 2 rows', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/qhse-documents/${documentId}/revisions`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBe(2);
  });

  // ── Checklist template + instance ─────────────────────────────────────────

  it('creates a ChecklistTemplate', async () => {
    const items = JSON.stringify([
      { id: 'i1', text: 'Fire extinguisher in place', required: true },
    ]);
    const res = await request(app.getHttpServer())
      .post('/api/v1/checklist-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fire Check', itemsJson: items });
    expect(res.status).toBe(201);
    templateId = (res.body as { id: string }).id;
  });

  it('creates a ChecklistInstance', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/checklist-instances')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId: ctx.vesselId, templateId, title: 'Monthly Fire Check' });
    expect(res.status).toBe(201);
    instanceId = (res.body as { id: string }).id;
    expect((res.body as { status: string }).status).toBe('IN_PROGRESS');
  });

  it('signs a checklist item', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/checklist-instances/${instanceId}/sign-item`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: 'i1',
        signedByUserId: ctx.userId,
        signedAt: new Date().toISOString(),
        checked: true,
      });
    expect(res.status).toBe(201);
    const responses = JSON.parse((res.body as { responsesJson: string }).responsesJson) as Array<{
      itemId: string;
      signedByUserId: string;
    }>;
    expect(responses.at(0)?.signedByUserId).toBe(ctx.userId);
  });

  it('sign-item creates outbox entry', async () => {
    const { DrizzleService } = await import('../src/db/drizzle.service');
    const { outbox } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const drizzle = app.get(DrizzleService);
    const entries = drizzle.db
      .select()
      .from(outbox)
      .where(eq(outbox.entityType, 'ChecklistInstance'))
      .all();
    expect(entries.length).toBeGreaterThan(0);
  });

  it('completes the checklist instance', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/checklist-instances/${instanceId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect((res.body as { status: string }).status).toBe('COMPLETED');
  });

  // ── Finding ────────────────────────────────────────────────────────────────

  it('creates a Finding', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/findings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId: ctx.vesselId,
        kind: 'NON_CONFORMANCE',
        title: 'Missing safety guard on winch',
        raisedAt: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
    findingId = (res.body as { id: string }).id;
    expect((res.body as { kind: string }).kind).toBe('NON_CONFORMANCE');
  });

  it('closes a finding', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/findings/${findingId}/close`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect((res.body as { status: string }).status).toBe('CLOSED');
  });

  it('finding close creates outbox entry', async () => {
    const { DrizzleService } = await import('../src/db/drizzle.service');
    const { outbox } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const drizzle = app.get(DrizzleService);
    const entries = drizzle.db.select().from(outbox).where(eq(outbox.entityType, 'Finding')).all();
    expect(entries.length).toBeGreaterThan(0);
  });

  // ── CAPA ───────────────────────────────────────────────────────────────────

  it('creates a CAPA', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/capas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId: ctx.vesselId,
        findingId,
        type: 'CORRECTIVE',
        description: 'Install safety guard',
        ownerUserId: ctx.userId,
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
    expect(res.status).toBe(201);
    capaId = (res.body as { id: string }).id;
    expect((res.body as { status: string }).status).toBe('OPEN');
    expect((res.body as { ownerUserId: string }).ownerUserId).toBe(ctx.userId);
  });

  it('verifies the CAPA', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/capas/${capaId}/verify`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect((res.body as { status: string }).status).toBe('VERIFIED');
  });

  it('closes the CAPA', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/capas/${capaId}/close`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect((res.body as { status: string }).status).toBe('CLOSED');
  });

  it('CAPA close creates outbox entry', async () => {
    const { DrizzleService } = await import('../src/db/drizzle.service');
    const { outbox } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const drizzle = app.get(DrizzleService);
    const entries = drizzle.db.select().from(outbox).where(eq(outbox.entityType, 'Capa')).all();
    expect(entries.length).toBeGreaterThan(0);
  });
});
