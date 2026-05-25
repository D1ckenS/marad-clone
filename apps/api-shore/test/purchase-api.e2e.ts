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
  const hash = await bcrypt.hash('TestP@ss!1', 12);
  await prisma.withTenant(tenantId, async (tx) => {
    await tx.vessel.create({ data: { id: vesselId, tenantId, name: 'MV Purchase API' } });
    await tx.user.create({
      data: {
        id: ulid(),
        tenantId,
        vesselId,
        email: 'pm@purchase-api-test.com',
        passwordHash: hash,
        role: 'PURCHASE_MANAGER',
      },
    });
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
        currency: 'EUR',
        requestedAt: new Date().toISOString(),
        approvalFlowId: flowId,
      });
    expect(reqRes.status).toBe(201);
    const reqId = reqRes.body.id;
    expect(reqRes.body.status).toBe('DRAFT');

    // Add a line — total recomputes from estimatedTotalPrice (€25k)
    const lineRes = await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        description: 'Fuel filters',
        quantity: '50',
        unit: 'pcs',
        estimatedUnitPrice: '500',
        estimatedTotalPrice: '25000',
      });
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
        currency: 'EUR',
        requestedAt: new Date().toISOString(),
        approvalFlowId: flowId,
      });
    const reqId = reqRes.body.id;

    // Add a line worth €60k — total recomputes via service.
    await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        description: 'Main engine overhaul',
        quantity: '1',
        estimatedUnitPrice: '60000',
        estimatedTotalPrice: '60000',
      });

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

  // ── totalAmount derivation invariant ─────────────────────────────────
  // Regression suite: totalAmount must always be SUM(lines.totalPrice).
  // Client-supplied values are silently dropped by the whitelist; the
  // service recomputes on every line mutation. See
  // `PurchaseOrderService.recomputeTotal`.

  it('PO totalAmount: starts at 0; ignores client-supplied totalAmount on create', async () => {
    const poRes = await request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ title: 'totals-test', totalAmount: '9999' });
    expect(poRes.status).toBe(201);
    expect(poRes.body.totalAmount).toBe('0');
  });

  it('PO totalAmount: recomputed after addLine', async () => {
    const poRes = await request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ title: 'totals-add-line' });
    const poId = poRes.body.id;
    await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${poId}/lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ description: 'A', quantity: '5', unitPrice: '10', totalPrice: '50' });
    await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${poId}/lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ description: 'B', quantity: '3', unitPrice: '20', totalPrice: '60' });

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/purchase-orders/${poId}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(parseFloat(getRes.body.totalAmount)).toBe(110);
  });

  it('PO totalAmount: client-supplied totalAmount on update is silently ignored', async () => {
    const poRes = await request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ title: 'totals-update' });
    const poId = poRes.body.id;
    await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${poId}/lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ description: 'X', quantity: '1', unitPrice: '7', totalPrice: '7' });

    await request(app.getHttpServer())
      .patch(`/api/v1/purchase-orders/${poId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ notes: 'updated', totalAmount: '999999' });

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/purchase-orders/${poId}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(parseFloat(getRes.body.totalAmount)).toBe(7);
    expect(getRes.body.notes).toBe('updated');
  });

  it('Quote→PO conversion: PO totalAmount = SUM(po_lines.totalPrice), not the quote header total', async () => {
    // Set up RFQ + supplier
    const suppRes = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Delta Convert' });
    const supplierId = suppRes.body.id;
    const rfqRes = await request(app.getHttpServer())
      .post('/api/v1/rfqs')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ title: 'rfq-convert', supplierIds: [supplierId] });
    const rfqId = rfqRes.body.id;

    // Quote with 2 lines summing to 350 — but try to force header to 9999
    const quoteRes = await request(app.getHttpServer())
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ rfqId, supplierId, totalAmount: '9999' });
    const quoteId = quoteRes.body.id;
    expect(quoteRes.body.totalAmount).toBe('0'); // dropped by whitelist + recompute

    await request(app.getHttpServer())
      .post(`/api/v1/quotes/${quoteId}/lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ description: 'L1', quantity: '2', unitPrice: '100', totalPrice: '200' });
    await request(app.getHttpServer())
      .post(`/api/v1/quotes/${quoteId}/lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ description: 'L2', quantity: '3', unitPrice: '50', totalPrice: '150' });

    await request(app.getHttpServer())
      .post(`/api/v1/quotes/${quoteId}/accept`)
      .set('Authorization', `Bearer ${pmToken}`);

    const convertRes = await request(app.getHttpServer())
      .post(`/api/v1/quotes/${quoteId}/convert-to-po`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(convertRes.status).toBe(201);
    const poId = convertRes.body.id;

    const poGet = await request(app.getHttpServer())
      .get(`/api/v1/purchase-orders/${poId}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(parseFloat(poGet.body.totalAmount)).toBe(350);
    expect(poGet.body.lines.length).toBe(2);

    // HLC regression — previously convertToPo set `hlc: quoteId` which
    // both corrupted causality and bypassed the outbox. Now each row
    // gets a fresh HLC from `recorder.recordUpsert`.
    expect(poGet.body.hlc).toBeTruthy();
    expect(poGet.body.hlc).not.toBe(quoteId);
    for (const line of poGet.body.lines as { hlc: string }[]) {
      expect(line.hlc).toBeTruthy();
      expect(line.hlc).not.toBe(quoteId);
    }
  });
});
