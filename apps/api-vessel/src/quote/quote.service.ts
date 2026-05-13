import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { quoteLines, quotes, suppliers } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateQuoteDto } from './dto/create-quote.dto';
import type { CreateQuoteLineDto } from './dto/create-quote-line.dto';

const ENTITY_TYPE = 'Quote';
const LINE_ENTITY_TYPE = 'QuoteLine';

@Injectable()
export class QuoteService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateQuoteDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId,
        rfqId: dto.rfqId,
        supplierId: dto.supplierId,
        status: 'PENDING' as const,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .insert(quotes)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
          rfqId: dto.rfqId,
          supplierId: dto.supplierId,
          totalAmount: dto.totalAmount ?? '0',
          currency: dto.currency ?? 'USD',
          notes: dto.notes ?? null,
          status: 'PENDING',
          validUntil: dto.validUntil ?? null,
          hlc,
        })
        .returning()
        .all();
      return row;
    });
  }

  findAll(auth: AuthContext, rfqId?: string) {
    const vesselId = requireVesselId(auth);
    const rows = this.drizzle.db
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.tenantId, auth.tenantId),
          eq(quotes.vesselId, vesselId),
          isNull(quotes.deletedAt),
          ...(rfqId ? [eq(quotes.rfqId, rfqId)] : []),
        ),
      )
      .orderBy(quotes.createdAt)
      .all();
    return rows.map((q) => ({
      ...q,
      lines: this.drizzle.db
        .select()
        .from(quoteLines)
        .where(and(eq(quoteLines.quoteId, q.id), isNull(quoteLines.deletedAt)))
        .all(),
    }));
  }

  findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const quote = this.drizzle.db
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.id, id),
          eq(quotes.tenantId, auth.tenantId),
          eq(quotes.vesselId, vesselId),
          isNull(quotes.deletedAt),
        ),
      )
      .get();
    if (quote === undefined) throw new NotFoundException(`Quote ${id} not found`);
    const supplier = this.drizzle.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, quote.supplierId))
      .get();
    const lines = this.drizzle.db
      .select()
      .from(quoteLines)
      .where(and(eq(quoteLines.quoteId, id), isNull(quoteLines.deletedAt)))
      .all();
    return { ...quote, supplier, lines };
  }

  addLine(auth: AuthContext, quoteId: string, dto: CreateQuoteLineDto) {
    const quote = this.findOne(auth, quoteId);
    if (quote.status !== 'PENDING')
      throw new BadRequestException('Lines can only be added to PENDING quotes');
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.drizzle.db.transaction((tx) => {
      const fields = { vesselId, quoteId, description: dto.description, quantity: dto.quantity };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        LINE_ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .insert(quoteLines)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
          quoteId,
          partId: dto.partId ?? null,
          description: dto.description,
          quantity: dto.quantity,
          unit: dto.unit ?? 'pcs',
          unitPrice: dto.unitPrice,
          totalPrice: dto.totalPrice,
          currency: dto.currency ?? 'USD',
          notes: dto.notes ?? null,
          hlc,
        })
        .returning()
        .all();
      return row;
    });
  }

  accept(auth: AuthContext, id: string) {
    const quote = this.findOne(auth, id);
    if (quote.status !== 'PENDING')
      throw new BadRequestException('Only PENDING quotes can be accepted');
    const [row] = this.drizzle.db
      .update(quotes)
      .set({ status: 'ACCEPTED', updatedAt: new Date().toISOString() })
      .where(eq(quotes.id, id))
      .returning()
      .all();
    return row;
  }

  reject(auth: AuthContext, id: string) {
    const quote = this.findOne(auth, id);
    if (quote.status !== 'PENDING')
      throw new BadRequestException('Only PENDING quotes can be rejected');
    const [row] = this.drizzle.db
      .update(quotes)
      .set({ status: 'REJECTED', updatedAt: new Date().toISOString() })
      .where(eq(quotes.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(quotes)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(quotes.id, id))
      .run();
  }
}
