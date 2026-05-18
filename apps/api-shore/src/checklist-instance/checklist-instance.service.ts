import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateChecklistInstanceDto,
  SignChecklistItemDto,
  UpdateChecklistInstanceDto,
} from './dto/create-checklist-instance.dto';

interface ItemResponse {
  itemId: string;
  text?: string;
  checked: boolean;
  signatureKey?: string | null;
  signedByUserId?: string | null;
  signedAt?: string | null;
}

@Injectable()
export class ChecklistInstanceService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateChecklistInstanceDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.checklistInstance.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          templateId: dto.templateId ?? null,
          title: dto.title,
          responsesJson: dto.responsesJson ?? '[]',
        },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; status?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.checklistInstance.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.status && { status: query.status as never }),
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.checklistInstance.findFirst({ where: { id, tenantId: auth.tenantId!, deletedAt: null } }),
    );
    if (!row) throw new NotFoundException(`ChecklistInstance ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateChecklistInstanceDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.checklistInstance.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.status !== undefined && { status: dto.status as never }),
          ...(dto.responsesJson !== undefined && { responsesJson: dto.responsesJson }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.checklistInstance.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  async signItem(auth: AuthContext, id: string, dto: SignChecklistItemDto) {
    const instance = await this.findOne(auth, id);
    if (instance.status === 'COMPLETED') {
      throw new BadRequestException('Cannot modify a completed checklist');
    }
    const responses: ItemResponse[] = JSON.parse(instance.responsesJson) as ItemResponse[];
    const idx = responses.findIndex((r) => r.itemId === dto.itemId);
    const entry: ItemResponse = {
      itemId: dto.itemId,
      checked: dto.checked ?? true,
      signatureKey: dto.signatureKey ?? null,
      signedByUserId: dto.signedByUserId,
      signedAt: dto.signedAt,
      ...(idx >= 0 && responses[idx]?.text !== undefined ? { text: responses[idx].text } : {}),
    };
    if (idx >= 0) responses[idx] = entry;
    else responses.push(entry);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.checklistInstance.update({
        where: { id },
        data: { responsesJson: JSON.stringify(responses) },
      }),
    );
  }

  async complete(auth: AuthContext, id: string) {
    const instance = await this.findOne(auth, id);
    if (instance.status === 'COMPLETED') {
      throw new BadRequestException('Already completed');
    }
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.checklistInstance.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
    );
  }
}
