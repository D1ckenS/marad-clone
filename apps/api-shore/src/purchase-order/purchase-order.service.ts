import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreatePoLineDto } from './dto/create-po-line.dto';
import type { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import type { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import type { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

const ENTITY_TYPE = 'PurchaseOrder';

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recorder: OutboxRecorder,
  ) {}

  async create(auth: AuthContext, dto: CreatePurchaseOrderDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const fields = { vesselId, title: dto.title, status: 'DRAFT' as const };
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      return tx.purchaseOrder.create({
        data: {
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
          totalAmount: new Prisma.Decimal(dto.totalAmount ?? '0'),
          currency: dto.currency ?? 'USD',
          orderedByUserId: auth.userId,
          expectedDeliveryAt: dto.expectedDeliveryAt ? new Date(dto.expectedDeliveryAt) : null,
          hlc,
        },
      });
    });
  }

  findAll(auth: AuthContext, status?: string) {
    const vesselId = requireVesselId(auth);
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.purchaseOrder.findMany({
        where: {
          tenantId: auth.tenantId,
          vesselId,
          deletedAt: null,
          ...(status && { status: status as never }),
        },
        include: {
          lines: { where: { deletedAt: null } },
          supplier: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.purchaseOrder.findFirst({
        where: { id, tenantId: auth.tenantId, vesselId, deletedAt: null },
        include: {
          lines: { where: { deletedAt: null } },
          supplier: true,
          receipts: { where: { deletedAt: null }, include: { lines: true } },
        },
      }),
    );
    if (row === null) throw new NotFoundException(`PurchaseOrder ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdatePurchaseOrderDto) {
    const po = await this.findOne(auth, id);
    if (po.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT purchase orders can be updated');
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
          ...(dto.poNumber !== undefined && { poNumber: dto.poNumber }),
          ...(dto.totalAmount !== undefined && {
            totalAmount: new Prisma.Decimal(dto.totalAmount),
          }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.expectedDeliveryAt !== undefined && {
            expectedDeliveryAt: dto.expectedDeliveryAt ? new Date(dto.expectedDeliveryAt) : null,
          }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    const po = await this.findOne(auth, id);
    if (po.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT purchase orders can be deleted');
    await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.purchaseOrder.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  async addLine(auth: AuthContext, poId: string, dto: CreatePoLineDto) {
    const po = await this.findOne(auth, poId);
    if (po.status !== 'DRAFT')
      throw new BadRequestException('Lines can only be added to DRAFT purchase orders');
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.pOLine.create({
        data: {
          id,
          tenantId: auth.tenantId,
          vesselId,
          poId,
          partId: dto.partId ?? null,
          description: dto.description,
          quantity: new Prisma.Decimal(dto.quantity),
          unit: dto.unit ?? 'pcs',
          unitPrice: new Prisma.Decimal(dto.unitPrice),
          totalPrice: new Prisma.Decimal(dto.totalPrice),
          currency: dto.currency ?? 'USD',
          requisitionLineId: dto.requisitionLineId ?? null,
          quoteLineId: dto.quoteLineId ?? null,
        },
      }),
    );
  }

  async send(auth: AuthContext, id: string) {
    const po = await this.findOne(auth, id);
    if (po.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT purchase orders can be sent');
    if (!po.supplierId)
      throw new BadRequestException('A supplier must be set before sending a purchase order');
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.purchaseOrder.update({
        where: { id },
        data: { status: 'SENT', orderedAt: new Date() },
      }),
    );
  }

  async receive(auth: AuthContext, id: string, dto: ReceivePurchaseOrderDto) {
    const po = await this.findOne(auth, id);
    if (!['SENT', 'ACKNOWLEDGED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(po.status)) {
      throw new BadRequestException(`Cannot receive against a PO with status ${po.status}`);
    }

    const vesselId = requireVesselId(auth);
    const receiptId = newId();

    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          id: receiptId,
          tenantId: auth.tenantId,
          vesselId,
          poId: id,
          receivedByUserId: auth.userId,
          receivedAt: new Date(),
          notes: dto.notes ?? null,
        },
      });

      const lineInserts = dto.lines.map(async (l) => {
        const poLine = po.lines.find((pl) => pl.id === l.poLineId);
        if (!poLine) throw new BadRequestException(`PO line ${l.poLineId} not found on PO ${id}`);
        return tx.goodsReceiptLine.create({
          data: {
            id: newId(),
            tenantId: auth.tenantId,
            vesselId,
            receiptId,
            poLineId: l.poLineId,
            partId: poLine.partId,
            description: poLine.description,
            quantityOrdered: poLine.quantity,
            quantityReceived: new Prisma.Decimal(l.quantityReceived),
            unit: poLine.unit,
            notes: l.notes ?? null,
          },
        });
      });

      const receiptLines = await Promise.all(lineInserts);

      // Determine new PO status by comparing total received vs ordered across all receipts
      const allReceipts = await tx.goodsReceipt.findMany({
        where: { poId: id, tenantId: auth.tenantId, deletedAt: null },
        include: { lines: true },
      });

      const receivedMap = new Map<string, Prisma.Decimal>();
      for (const r of allReceipts) {
        for (const rl of r.lines) {
          const prev = receivedMap.get(rl.poLineId) ?? new Prisma.Decimal(0);
          receivedMap.set(rl.poLineId, prev.add(rl.quantityReceived));
        }
      }

      const allReceived = po.lines.every((pl) => {
        const received = receivedMap.get(pl.id) ?? new Prisma.Decimal(0);
        return received.greaterThanOrEqualTo(pl.quantity);
      });

      const newStatus = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
      await tx.purchaseOrder.update({ where: { id }, data: { status: newStatus } });

      return { receipt, receiptLines, poStatus: newStatus };
    });
  }
}
