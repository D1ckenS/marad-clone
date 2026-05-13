import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulidx';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

let app: INestApplication;
let prisma: PrismaService;

const tenantId = ulid();
const vesselId = ulid();

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  prisma = moduleRef.get(PrismaService);

  await prisma.tenant.create({ data: { id: tenantId, name: 'purchase-schema-test' } });
  await prisma.vessel.create({ data: { id: vesselId, tenantId, name: 'MV Purchase' } });
});

afterAll(async () => {
  await prisma.goodsReceiptLine.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.goodsReceipt.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.pOLine.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.purchaseOrder.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.quoteLine.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.quote.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.rfq.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.requisitionLine.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.requisition.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.approvalStep.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.approvalFlow.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.supplier.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('P1-7 purchase schema — Postgres', () => {
  it('round-trips Supplier (tenant-scoped, no vessel_id)', async () => {
    const supplierId = ulid();
    await prisma.supplier.create({
      data: {
        id: supplierId,
        tenantId,
        name: 'MechParts B.V.',
        contactEmail: 'orders@mechparts.nl',
        country: 'NL',
      },
    });
    const stored = await prisma.supplier.findUnique({ where: { id: supplierId } });
    expect(stored?.name).toBe('MechParts B.V.');
    expect(stored?.country).toBe('NL');
    expect(stored?.isActive).toBe(true);
  });

  it('round-trips ApprovalFlow with single ApprovalStep (limit enforcement model)', async () => {
    const flowId = ulid();
    const stepId = ulid();
    await prisma.approvalFlow.create({
      data: { id: flowId, tenantId, name: 'Standard Purchase Approval' },
    });
    await prisma.approvalStep.create({
      data: {
        id: stepId,
        tenantId,
        flowId,
        stepOrder: 1,
        approverRole: 'PURCHASE_MANAGER',
        limitAmount: new Prisma.Decimal('50000'),
        limitCurrency: 'EUR',
      },
    });

    const step = await prisma.approvalStep.findUnique({
      where: { id: stepId },
      include: { flow: true },
    });
    expect(step?.approverRole).toBe('PURCHASE_MANAGER');
    expect(step?.limitAmount?.toString()).toBe('50000');
    expect(step?.flow?.name).toBe('Standard Purchase Approval');
  });

  it('rejects duplicate ApprovalStep (flow, stepOrder) pair', async () => {
    const flowId = ulid();
    await prisma.approvalFlow.create({ data: { id: flowId, tenantId, name: 'Dup-test flow' } });
    await prisma.approvalStep.create({
      data: { id: ulid(), tenantId, flowId, stepOrder: 1, approverRole: 'MASTER' },
    });
    await expect(
      prisma.approvalStep.create({
        data: { id: ulid(), tenantId, flowId, stepOrder: 1, approverRole: 'CHIEF_ENGINEER' },
      }),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it('round-trips Requisition → RequisitionLine with estimated prices', async () => {
    const reqId = ulid();
    const lineId = ulid();

    await prisma.requisition.create({
      data: {
        id: reqId,
        tenantId,
        vesselId,
        title: 'Engine spares Q3',
        status: 'DRAFT',
        totalAmount: new Prisma.Decimal('1200.00'),
        currency: 'USD',
        requestedAt: new Date(),
      },
    });
    await prisma.requisitionLine.create({
      data: {
        id: lineId,
        tenantId,
        vesselId,
        requisitionId: reqId,
        description: 'Fuel filter cartridge',
        quantity: new Prisma.Decimal('10'),
        estimatedUnitPrice: new Prisma.Decimal('120.00'),
        estimatedTotalPrice: new Prisma.Decimal('1200.00'),
        currency: 'USD',
      },
    });

    const req = await prisma.requisition.findUnique({
      where: { id: reqId },
      include: { lines: true },
    });
    expect(req?.status).toBe('DRAFT');
    expect(req?.lines).toHaveLength(1);
    expect(req?.lines[0]?.estimatedUnitPrice?.toString()).toBe('120');
  });

  it('blocks setting status=APPROVED without approvedByUserId (CHECK constraint)', async () => {
    const reqId = ulid();
    await prisma.requisition.create({
      data: {
        id: reqId,
        tenantId,
        vesselId,
        title: 'Check-constraint test',
        status: 'SUBMITTED',
        requestedAt: new Date(),
      },
    });

    await expect(
      prisma.requisition.update({
        where: { id: reqId },
        data: { status: 'APPROVED', approvedByUserId: null },
      }),
    ).rejects.toThrow(/check|constraint/i);

    // With approver set it must succeed
    await prisma.requisition.update({
      where: { id: reqId },
      data: { status: 'APPROVED', approvedByUserId: ulid(), approvedAt: new Date() },
    });
    const updated = await prisma.requisition.findUnique({ where: { id: reqId } });
    expect(updated?.status).toBe('APPROVED');
  });

  it('blocks PO status != DRAFT without supplierId (CHECK constraint)', async () => {
    const poId = ulid();
    await prisma.purchaseOrder.create({
      data: {
        id: poId,
        tenantId,
        vesselId,
        title: 'PO check-constraint test',
        status: 'DRAFT',
      },
    });

    await expect(
      prisma.purchaseOrder.update({
        where: { id: poId },
        data: { status: 'SENT', supplierId: null },
      }),
    ).rejects.toThrow(/check|constraint/i);
  });

  it('full procurement chain: RFQ → Quote → PO → GoodsReceipt with partial qty', async () => {
    const supplierId = ulid();
    const rfqId = ulid();
    const quoteId = ulid();
    const poId = ulid();
    const poLineId = ulid();
    const receiptId = ulid();
    const receiptLineId = ulid();

    await prisma.supplier.create({ data: { id: supplierId, tenantId, name: 'Alpha Parts' } });
    await prisma.rfq.create({
      data: { id: rfqId, tenantId, vesselId, title: 'RFQ-001', status: 'SENT' },
    });
    await prisma.quote.create({
      data: {
        id: quoteId,
        tenantId,
        vesselId,
        rfqId,
        supplierId,
        totalAmount: new Prisma.Decimal('800.00'),
        currency: 'USD',
        status: 'ACCEPTED',
      },
    });
    await prisma.purchaseOrder.create({
      data: {
        id: poId,
        tenantId,
        vesselId,
        supplierId,
        rfqId,
        title: 'PO-001',
        status: 'IN_TRANSIT',
        totalAmount: new Prisma.Decimal('800.00'),
        currency: 'USD',
      },
    });
    await prisma.pOLine.create({
      data: {
        id: poLineId,
        tenantId,
        vesselId,
        poId,
        description: 'Hydraulic hose 1"',
        quantity: new Prisma.Decimal('10'),
        unitPrice: new Prisma.Decimal('80.00'),
        totalPrice: new Prisma.Decimal('800.00'),
        currency: 'USD',
      },
    });
    // Partial receipt: 8 of 10 ordered
    await prisma.goodsReceipt.create({
      data: { id: receiptId, tenantId, vesselId, poId, receivedAt: new Date() },
    });
    await prisma.goodsReceiptLine.create({
      data: {
        id: receiptLineId,
        tenantId,
        vesselId,
        receiptId,
        poLineId,
        quantityOrdered: new Prisma.Decimal('10'),
        quantityReceived: new Prisma.Decimal('8'),
      },
    });

    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id: receiptId },
      include: { lines: true },
    });
    expect(receipt?.lines).toHaveLength(1);
    expect(receipt?.lines[0]?.quantityReceived.toString()).toBe('8');
    expect(receipt?.lines[0]?.quantityOrdered.toString()).toBe('10');
  });

  it('declares RLS tenant_isolation policies on all purchase tables', async () => {
    const tables = [
      'suppliers',
      'approval_flows',
      'approval_steps',
      'requisitions',
      'requisition_lines',
      'rfqs',
      'quotes',
      'quote_lines',
      'purchase_orders',
      'po_lines',
      'goods_receipts',
      'goods_receipt_lines',
    ];
    const rows = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_policies
      WHERE schemaname = 'public' AND policyname LIKE '%_tenant_isolation'
    `;
    const found = new Set(rows.map((r) => r.tablename));
    for (const t of tables) {
      expect(found.has(t), `pg_policies missing tenant_isolation on ${t}`).toBe(true);
    }
  });
});
