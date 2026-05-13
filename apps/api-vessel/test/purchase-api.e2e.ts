import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;

let pmToken = '';
const created = { tenantId: '', vesselId: '' };

const storageStub = { putJobHistoryPhoto: vi.fn(async () => 'stub-key') };

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue(storageStub)
    .compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const tenantRes = await request(app.getHttpServer())
    .post('/api/v1/tenants')
    .send({
      name: 'purchase-api-vessel',
      admin: { email: 'admin@purchase-vessel.test', password: 'AdminP@ss1' },
    });
  created.tenantId = tenantRes.body.tenant.id as string;

  const adminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
    tenantId: created.tenantId,
    email: 'admin@purchase-vessel.test',
    password: 'AdminP@ss1',
  });
  const adminToken = adminLogin.body.access_token as string;

  const vesselRes = await request(app.getHttpServer())
    .post('/api/v1/vessels')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'MV Purchase-Vessel' });
  created.vesselId = vesselRes.body.id as string;

  await request(app.getHttpServer())
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: 'pm@purchase-vessel.test',
      password: 'TestP@ss!1',
      role: 'PURCHASE_MANAGER',
      vesselId: created.vesselId,
    });

  const pmLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId: created.tenantId, email: 'pm@purchase-vessel.test', password: 'TestP@ss!1' });
  pmToken = pmLogin.body.access_token as string;
});

afterAll(async () => {
  await app.close();
});

describe('P1-8 purchase API — SQLite/vessel', () => {
  it('creates and lists Suppliers', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Pacific Ship Stores', country: 'PH' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Pacific Ship Stores');

    const list = await request(app.getHttpServer())
      .get('/api/v1/suppliers')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(list.status).toBe(200);
    expect(list.body.some((s: { name: string }) => s.name === 'Pacific Ship Stores')).toBe(true);
  });

  it('creates ApprovalFlow with step (limit €50k)', async () => {
    const flowRes = await request(app.getHttpServer())
      .post('/api/v1/approval-flows')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Vessel Approval', isActive: true });
    expect(flowRes.status).toBe(201);
    const flowId = flowRes.body.id;

    const stepRes = await request(app.getHttpServer())
      .post(`/api/v1/approval-flows/${flowId}/steps`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        stepOrder: 1,
        approverRole: 'PURCHASE_MANAGER',
        limitAmount: '50000',
        limitCurrency: 'EUR',
      });
    expect(stepRes.status).toBe(201);
    expect(stepRes.body.limitAmount).toBe('50000');
  });

  it('requisition lifecycle: create → submit → approve (within limit)', async () => {
    const flowsRes = await request(app.getHttpServer())
      .get('/api/v1/approval-flows')
      .set('Authorization', `Bearer ${pmToken}`);
    const flowId = flowsRes.body[0]?.id;

    const reqRes = await request(app.getHttpServer())
      .post('/api/v1/requisitions')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        title: 'Deck consumables',
        totalAmount: '10000',
        currency: 'EUR',
        requestedAt: new Date().toISOString(),
        approvalFlowId: flowId,
      });
    expect(reqRes.status).toBe(201);
    const reqId = reqRes.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ description: 'Safety gloves', quantity: '20', unit: 'pairs' });

    const submitRes = await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/submit`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(submitRes.body.status).toBe('SUBMITTED');

    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/approve`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('APPROVED');
  });

  it('blocks approval when amount exceeds limit', async () => {
    const flowsRes = await request(app.getHttpServer())
      .get('/api/v1/approval-flows')
      .set('Authorization', `Bearer ${pmToken}`);
    const flowId = flowsRes.body[0]?.id;

    const reqRes = await request(app.getHttpServer())
      .post('/api/v1/requisitions')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        title: 'Over-limit requisition',
        totalAmount: '60000',
        currency: 'EUR',
        requestedAt: new Date().toISOString(),
        approvalFlowId: flowId,
      });
    const reqId = reqRes.body.id;
    await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/submit`)
      .set('Authorization', `Bearer ${pmToken}`);

    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/approve`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(approveRes.status).toBe(403);
  });

  it('PO lifecycle: create → line → send → partial GRN → full GRN', async () => {
    const suppRes = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Delta Marine Parts' });
    const supplierId = suppRes.body.id;

    const poRes = await request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ title: 'Vessel PO-001', supplierId });
    const poId = poRes.body.id;

    const lineRes = await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${poId}/lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ description: 'O-ring kit', quantity: '10', unitPrice: '50', totalPrice: '500' });
    const poLineId = lineRes.body.id;

    const sendRes = await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${poId}/send`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.status).toBe('SENT');

    const grn1 = await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${poId}/receive`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ lines: [{ poLineId, quantityReceived: '8' }] });
    expect(grn1.status).toBe(201);
    expect(grn1.body.poStatus).toBe('PARTIALLY_RECEIVED');

    const grn2 = await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${poId}/receive`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ lines: [{ poLineId, quantityReceived: '2' }] });
    expect(grn2.body.poStatus).toBe('RECEIVED');
  });
});
