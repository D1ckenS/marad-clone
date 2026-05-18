import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateDocumentRevisionDto,
  CreateQhseDocumentDto,
  UpdateQhseDocumentDto,
} from './dto/create-qhse-document.dto';

@Injectable()
export class QhseDocumentService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateQhseDocumentDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.qhseDocument.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          title: dto.title,
          category: dto.category ?? null,
          description: dto.description ?? null,
          isControlled: dto.isControlled ?? false,
        },
        include: { revisions: { where: { deletedAt: null }, orderBy: { revisionNumber: 'desc' } } },
      }),
    );
  }

  findAll(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.qhseDocument.findMany({
        where: { tenantId: auth.tenantId!, deletedAt: null },
        include: {
          revisions: { where: { deletedAt: null }, orderBy: { revisionNumber: 'desc' }, take: 1 },
        },
        orderBy: { title: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.qhseDocument.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
        include: { revisions: { where: { deletedAt: null }, orderBy: { revisionNumber: 'desc' } } },
      }),
    );
    if (!row) throw new NotFoundException(`QhseDocument ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateQhseDocumentDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.qhseDocument.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.isControlled !== undefined && { isControlled: dto.isControlled }),
        },
        include: { revisions: { where: { deletedAt: null }, orderBy: { revisionNumber: 'desc' } } },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.qhseDocument.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  async addRevision(auth: AuthContext, documentId: string, dto: CreateDocumentRevisionDto) {
    const doc = await this.findOne(auth, documentId);
    const maxRevision = doc.revisions.reduce((m, r) => Math.max(m, r.revisionNumber), 0);
    const revisionNumber = maxRevision + 1;
    const revisionId = newId();
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const revision = await tx.documentRevision.create({
        data: {
          id: revisionId,
          tenantId: auth.tenantId!,
          documentId,
          revisionNumber,
          s3Key: dto.s3Key,
          summary: dto.summary ?? null,
          authoredByUserId: dto.authoredByUserId ?? null,
          approvedByUserId: dto.approvedByUserId ?? null,
          approvedAt: dto.approvedAt ? new Date(dto.approvedAt) : null,
        },
      });
      await tx.qhseDocument.update({
        where: { id: documentId },
        data: { currentRevisionId: revisionId },
      });
      return revision;
    });
  }

  async getRevisions(auth: AuthContext, documentId: string) {
    await this.findOne(auth, documentId);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.documentRevision.findMany({
        where: { documentId, tenantId: auth.tenantId!, deletedAt: null },
        orderBy: { revisionNumber: 'desc' },
      }),
    );
  }

  async approveRevision(auth: AuthContext, revisionId: string, approvedByUserId: string) {
    const revision = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.documentRevision.findFirst({
        where: { id: revisionId, tenantId: auth.tenantId!, deletedAt: null },
      }),
    );
    if (!revision) throw new NotFoundException(`DocumentRevision ${revisionId} not found`);
    if (revision.approvedAt) throw new BadRequestException('Revision already approved');
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.documentRevision.update({
        where: { id: revisionId },
        data: { approvedByUserId, approvedAt: new Date() },
      }),
    );
  }
}
