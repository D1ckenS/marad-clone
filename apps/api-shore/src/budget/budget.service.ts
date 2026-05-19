import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateBudgetDto } from './dto/create-budget.dto';
import type { UpdateBudgetDto } from './dto/update-budget.dto';
import type { CreateBudgetLineDto } from './dto/create-budget-line.dto';
import type { UpdateBudgetLineDto } from './dto/update-budget-line.dto';

@Injectable()
export class BudgetService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(auth: AuthContext, year?: number, vesselId?: string) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.budget.findMany({
        where: {
          tenantId: auth.tenantId!,
          ...(year && { year }),
          ...(vesselId !== undefined && { vesselId: vesselId || null }),
        },
        include: { lines: true },
        orderBy: [{ year: 'desc' }, { name: 'asc' }],
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.budget.findFirst({
        where: { id, tenantId: auth.tenantId! },
        include: { lines: true },
      }),
    );
    if (!row) throw new NotFoundException(`Budget ${id} not found`);
    return row;
  }

  create(auth: AuthContext, dto: CreateBudgetDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.budget.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId ?? null,
          year: dto.year,
          name: dto.name,
          currency: dto.currency ?? 'EUR',
        },
        include: { lines: true },
      }),
    );
  }

  async update(auth: AuthContext, id: string, dto: UpdateBudgetDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.budget.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.currency && { currency: dto.currency }),
        },
        include: { lines: true },
      }),
    );
  }

  async remove(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) => tx.budget.delete({ where: { id } }));
  }

  // ── Lines ──────────────────────────────────────────────────────────────────

  async addLine(auth: AuthContext, budgetId: string, dto: CreateBudgetLineDto) {
    await this.findOne(auth, budgetId);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.budgetLine.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          budgetId,
          category: dto.category,
          budgetedAmount: dto.budgetedAmount,
          currency: dto.currency ?? 'EUR',
          notes: dto.notes ?? null,
        },
      }),
    );
  }

  async updateLine(auth: AuthContext, budgetId: string, lineId: string, dto: UpdateBudgetLineDto) {
    await this.findOne(auth, budgetId);
    const line = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.budgetLine.findFirst({ where: { id: lineId, budgetId, tenantId: auth.tenantId! } }),
    );
    if (!line) throw new NotFoundException(`BudgetLine ${lineId} not found`);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.budgetLine.update({
        where: { id: lineId },
        data: {
          ...(dto.category && { category: dto.category }),
          ...(dto.budgetedAmount && { budgetedAmount: dto.budgetedAmount }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      }),
    );
  }

  async removeLine(auth: AuthContext, budgetId: string, lineId: string) {
    await this.findOne(auth, budgetId);
    const line = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.budgetLine.findFirst({ where: { id: lineId, budgetId, tenantId: auth.tenantId! } }),
    );
    if (!line) throw new NotFoundException(`BudgetLine ${lineId} not found`);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.budgetLine.delete({ where: { id: lineId } }),
    );
  }
}
