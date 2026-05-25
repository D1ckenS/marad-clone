import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxRecorder } from '../sync/outbox-recorder';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import type { CreateQuoteDto } from './dto/create-quote.dto';
import type { CreateQuoteLineDto } from './dto/create-quote-line.dto';

const ENTITY_TYPE = 'Quote';
const LINE_ENTITY_TYPE = 'QuoteLine';

@Injectable()
export class QuoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recorder: OutboxRecorder,
  ) {}

  async create(auth: AuthContext, dto: CreateQuoteDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const fields = {
        vesselId,
        rfqId: dto.rfqId,
        supplierId: dto.supplierId,
        status: 'PENDING' as const,
      };
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId!, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      return tx.quote.create({
        data: {
          id,
          tenantId: auth.tenantId!,
          vesselId,
          rfqId: dto.rfqId,
          supplierId: dto.supplierId,
          // totalAmount derived from line sums; see `recomputeTotal`.
          totalAmount: new Prisma.Decimal(0),
          currency: dto.currency ?? 'USD',
          notes: dto.notes ?? null,
          status: 'PENDING',
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          hlc,
        },
      });
    });
  }

  /** Re-derive Quote.totalAmount from SUM(quote_lines.totalPrice). */
  static async recomputeTotal(tx: Prisma.TransactionClient, quoteId: string) {
    const agg = await tx.quoteLine.aggregate({
      where: { quoteId, deletedAt: null },
      _sum: { totalPrice: true },
    });
    const total = agg._sum.totalPrice ?? new Prisma.Decimal(0);
    await tx.quote.update({
      where: { id: quoteId },
      data: { totalAmount: total },
    });
    return total;
  }

  findAll(auth: AuthContext, rfqId?: string) {
    const vesselId = requireVesselId(auth);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.quote.findMany({
        where: {
          tenantId: auth.tenantId!,
          vesselId,
          deletedAt: null,
          ...(rfqId && { rfqId }),
        },
        include: { lines: { where: { deletedAt: null } }, supplier: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.quote.findFirst({
        where: { id, tenantId: auth.tenantId!, vesselId, deletedAt: null },
        include: { lines: { where: { deletedAt: null } }, supplier: true },
      }),
    );
    if (row === null) throw new NotFoundException(`Quote ${id} not found`);
    return row;
  }

  async addLine(auth: AuthContext, quoteId: string, dto: CreateQuoteLineDto) {
    const quote = await this.findOne(auth, quoteId);
    if (quote.status !== 'PENDING')
      throw new BadRequestException('Lines can only be added to PENDING quotes');
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const fields = { vesselId, quoteId, description: dto.description, quantity: dto.quantity };
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId!, vesselId },
        LINE_ENTITY_TYPE,
        id,
        fields,
      );
      const line = await tx.quoteLine.create({
        data: {
          id,
          tenantId: auth.tenantId!,
          vesselId,
          quoteId,
          partId: dto.partId ?? null,
          description: dto.description,
          quantity: new Prisma.Decimal(dto.quantity),
          unit: dto.unit ?? 'pcs',
          unitPrice: new Prisma.Decimal(dto.unitPrice),
          totalPrice: new Prisma.Decimal(dto.totalPrice),
          currency: dto.currency ?? 'USD',
          notes: dto.notes ?? null,
          hlc,
        },
      });
      await QuoteService.recomputeTotal(tx as Prisma.TransactionClient, quoteId);
      return line;
    });
  }

  async accept(auth: AuthContext, id: string) {
    const quote = await this.findOne(auth, id);
    if (quote.status !== 'PENDING')
      throw new BadRequestException('Only PENDING quotes can be accepted');
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.quote.update({ where: { id }, data: { status: 'ACCEPTED' } }),
    );
  }

  async reject(auth: AuthContext, id: string) {
    const quote = await this.findOne(auth, id);
    if (quote.status !== 'PENDING')
      throw new BadRequestException('Only PENDING quotes can be rejected');
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.quote.update({ where: { id }, data: { status: 'REJECTED' } }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.quote.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  async convertToPo(auth: AuthContext, id: string) {
    const quote = await this.findOne(auth, id);
    if (quote.status !== 'ACCEPTED')
      throw new BadRequestException('Only ACCEPTED quotes can be converted to a PO');
    const vesselId = quote.vesselId;
    const poId = newId();
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      // Mint a fresh HLC for the PO via the recorder. Previously this
      // code set `hlc: id` (the source Quote's id) which corrupted
      // causality in the sync engine — and skipped the outbox entirely,
      // so converted POs never replicated. Going through the recorder
      // fixes both.
      const poFields = {
        vesselId,
        rfqId: quote.rfqId,
        supplierId: quote.supplierId,
        title: `PO from Quote ${id.slice(-8)}`,
        status: 'DRAFT' as const,
        currency: quote.currency,
      };
      const { hlc: poHlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId!, vesselId },
        'PurchaseOrder',
        poId,
        poFields,
      );
      await tx.purchaseOrder.create({
        data: {
          id: poId,
          tenantId: auth.tenantId!,
          ...poFields,
          // totalAmount left at 0; recomputed below from inserted lines.
          totalAmount: new Prisma.Decimal(0),
          hlc: poHlc,
        },
      });
      for (const l of quote.lines) {
        const lineId = newId();
        const lineFields = {
          vesselId,
          poId,
          description: l.description,
          quantity: l.quantity.toString(),
          unit: l.unit,
          unitPrice: l.unitPrice.toString(),
          totalPrice: l.totalPrice.toString(),
          currency: l.currency,
          quoteLineId: l.id,
        };
        const { hlc: lineHlc } = await this.recorder.recordUpsert(
          tx as unknown as Prisma.TransactionClient,
          { tenantId: auth.tenantId!, vesselId },
          'POLine',
          lineId,
          lineFields,
        );
        await tx.pOLine.create({
          data: {
            id: lineId,
            tenantId: auth.tenantId!,
            poId,
            vesselId,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
            totalPrice: l.totalPrice,
            currency: l.currency,
            quoteLineId: l.id,
            hlc: lineHlc,
          },
        });
      }
      await PurchaseOrderService.recomputeTotal(tx as Prisma.TransactionClient, poId);
      return tx.purchaseOrder.findUnique({ where: { id: poId } });
    });
  }
}
