import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AddPermitApprovalDto,
  CreateWorkPermitDto,
  UpdateWorkPermitDto,
} from './dto/create-work-permit.dto';

type ChecklistItem = { itemId: string; description: string; checked: boolean; required?: boolean };

@Injectable()
export class WorkPermitService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateWorkPermitDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.workPermit.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          permitType: dto.permitType,
          templateId: dto.templateId ?? null,
          title: dto.title,
          location: dto.location ?? null,
          workDescription: dto.workDescription ?? null,
          requestedByUserId: dto.requestedByUserId ?? null,
          validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        },
        include: { approvals: true },
      }),
    );
  }

  findAll(auth: AuthContext, query: { status?: string; vesselId?: string; permitType?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.workPermit.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.status && { status: query.status as never }),
          ...(query.permitType && { permitType: query.permitType as never }),
        },
        include: { approvals: { where: { deletedAt: null } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.workPermit.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
        include: { approvals: { where: { deletedAt: null } } },
      }),
    );
    if (!row) throw new NotFoundException(`WorkPermit ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateWorkPermitDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.workPermit.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.location !== undefined && { location: dto.location }),
          ...(dto.workDescription !== undefined && { workDescription: dto.workDescription }),
          ...(dto.validFrom !== undefined && { validFrom: new Date(dto.validFrom) }),
          ...(dto.validUntil !== undefined && { validUntil: new Date(dto.validUntil) }),
          ...(dto.riskAssessmentJson !== undefined && {
            riskAssessmentJson: dto.riskAssessmentJson,
          }),
          ...(dto.gasTestJson !== undefined && { gasTestJson: dto.gasTestJson }),
          ...(dto.hazardsJson !== undefined && { hazardsJson: dto.hazardsJson }),
        },
        include: { approvals: { where: { deletedAt: null } } },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.workPermit.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  async approve(auth: AuthContext, id: string) {
    const permit = await this.findOne(auth, id);
    if (permit.status !== 'REQUESTED') {
      throw new BadRequestException(`Cannot approve permit in status ${permit.status}`);
    }
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.workPermit.update({
        where: { id },
        data: { status: 'APPROVED' },
        include: { approvals: { where: { deletedAt: null } } },
      }),
    );
  }

  async activate(auth: AuthContext, id: string) {
    const permit = await this.findOne(auth, id);
    if (permit.status !== 'APPROVED') {
      throw new BadRequestException(`Cannot activate permit in status ${permit.status}`);
    }
    if (permit.permitType === 'HOT_WORK') {
      if (!permit.riskAssessmentJson) {
        throw new BadRequestException(
          'HOT_WORK permit requires a completed risk assessment before activation',
        );
      }
      const items: ChecklistItem[] = JSON.parse(permit.riskAssessmentJson) as ChecklistItem[];
      const incomplete = items.filter((i) => i.required !== false && !i.checked);
      if (incomplete.length > 0) {
        throw new BadRequestException(
          `HOT_WORK permit has ${incomplete.length} required risk assessment item(s) not yet checked`,
        );
      }
    }
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.workPermit.update({
        where: { id },
        data: { status: 'ACTIVE' },
        include: { approvals: { where: { deletedAt: null } } },
      }),
    );
  }

  async close(auth: AuthContext, id: string) {
    const permit = await this.findOne(auth, id);
    if (permit.status !== 'ACTIVE') {
      throw new BadRequestException(`Cannot close permit in status ${permit.status}`);
    }
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.workPermit.update({
        where: { id },
        data: { status: 'CLOSED', closedAt: new Date() },
        include: { approvals: { where: { deletedAt: null } } },
      }),
    );
  }

  async cancel(auth: AuthContext, id: string) {
    const permit = await this.findOne(auth, id);
    if (permit.status === 'CLOSED' || permit.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel permit in status ${permit.status}`);
    }
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.workPermit.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: { approvals: { where: { deletedAt: null } } },
      }),
    );
  }

  async addApproval(auth: AuthContext, permitId: string, dto: AddPermitApprovalDto) {
    const permit = await this.findOne(auth, permitId);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.permitApproval.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: permit.vesselId,
          permitId,
          approvedBy: dto.approvedBy,
          role: dto.role,
          approvedAt: new Date(),
          signatureHash: dto.signatureHash ?? null,
        },
      }),
    );
  }
}
