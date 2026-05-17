import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTenantDto } from './dto/create-tenant.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bootstrap a tenant. Atomically creates the tenant row + a single
   * TENANT_ADMIN user from `dto.admin`. The admin's credentials are the
   * only way to obtain a JWT for subsequent calls into the API.
   */
  async create(dto: CreateTenantDto) {
    const tenantId = newId();
    const userId = newId();
    const passwordHash = await bcrypt.hash(dto.admin.password, SALT_ROUNDS);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { id: tenantId, name: dto.name, shortName: dto.shortName ?? null },
        });
        const admin = await tx.user.create({
          data: {
            id: userId,
            tenantId,
            email: dto.admin.email,
            username: dto.admin.username,
            passwordHash,
            role: 'TENANT_ADMIN',
          },
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            tenantId: true,
            createdAt: true,
          },
        });
        return { tenant, admin };
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Unique constraint')) {
        throw new ConflictException(`User ${dto.admin.email} already exists in this tenant`);
      }
      throw err;
    }
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  /** SUPER_ADMIN only — bypasses RLS to return all tenants. */
  async findAll() {
    const tenants = await this.prisma.tenant.findMany({ orderBy: { name: 'asc' } });
    // Enrich each with vessel and user counts
    return Promise.all(
      tenants.map(async (t) => {
        const [vesselCount, userCount] = await Promise.all([
          this.prisma.vessel.count({ where: { tenantId: t.id, deletedAt: null } }),
          this.prisma.user.count({ where: { tenantId: t.id, deletedAt: null } }),
        ]);
        return { ...t, vesselCount, userCount };
      }),
    );
  }

  async update(id: string, dto: { name?: string; shortName?: string | null }) {
    await this.findById(id);
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.shortName !== undefined && { shortName: dto.shortName }),
      },
    });
  }
}
