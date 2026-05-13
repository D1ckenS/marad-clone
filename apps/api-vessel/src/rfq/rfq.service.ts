import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { quoteLines, quotes, rfqs } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateRfqDto } from './dto/create-rfq.dto';
import type { UpdateRfqDto } from './dto/update-rfq.dto';

const ENTITY_TYPE = 'Rfq';

@Injectable()
export class RfqService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateRfqDto) {
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
        .insert(rfqs)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
          title: dto.title,
          notes: dto.notes ?? null,
          status: 'DRAFT',
          requisitionId: dto.requisitionId ?? null,
          createdByUserId: auth.userId,
          issuedAt: dto.issuedAt ?? null,
          dueAt: dto.dueAt ?? null,
          hlc,
        })
        .returning()
        .all();
      return row;
    });
  }

  findAll(auth: AuthContext) {
    const vesselId = requireVesselId(auth);
    return this.drizzle.db
      .select()
      .from(rfqs)
      .where(
        and(eq(rfqs.tenantId, auth.tenantId), eq(rfqs.vesselId, vesselId), isNull(rfqs.deletedAt)),
      )
      .orderBy(rfqs.createdAt)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const rfq = this.drizzle.db
      .select()
      .from(rfqs)
      .where(
        and(
          eq(rfqs.id, id),
          eq(rfqs.tenantId, auth.tenantId),
          eq(rfqs.vesselId, vesselId),
          isNull(rfqs.deletedAt),
        ),
      )
      .get();
    if (rfq === undefined) throw new NotFoundException(`RFQ ${id} not found`);
    const rfqQuotes = this.drizzle.db
      .select()
      .from(quotes)
      .where(and(eq(quotes.rfqId, id), isNull(quotes.deletedAt)))
      .all()
      .map((q) => ({
        ...q,
        lines: this.drizzle.db
          .select()
          .from(quoteLines)
          .where(and(eq(quoteLines.quoteId, q.id), isNull(quoteLines.deletedAt)))
          .all(),
      }));
    return { ...rfq, quotes: rfqQuotes };
  }

  update(auth: AuthContext, id: string, dto: UpdateRfqDto) {
    const rfq = this.findOne(auth, id);
    if (rfq.status === 'CLOSED') throw new BadRequestException('Closed RFQs cannot be updated');
    const [row] = this.drizzle.db
      .update(rfqs)
      .set({
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.issuedAt !== undefined && { issuedAt: dto.issuedAt ?? null }),
        ...(dto.dueAt !== undefined && { dueAt: dto.dueAt ?? null }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(rfqs.id, id))
      .returning()
      .all();
    return row;
  }

  send(auth: AuthContext, id: string) {
    const rfq = this.findOne(auth, id);
    if (rfq.status !== 'DRAFT') throw new BadRequestException('Only DRAFT RFQs can be sent');
    const [row] = this.drizzle.db
      .update(rfqs)
      .set({
        status: 'SENT',
        issuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(rfqs.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(rfqs)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(rfqs.id, id))
      .run();
  }
}
