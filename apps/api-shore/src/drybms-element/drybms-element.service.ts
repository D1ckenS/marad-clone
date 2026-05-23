import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateDrybmsElementDto, UpdateDrybmsElementDto } from './dto/drybms-element.dto';

@Injectable()
export class DrybmsElementService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateDrybmsElementDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drybmsElement.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          chapter: dto.chapter,
          chapterTitle: dto.chapterTitle,
          name: dto.name,
          score: dto.score ?? 1,
          stage: dto.stage ?? null,
          evidence: dto.evidence ?? null,
        },
      }),
    );
  }

  findAll(auth: AuthContext, query: { chapter?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drybmsElement.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.chapter && { chapter: query.chapter }),
        },
        orderBy: [{ chapter: 'asc' }, { name: 'asc' }],
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drybmsElement.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
      }),
    );
    if (!row) throw new NotFoundException(`DrybmsElement ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateDrybmsElementDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drybmsElement.update({
        where: { id },
        data: {
          ...(dto.chapter !== undefined && { chapter: dto.chapter }),
          ...(dto.chapterTitle !== undefined && { chapterTitle: dto.chapterTitle }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.score !== undefined && { score: dto.score }),
          ...(dto.stage !== undefined && { stage: dto.stage }),
          ...(dto.evidence !== undefined && { evidence: dto.evidence }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.drybmsElement.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
