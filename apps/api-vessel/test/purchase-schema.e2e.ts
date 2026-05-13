import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulidx';
import { eq, and } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DrizzleService } from '../src/db/drizzle.service';
import {
  approvalFlows,
  approvalSteps,
  goodsReceiptLines,
  goodsReceipts,
  poLines,
  purchaseOrders,
  quoteLines,
  quotes,
  requisitionLines,
  requisitions,
  rfqs,
  suppliers,
  tenants,
  vessels,
} from '../src/db/schema';

let app: INestApplication;
let drizzle: DrizzleService;

const tenantId = ulid();
const vesselId = ulid();

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  drizzle = moduleRef.get(DrizzleService);

  drizzle.db.insert(tenants).values({ id: tenantId, name: 'purchase-vessel-test' }).run();
  drizzle.db.insert(vessels).values({ id: vesselId, tenantId, name: 'MV Drizzle Purchase' }).run();
});

afterAll(async () => {
  await app.close();
});

describe('P1-7 purchase schema — SQLite', () => {
  it('round-trips Supplier (tenant-scoped)', () => {
    const supplierId = ulid();
    drizzle.db
      .insert(suppliers)
      .values({
        id: supplierId,
        tenantId,
        name: 'NorthSea Parts',
        contactEmail: 'sales@northsea.com',
        country: 'NO',
      })
      .run();

    const stored = drizzle.db.select().from(suppliers).where(eq(suppliers.id, supplierId)).all();
    expect(stored[0]?.name).toBe('NorthSea Parts');
    expect(stored[0]?.country).toBe('NO');
    expect(stored[0]?.isActive).toBe(true); // integer({ mode: 'boolean' }) returns JS boolean
  });

  it('round-trips ApprovalFlow + ApprovalStep with financial limit', () => {
    const flowId = ulid();
    const stepId = ulid();

    drizzle.db
      .insert(approvalFlows)
      .values({ id: flowId, tenantId, name: 'Standard Approval' })
      .run();
    drizzle.db
      .insert(approvalSteps)
      .values({
        id: stepId,
        tenantId,
        flowId,
        stepOrder: 1,
        approverRole: 'PURCHASE_MANAGER',
        limitAmount: '50000',
        limitCurrency: 'EUR',
      })
      .run();

    const step = drizzle.db.select().from(approvalSteps).where(eq(approvalSteps.id, stepId)).all();
    expect(step[0]?.approverRole).toBe('PURCHASE_MANAGER');
    expect(step[0]?.limitAmount).toBe('50000');
    expect(step[0]?.limitCurrency).toBe('EUR');
  });

  it('rejects duplicate ApprovalStep (flowId, stepOrder) unique constraint', () => {
    const flowId = ulid();
    drizzle.db.insert(approvalFlows).values({ id: flowId, tenantId, name: 'Dup-flow' }).run();
    drizzle.db
      .insert(approvalSteps)
      .values({ id: ulid(), tenantId, flowId, stepOrder: 1, approverRole: 'MASTER' })
      .run();

    expect(() =>
      drizzle.db
        .insert(approvalSteps)
        .values({ id: ulid(), tenantId, flowId, stepOrder: 1, approverRole: 'CHIEF_ENGINEER' })
        .run(),
    ).toThrow(/unique|UNIQUE constraint/i);
  });

  it('round-trips Requisition with lines', () => {
    const reqId = ulid();
    const lineId = ulid();

    drizzle.db
      .insert(requisitions)
      .values({
        id: reqId,
        tenantId,
        vesselId,
        title: 'Q3 spares',
        status: 'DRAFT',
        requestedAt: new Date().toISOString(),
      })
      .run();
    drizzle.db
      .insert(requisitionLines)
      .values({
        id: lineId,
        tenantId,
        vesselId,
        requisitionId: reqId,
        description: 'Oil filter 10W-40',
        quantity: '12',
        estimatedUnitPrice: '15.50',
        estimatedTotalPrice: '186.00',
        currency: 'USD',
      })
      .run();

    const lines = drizzle.db
      .select()
      .from(requisitionLines)
      .where(eq(requisitionLines.requisitionId, reqId))
      .all();
    expect(lines).toHaveLength(1);
    expect(lines[0]?.estimatedUnitPrice).toBe('15.5'); // SQLite TEXT strips trailing zeros
  });

  it('blocks APPROVED status without approvedByUserId (CHECK constraint)', () => {
    const reqId = ulid();
    drizzle.db
      .insert(requisitions)
      .values({
        id: reqId,
        tenantId,
        vesselId,
        title: 'CHECK test',
        status: 'SUBMITTED',
        requestedAt: new Date().toISOString(),
      })
      .run();

    expect(() =>
      drizzle.db
        .update(requisitions)
        .set({ status: 'APPROVED', approvedByUserId: null })
        .where(eq(requisitions.id, reqId))
        .run(),
    ).toThrow(/CHECK constraint/i);

    // With an approver it succeeds
    drizzle.db
      .update(requisitions)
      .set({ status: 'APPROVED', approvedByUserId: ulid() })
      .where(eq(requisitions.id, reqId))
      .run();
    const updated = drizzle.db.select().from(requisitions).where(eq(requisitions.id, reqId)).all();
    expect(updated[0]?.status).toBe('APPROVED');
  });

  it('full chain: RFQ → Quote → QuoteLine → PO → POLine → GoodsReceipt → partial GRN', () => {
    const supplierId = ulid();
    const rfqId = ulid();
    const quoteId = ulid();
    const quoteLineId = ulid();
    const poId = ulid();
    const poLineId = ulid();
    const receiptId = ulid();
    const receiptLineId = ulid();

    drizzle.db.insert(suppliers).values({ id: supplierId, tenantId, name: 'Beta Marine' }).run();
    drizzle.db
      .insert(rfqs)
      .values({ id: rfqId, tenantId, vesselId, title: 'RFQ-V01', status: 'SENT' })
      .run();
    drizzle.db
      .insert(quotes)
      .values({
        id: quoteId,
        tenantId,
        vesselId,
        rfqId,
        supplierId,
        totalAmount: '500',
        status: 'ACCEPTED',
      })
      .run();
    drizzle.db
      .insert(quoteLines)
      .values({
        id: quoteLineId,
        tenantId,
        vesselId,
        quoteId,
        description: 'Pump seal kit',
        quantity: '5',
        unitPrice: '100',
        totalPrice: '500',
      })
      .run();
    drizzle.db
      .insert(purchaseOrders)
      .values({
        id: poId,
        tenantId,
        vesselId,
        supplierId,
        rfqId,
        title: 'PO-V01',
        status: 'IN_TRANSIT',
        totalAmount: '500',
      })
      .run();
    drizzle.db
      .insert(poLines)
      .values({
        id: poLineId,
        tenantId,
        vesselId,
        poId,
        description: 'Pump seal kit',
        quantity: '5',
        unitPrice: '100',
        totalPrice: '500',
        quoteLineId,
      })
      .run();
    drizzle.db
      .insert(goodsReceipts)
      .values({
        id: receiptId,
        tenantId,
        vesselId,
        poId,
        receivedAt: new Date().toISOString(),
      })
      .run();
    // Partial: 3 of 5 received
    drizzle.db
      .insert(goodsReceiptLines)
      .values({
        id: receiptLineId,
        tenantId,
        vesselId,
        receiptId,
        poLineId,
        quantityOrdered: '5',
        quantityReceived: '3',
      })
      .run();

    const grl = drizzle.db
      .select()
      .from(goodsReceiptLines)
      .where(
        and(eq(goodsReceiptLines.receiptId, receiptId), eq(goodsReceiptLines.poLineId, poLineId)),
      )
      .all();
    expect(grl[0]?.quantityOrdered).toBe('5');
    expect(grl[0]?.quantityReceived).toBe('3');
  });
});
