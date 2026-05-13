import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { goodsReceiptLines, goodsReceipts, poLines, purchaseOrders, suppliers } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreatePoLineDto } from './dto/create-po-line.dto';
import type { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import type { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import type { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

const ENTITY_TYPE = 'PurchaseOrder';

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreatePurchaseOrderDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.drizzle.db.transaction((tx) => {
      const fields = { vesselId, title: dto.title, status: 'DRAFT' as const };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .insert(purchaseOrders)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
          title: dto.title,
          notes: dto.notes ?? null,
          status: 'DRAFT',
          supplierId: dto.supplierId ?? null,
          requisitionId: dto.requisitionId ?? null,
          rfqId: dto.rfqId ?? null,
          poNumber: dto.poNumber ?? null,
          totalAmount: dto.totalAmount ?? '0',
          currency: dto.currency ?? 'USD',
          orderedByUserId: auth.userId,
          expectedDeliveryAt: dto.expectedDeliveryAt ?? null,
          hlc,
        })
        .returning()
        .all();
      return row;
    });
  }

  findAll(auth: AuthContext, status?: string) {
    const vesselId = requireVesselId(auth);
    const rows = this.drizzle.db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.tenantId, auth.tenantId),
          eq(purchaseOrders.vesselId, vesselId),
          isNull(purchaseOrders.deletedAt),
          ...(status ? [eq(purchaseOrders.status, status as never)] : []),
        ),
      )
      .orderBy(purchaseOrders.createdAt)
      .all();
    return rows.map((po) => ({
      ...po,
      lines: this.drizzle.db
        .select()
        .from(poLines)
        .where(and(eq(poLines.poId, po.id), isNull(poLines.deletedAt)))
        .all(),
    }));
  }

  findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const po = this.drizzle.db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.id, id),
          eq(purchaseOrders.tenantId, auth.tenantId),
          eq(purchaseOrders.vesselId, vesselId),
          isNull(purchaseOrders.deletedAt),
        ),
      )
      .get();
    if (po === undefined) throw new NotFoundException(`PurchaseOrder ${id} not found`);
    const lines = this.drizzle.db
      .select()
      .from(poLines)
      .where(and(eq(poLines.poId, id), isNull(poLines.deletedAt)))
      .all();
    const supplier = po.supplierId
      ? this.drizzle.db.select().from(suppliers).where(eq(suppliers.id, po.supplierId)).get()
      : null;
    return { ...po, lines, supplier };
  }

  update(auth: AuthContext, id: string, dto: UpdatePurchaseOrderDto) {
    const po = this.findOne(auth, id);
    if (po.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT purchase orders can be updated');
    const [row] = this.drizzle.db
      .update(purchaseOrders)
      .set({
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
        ...(dto.poNumber !== undefined && { poNumber: dto.poNumber }),
        ...(dto.totalAmount !== undefined && { totalAmount: dto.totalAmount }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.expectedDeliveryAt !== undefined && {
          expectedDeliveryAt: dto.expectedDeliveryAt ?? null,
        }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(purchaseOrders.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    const po = this.findOne(auth, id);
    if (po.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT purchase orders can be deleted');
    this.drizzle.db
      .update(purchaseOrders)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(purchaseOrders.id, id))
      .run();
  }

  addLine(auth: AuthContext, poId: string, dto: CreatePoLineDto) {
    const po = this.findOne(auth, poId);
    if (po.status !== 'DRAFT')
      throw new BadRequestException('Lines can only be added to DRAFT purchase orders');
    const vesselId = requireVesselId(auth);
    const [row] = this.drizzle.db
      .insert(poLines)
      .values({
        id: newId(),
        tenantId: auth.tenantId,
        vesselId,
        poId,
        partId: dto.partId ?? null,
        description: dto.description,
        quantity: dto.quantity,
        unit: dto.unit ?? 'pcs',
        unitPrice: dto.unitPrice,
        totalPrice: dto.totalPrice,
        currency: dto.currency ?? 'USD',
        requisitionLineId: dto.requisitionLineId ?? null,
        quoteLineId: dto.quoteLineId ?? null,
      })
      .returning()
      .all();
    return row;
  }

  send(auth: AuthContext, id: string) {
    const po = this.findOne(auth, id);
    if (po.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT purchase orders can be sent');
    if (!po.supplierId)
      throw new BadRequestException('A supplier must be set before sending a purchase order');
    const [row] = this.drizzle.db
      .update(purchaseOrders)
      .set({
        status: 'SENT',
        orderedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(purchaseOrders.id, id))
      .returning()
      .all();
    return row;
  }

  receive(auth: AuthContext, id: string, dto: ReceivePurchaseOrderDto) {
    const po = this.findOne(auth, id);
    const receivableStatuses = ['SENT', 'ACKNOWLEDGED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'];
    if (!receivableStatuses.includes(po.status)) {
      throw new BadRequestException(`Cannot receive against a PO with status ${po.status}`);
    }

    const vesselId = requireVesselId(auth);
    const receiptId = newId();

    return this.drizzle.db.transaction((tx) => {
      tx.insert(goodsReceipts)
        .values({
          id: receiptId,
          tenantId: auth.tenantId,
          vesselId,
          poId: id,
          receivedByUserId: auth.userId,
          receivedAt: new Date().toISOString(),
          notes: dto.notes ?? null,
        })
        .run();

      const insertedLines = dto.lines.map((l) => {
        const poLine = po.lines.find((pl) => pl.id === l.poLineId);
        if (!poLine) throw new BadRequestException(`PO line ${l.poLineId} not found on PO ${id}`);
        const [rl] = tx
          .insert(goodsReceiptLines)
          .values({
            id: newId(),
            tenantId: auth.tenantId,
            vesselId,
            receiptId,
            poLineId: l.poLineId,
            partId: poLine.partId,
            description: poLine.description,
            quantityOrdered: poLine.quantity,
            quantityReceived: l.quantityReceived,
            unit: poLine.unit,
            notes: l.notes ?? null,
          })
          .returning()
          .all();
        return rl;
      });

      // Compute total received vs ordered across all receipts
      const allGrls = tx
        .select()
        .from(goodsReceiptLines)
        .where(
          and(eq(goodsReceiptLines.tenantId, auth.tenantId), isNull(goodsReceiptLines.deletedAt)),
        )
        .all()
        .filter((rl) => po.lines.some((pl) => pl.id === rl.poLineId));

      const receivedMap = new Map<string, number>();
      for (const rl of allGrls) {
        receivedMap.set(
          rl.poLineId,
          (receivedMap.get(rl.poLineId) ?? 0) + parseFloat(rl.quantityReceived ?? '0'),
        );
      }

      const allReceived = po.lines.every(
        (pl) => (receivedMap.get(pl.id) ?? 0) >= parseFloat(pl.quantity ?? '0'),
      );

      const newStatus = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
      tx.update(purchaseOrders)
        .set({ status: newStatus, updatedAt: new Date().toISOString() })
        .where(eq(purchaseOrders.id, id))
        .run();

      return { receiptId, receiptLines: insertedLines, poStatus: newStatus };
    });
  }
}
