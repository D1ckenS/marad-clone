import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { documentRevisions, qhseDocuments } from '../db/schema';
import type {
  CreateDocumentRevisionDto,
  CreateQhseDocumentDto,
  UpdateQhseDocumentDto,
} from './dto/create-qhse-document.dto';

@Injectable()
export class QhseDocumentService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(auth: AuthContext, dto: CreateQhseDocumentDto) {
    const id = newId();
    const nowIso = new Date().toISOString();
    const [row] = this.drizzle.db
      .insert(qhseDocuments)
      .values({
        id,
        tenantId: auth.tenantId,
        title: dto.title,
        category: dto.category ?? null,
        description: dto.description ?? null,
        isControlled: dto.isControlled ?? false,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .returning()
      .all();
    return row;
  }

  findAll(auth: AuthContext) {
    return this.drizzle.db
      .select()
      .from(qhseDocuments)
      .where(and(eq(qhseDocuments.tenantId, auth.tenantId), isNull(qhseDocuments.deletedAt)))
      .orderBy(qhseDocuments.title)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(qhseDocuments)
      .where(
        and(
          eq(qhseDocuments.id, id),
          eq(qhseDocuments.tenantId, auth.tenantId),
          isNull(qhseDocuments.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`QhseDocument ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateQhseDocumentDto) {
    this.findOne(auth, id);
    const fields: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (dto.title !== undefined) fields['title'] = dto.title;
    if (dto.category !== undefined) fields['category'] = dto.category;
    if (dto.description !== undefined) fields['description'] = dto.description;
    if (dto.isControlled !== undefined) fields['isControlled'] = dto.isControlled;
    const [row] = this.drizzle.db
      .update(qhseDocuments)
      .set(fields as never)
      .where(eq(qhseDocuments.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(qhseDocuments)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(qhseDocuments.id, id))
      .run();
  }

  addRevision(auth: AuthContext, documentId: string, dto: CreateDocumentRevisionDto) {
    const doc = this.findOne(auth, documentId);
    const allRevisions = this.drizzle.db
      .select()
      .from(documentRevisions)
      .where(and(eq(documentRevisions.documentId, documentId), isNull(documentRevisions.deletedAt)))
      .all();
    const maxRevision = allRevisions.reduce((m, r) => Math.max(m, r.revisionNumber), 0);
    const revisionId = newId();
    const nowIso = new Date().toISOString();
    return this.drizzle.db.transaction((tx) => {
      const [revision] = tx
        .insert(documentRevisions)
        .values({
          id: revisionId,
          tenantId: auth.tenantId,
          documentId,
          revisionNumber: maxRevision + 1,
          s3Key: dto.s3Key,
          summary: dto.summary ?? null,
          authoredByUserId: dto.authoredByUserId ?? null,
          approvedByUserId: dto.approvedByUserId ?? null,
          approvedAt: dto.approvedAt ?? null,
          createdAt: nowIso,
        })
        .returning()
        .all();
      tx.update(qhseDocuments)
        .set({ currentRevisionId: revisionId, updatedAt: nowIso })
        .where(eq(qhseDocuments.id, documentId))
        .run();
      void doc;
      return revision;
    });
  }

  getRevisions(auth: AuthContext, documentId: string) {
    this.findOne(auth, documentId);
    return this.drizzle.db
      .select()
      .from(documentRevisions)
      .where(
        and(
          eq(documentRevisions.documentId, documentId),
          eq(documentRevisions.tenantId, auth.tenantId),
          isNull(documentRevisions.deletedAt),
        ),
      )
      .orderBy(desc(documentRevisions.revisionNumber))
      .all();
  }

  approveRevision(auth: AuthContext, revisionId: string, approvedByUserId: string) {
    const revision = this.drizzle.db
      .select()
      .from(documentRevisions)
      .where(
        and(
          eq(documentRevisions.id, revisionId),
          eq(documentRevisions.tenantId, auth.tenantId),
          isNull(documentRevisions.deletedAt),
        ),
      )
      .get();
    if (!revision) throw new NotFoundException(`DocumentRevision ${revisionId} not found`);
    if (revision.approvedAt) throw new BadRequestException('Revision already approved');
    const [row] = this.drizzle.db
      .update(documentRevisions)
      .set({ approvedByUserId, approvedAt: new Date().toISOString() })
      .where(eq(documentRevisions.id, revisionId))
      .returning()
      .all();
    return row;
  }
}
