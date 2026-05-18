import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ulid } from 'ulidx';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;
let prisma: PrismaService;

const tenantId = ulid();
const vesselId = ulid();

let pmToken = ''; // PURCHASE_MANAGER — limit €50k

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
  prisma = moduleRef.get(PrismaService);

  await prisma.tenant.create({ data: { id: tenantId, name: 'purchase-api-test' } });
  await prisma.vessel.create({ data: { id: vesselId, tenantId, name: 'MV Purchase API' } });

  const hash = await bcrypt.hash('TestP@ss!1', 12);
  await prisma.user.create({
    data: {
      id: ulid(),
      tenantId,
      vesselId,
      email: 'pm@purchase-api-test.com',
      passwordHash: hash,
      role: 'PURCHASE_MANAGER',
    },
  });

  const pmRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'pm@purchase-api-test.com', password: 'TestP@ss!1' });
  pmToken = pmRes.body.access_token as string;
});

afterAll(async () => {
  await app.close();
});

describe('P1-8 purchase API — Postgres', () => {
  it('creates and lists Suppliers', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Atlas Maritime', country: 'GR', contactEmail: 'orders@atlas.gr' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Atlas Maritime');
    expect(res.body.isActive).toBe(true);

    const list = await request(app.getHttpServer())
      .get('/api/v1/suppliers')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(list.status).toBe(200);
    expect(list.body.some((s: { name: string }) => s.name === 'Atlas Maritime')).toBe(true);
  });

  it('creates ApprovalFlow with single step (limit €50k for PURCHASE_MANAGER)', async () => {
    const flowRes = await request(app.getHttpServer())
      .post('/api/v1/approval-flows')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Standard Purchase Approval', isActive: true });
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

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/approval-flows/${flowId}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(detail.body.steps).toHaveLength(1);
    expect(detail.body.steps[0].approverRole).toBe('PURCHASE_MANAGER');
  });

  it('full requisition lifecycle: draft → submit → approve', async () => {
    // First get the flow id
    const flowsRes = await request(app.getHttpServer())
      .get('/api/v1/approval-flows')
      .set('Authorization', `Bearer ${pmToken}`);
    const flowId = flowsRes.body[0]?.id;

    const reqRes = await request(app.getHttpServer())
      .post('/api/v1/requisitions')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        title: 'Engine spares Q3',
        totalAmount: '25000',
        currency: 'EUR',
        requestedAt: new Date().toISOString(),
        approvalFlowId: flowId,
      });
    expect(reqRes.status).toBe(201);
    const reqId = reqRes.body.id;
    expect(reqRes.body.status).toBe('DRAFT');

    // Add a line
    const lineRes = await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ description: 'Fuel filters', quantity: '50', unit: 'pcs' });
    expect(lineRes.status).toBe(201);

    // Submit
    const submitRes = await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/submit`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe('SUBMITTED');

    // Approve (€25k < €50k limit → allowed)
    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/approve`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('APPROVED');
    expect(approveRes.body.approvedByUserId).toBeTruthy();
  });

  it('blocks approval when amount exceeds PURCHASE_MANAGER limit (€60k > €50k)', async () => {
    const flowsRes = await request(app.getHttpServer())
      .get('/api/v1/approval-flows')
      .set('Authorization', `Bearer ${pmToken}`);
    const flowId = flowsRes.body[0]?.id;

    const reqRes = await request(app.getHttpServer())
      .post('/api/v1/requisitions')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        title: 'High-value spare',
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
    expect(approveRes.body.message).toMatch(/limit/i);
  });

  it('can reject a submitted requisition with a reason', async () => {
    const reqRes = await request(app.getHttpServer())
      .post('/api/v1/requisitions')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ title: 'Reject me', requestedAt: new Date().toISOString() });
    const reqId = reqRes.body.id;
    await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/submit`)
      .set('Authorization', `Bearer ${pmToken}`);

    const rejectRes = await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/reject`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ reason: 'Out of budget' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe('REJECTED');
    expect(rejectRes.body.rejectionReason).toBe('Out of budget');
  });

  it('PO lifecycle: draft → add line → set supplier → send', async () => {
    const suppRes = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Beta Marine Supply' });
    const supplierId = suppRes.body.id;

    const poRes = await request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ title: 'PO-001' });
    expect(poRes.status).toBe(201);
    const poId = poRes.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${poId}/lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        description: 'Hydraulic hose 1"',
        quantity: '10',
        unitPrice: '80',
        totalPrice: '800',
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/purchase-orders/${poId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ supplierId });

    const sendRes = await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${poId}/send`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.status).toBe('SENT');
  });

  it('PO receive: 8/10 items → PARTIALLY_RECEIVED; 2 more → RECEIVED', async () => {
    // Create supplier
    const suppRes = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Gamma Ship Parts' });
    const supplierId = suppRes.body.id;

    // Create PO + line
    const poRes = await request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ title: 'GRN-test PO', supplierId });
    const poId = poRes.body.id;

    const lineRes = await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${poId}/lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ description: 'Pump seal kit', quantity: '10', unitPrice: '100', totalPrice: '1000' });
    const poLineId = lineRes.body.id;

    // Send the PO
    await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${poId}/send`)
      .set('Authorization', `Bearer ${pmToken}`);

    // First GRN: receive 8 of 10
    const grn1 = await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${poId}/receive`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ lines: [{ poLineId, quantityReceived: '8' }] });
    expect(grn1.status).toBe(201);
    expect(grn1.body.poStatus).toBe('PARTIALLY_RECEIVED');

    // Second GRN: receive remaining 2
    const grn2 = await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${poId}/receive`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ lines: [{ poLineId, quantityReceived: '2' }] });
    expect(grn2.status).toBe(201);
    expect(grn2.body.poStatus).toBe('RECEIVED');
  });

  it('blocks sending a PO without a supplier', async () => {
    const poRes = await request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ title: 'No-supplier PO' });
    const poId = poRes.body.id;
    const res = await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${poId}/send`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(res.status).toBe(400);
  });
});
