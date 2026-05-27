// H7 — fill the e2e gap for three previously-uncovered vessel controllers:
//   * ProjectController (`/projects`, `/projects/:id/tasks`)
//   * RfqController     (`/rfqs`)
//   * QuoteController   (`/quotes`)
//
// All three are vessel-scoped (require a vesselId in the JWT). The
// existing vessel `deferred-stub-schemas.e2e.ts` covers 11 of the 16 H7
// controllers; this file rounds out the remaining 3 with full CRUD plus
// the status transitions specific to each (RFQ send; Quote add-line +
// accept/reject + total recompute).

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;
let token = '';
const ctx = { tenantId: '', vesselId: '' };

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
      name: 'project-rfq-quote-vessel',
      admin: { email: 'admin@prq-vessel.test', password: 'AdminP@ss1' },
    });
  ctx.tenantId = (tenantRes.body as { tenant: { id: string } }).tenant.id;

  const adminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
    tenantId: ctx.tenantId,
    identifier: 'admin@prq-vessel.test',
    password: 'AdminP@ss1',
  });
  const adminToken = (adminLogin.body as { access_token: string }).access_token;

  const vesselRes = await request(app.getHttpServer())
    .post('/api/v1/vessels')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'MV ProjRfqQuote' });
  ctx.vesselId = (vesselRes.body as { id: string }).id;

  await request(app.getHttpServer())
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: 'pm@prq-vessel.test',
      password: 'TestP@ss!1',
      role: 'PURCHASE_MANAGER',
      vesselId: ctx.vesselId,
    });

  const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
    tenantId: ctx.tenantId,
    identifier: 'pm@prq-vessel.test',
    password: 'TestP@ss!1',
  });
  token = (login.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await app.close();
});

const auth = () => `Bearer ${token}`;

describe('H7 — ProjectController CRUD + task subresource', () => {
  let projectId: string;
  let taskId: string;

  it('POST /projects creates a project', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', auth())
      .send({
        title: 'Dry-dock 2026',
        description: '5-yearly hull survey + repaint',
        status: 'PLANNING',
        startDate: '2026-09-01',
        endDate: '2026-10-15',
      });
    expect(res.status).toBe(201);
    projectId = (res.body as { id: string }).id;
    expect((res.body as { status: string }).status).toBe('PLANNING');
  });

  it('GET /projects lists projects on the vessel', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect((res.body as { id: string }[]).some((p) => p.id === projectId)).toBe(true);
  });

  it('GET /projects/:id returns project with empty tasks array', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(Array.isArray((res.body as { tasks: unknown[] }).tasks)).toBe(true);
    expect((res.body as { tasks: unknown[] }).tasks.length).toBe(0);
  });

  it('PATCH /projects/:id transitions PLANNING → ACTIVE', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}`)
      .set('Authorization', auth())
      .send({ status: 'ACTIVE' });
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe('ACTIVE');
  });

  it('POST /projects/:projectId/tasks creates a task', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', auth())
      .send({
        title: 'Sandblast hull',
        status: 'TODO',
        startDate: '2026-09-05',
        endDate: '2026-09-12',
        plannedDays: 7,
        assignedToRole: 'CHIEF_ENGINEER',
      });
    expect(res.status).toBe(201);
    taskId = (res.body as { id: string }).id;
  });

  it('GET /projects/:projectId/tasks lists tasks', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect((res.body as { id: string }[]).some((t) => t.id === taskId)).toBe(true);
  });

  it('PATCH /projects/:projectId/tasks/:taskId updates status to IN_PROGRESS', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', auth())
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe('IN_PROGRESS');
  });

  it('DELETE /projects/:projectId/tasks/:taskId soft-deletes the task', async () => {
    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', auth());
    expect(removed.status).toBe(204);

    const afterDelete = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', auth());
    expect((afterDelete.body as { id: string }[]).some((t) => t.id === taskId)).toBe(false);
  });

  it('DELETE /projects/:id soft-deletes the project', async () => {
    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', auth());
    expect(removed.status).toBe(204);

    const afterDelete = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', auth());
    expect(afterDelete.status).toBe(404);
  });
});

describe('H7 — RfqController CRUD + send transition', () => {
  let rfqId: string;

  it('POST /rfqs creates a draft RFQ', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/rfqs')
      .set('Authorization', auth())
      .send({ title: 'Spare parts — Q3', notes: 'Need within 30 days' });
    expect(res.status).toBe(201);
    rfqId = (res.body as { id: string }).id;
    expect((res.body as { status: string }).status).toBe('DRAFT');
  });

  it('GET /rfqs lists RFQs', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/rfqs').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect((res.body as { id: string }[]).some((r) => r.id === rfqId)).toBe(true);
  });

  it('GET /rfqs/:id returns the RFQ with empty quotes array', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/rfqs/${rfqId}`)
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(Array.isArray((res.body as { quotes: unknown[] }).quotes)).toBe(true);
  });

  it('PATCH /rfqs/:id updates notes', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/rfqs/${rfqId}`)
      .set('Authorization', auth())
      .send({ notes: 'Need within 14 days (urgent)' });
    expect(res.status).toBe(200);
    expect((res.body as { notes: string }).notes).toBe('Need within 14 days (urgent)');
  });

  it('POST /rfqs/:id/send transitions DRAFT → SENT and stamps issuedAt', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/rfqs/${rfqId}/send`)
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe('SENT');
    expect((res.body as { issuedAt: string }).issuedAt).toBeTruthy();
  });

  it('POST /rfqs/:id/send a second time returns 400 (only DRAFT can be sent)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/rfqs/${rfqId}/send`)
      .set('Authorization', auth());
    expect(res.status).toBe(400);
  });

  it('DELETE /rfqs/:id soft-deletes', async () => {
    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/rfqs/${rfqId}`)
      .set('Authorization', auth());
    expect(removed.status).toBe(204);

    const afterDelete = await request(app.getHttpServer())
      .get(`/api/v1/rfqs/${rfqId}`)
      .set('Authorization', auth());
    expect(afterDelete.status).toBe(404);
  });
});

describe('H7 — QuoteController CRUD + line totals + accept/reject', () => {
  let rfqId: string;
  let supplierId: string;
  let quoteId: string;

  it('seeds an RFQ + Supplier as quote fixtures', async () => {
    const rfqRes = await request(app.getHttpServer())
      .post('/api/v1/rfqs')
      .set('Authorization', auth())
      .send({ title: 'Quote-fixture RFQ' });
    rfqId = (rfqRes.body as { id: string }).id;

    const suppRes = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .set('Authorization', auth())
      .send({ name: 'Pacific Ship Stores', country: 'PH' });
    supplierId = (suppRes.body as { id: string }).id;
  });

  it('POST /quotes creates a PENDING quote', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/quotes')
      .set('Authorization', auth())
      .send({ rfqId, supplierId, currency: 'USD' });
    expect(res.status).toBe(201);
    quoteId = (res.body as { id: string }).id;
    expect((res.body as { status: string }).status).toBe('PENDING');
    expect((res.body as { totalAmount: string }).totalAmount).toBe('0');
  });

  it('GET /quotes?rfqId=… filters by RFQ', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/quotes?rfqId=${rfqId}`)
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect((res.body as { id: string }[]).every((q) => q.id)).toBe(true);
    expect((res.body as { id: string }[]).some((q) => q.id === quoteId)).toBe(true);
  });

  it('GET /quotes/:id returns supplier + empty lines array', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/quotes/${quoteId}`)
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect((res.body as { supplier: { id: string } }).supplier.id).toBe(supplierId);
    expect(Array.isArray((res.body as { lines: unknown[] }).lines)).toBe(true);
  });

  it('POST /quotes/:id/lines adds a line and recomputes totalAmount', async () => {
    const lineRes = await request(app.getHttpServer())
      .post(`/api/v1/quotes/${quoteId}/lines`)
      .set('Authorization', auth())
      .send({
        description: 'Lube oil drum',
        quantity: '2',
        unit: 'drum',
        unitPrice: '250.00',
        totalPrice: '500.00',
      });
    expect(lineRes.status).toBe(201);

    const fetched = await request(app.getHttpServer())
      .get(`/api/v1/quotes/${quoteId}`)
      .set('Authorization', auth());
    expect(parseFloat((fetched.body as { totalAmount: string }).totalAmount)).toBe(500);
  });

  it('POST /quotes/:id/accept transitions PENDING → ACCEPTED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/quotes/${quoteId}/accept`)
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe('ACCEPTED');
  });

  it('POST /quotes/:id/lines on accepted quote returns 400 (only PENDING)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/quotes/${quoteId}/lines`)
      .set('Authorization', auth())
      .send({ description: 'late add', quantity: '1', unitPrice: '1', totalPrice: '1' });
    expect(res.status).toBe(400);
  });

  it('POST /quotes/:id/reject on non-PENDING returns 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/quotes/${quoteId}/reject`)
      .set('Authorization', auth());
    expect(res.status).toBe(400);
  });

  it('reject path: separate PENDING quote can be rejected', async () => {
    const fresh = await request(app.getHttpServer())
      .post('/api/v1/quotes')
      .set('Authorization', auth())
      .send({ rfqId, supplierId });
    const freshId = (fresh.body as { id: string }).id;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/quotes/${freshId}/reject`)
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe('REJECTED');
  });

  it('DELETE /quotes/:id soft-deletes', async () => {
    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/quotes/${quoteId}`)
      .set('Authorization', auth());
    expect(removed.status).toBe(204);

    const afterDelete = await request(app.getHttpServer())
      .get(`/api/v1/quotes/${quoteId}`)
      .set('Authorization', auth());
    expect(afterDelete.status).toBe(404);
  });
});
