import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { newId } from '@fleetops/domain';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    try {
      return await this.prisma.withTenant(tenantId, (tx) =>
        tx.user.create({
          data: {
            id: newId(),
            tenantId,
            email: dto.email,
            username: dto.username ?? null,
            passwordHash,
            role: dto.role ?? Role.OFFICER,
            vesselId: dto.vesselId ?? null,
          },
          select: {
            id: true,
            tenantId: true,
            email: true,
            username: true,
            role: true,
            createdAt: true,
          },
        }),
      );
    } catch (err: unknown) {
      // Unique constraint: tenant+email already exists
      if (err instanceof Error && err.message.includes('Unique constraint')) {
        throw new ConflictException(`User ${dto.email} already exists in this tenant`);
      }
      throw err;
    }
  }

  async findByEmail(tenantId: string, email: string) {
    const user = await this.prisma.withTenant(tenantId, (tx) =>
      tx.user.findUnique({ where: { tenantId_email: { tenantId, email } } }),
    );
    if (!user) throw new NotFoundException(`User ${email} not found`);
    return user;
  }

  /** Looks up a user by email OR username within a tenant. */
  async findByIdentifier(tenantId: string, identifier: string) {
    const user = await this.prisma.withTenant(tenantId, (tx) =>
      tx.user.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          OR: [{ email: identifier }, { username: identifier }],
        },
      }),
    );
    if (!user) throw new NotFoundException(`User ${identifier} not found`);
    return user;
  }

  /** Looks up a SUPER_ADMIN by email or username (no tenant). */
  async findSuperAdminByIdentifier(identifier: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        role: 'SUPER_ADMIN',
        tenantId: null,
        deletedAt: null,
        OR: [{ email: identifier }, { username: identifier }],
      },
    });
    if (!user) throw new NotFoundException(`Super admin ${identifier} not found`);
    return user;
  }

  findAll(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.user.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          tenantId: true,
          vesselId: true,
          email: true,
          username: true,
          role: true,
          createdAt: true,
        },
        orderBy: { email: 'asc' },
      }),
    );
  }

  async update(
    tenantId: string,
    id: string,
    dto: { email?: string; role?: Role; vesselId?: string | null },
  ) {
    const existing = await this.prisma.withTenant(tenantId, (tx) =>
      tx.user.findFirst({ where: { id, tenantId, deletedAt: null } }),
    );
    if (!existing) throw new NotFoundException(`User ${id} not found`);
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.user.update({
        where: { id },
        data: {
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.role !== undefined && { role: dto.role }),
          ...(dto.vesselId !== undefined && { vesselId: dto.vesselId }),
        },
        select: {
          id: true,
          tenantId: true,
          vesselId: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
    );
  }

  async softDelete(tenantId: string, id: string) {
    const existing = await this.prisma.withTenant(tenantId, (tx) =>
      tx.user.findFirst({ where: { id, tenantId, deletedAt: null } }),
    );
    if (!existing) throw new NotFoundException(`User ${id} not found`);
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.user.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  /** Looks up a SUPER_ADMIN by email without tenant scoping (bypasses RLS). */
  async findSuperAdminByEmail(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, role: 'SUPER_ADMIN', tenantId: null, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`Super admin ${email} not found`);
    return user;
  }

  async getMe(userId: string, tenantId: string | null) {
    const where = { id: userId, deletedAt: null as Date | null };
    const select = {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
    };
    const user = tenantId
      ? await this.prisma.withTenant(tenantId, (tx) => tx.user.findFirst({ where, select }))
      : await this.prisma.user.findFirst({ where, select });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(userId: string, tenantId: string | null, dto: UpdateProfileDto) {
    const where = { id: userId, deletedAt: null as Date | null };
    const existing = tenantId
      ? await this.prisma.withTenant(tenantId, (tx) => tx.user.findFirst({ where }))
      : await this.prisma.user.findFirst({ where });
    if (!existing) throw new NotFoundException('User not found');

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('currentPassword is required to set a new password');
      }
      if (!existing.passwordHash) {
        throw new BadRequestException('This account uses SSO — password change not allowed');
      }
      const valid = await bcrypt.compare(dto.currentPassword, existing.passwordHash);
      if (!valid) throw new UnauthorizedException('Current password is incorrect');
    }

    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined) data['firstName'] = dto.firstName || null;
    if (dto.lastName !== undefined) data['lastName'] = dto.lastName || null;
    if (dto.email !== undefined) data['email'] = dto.email;
    if (dto.newPassword) data['passwordHash'] = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);

    const updated = tenantId
      ? await this.prisma.withTenant(tenantId, (tx) =>
          tx.user.update({
            where: { id: userId },
            data,
            select: {
              id: true,
              tenantId: true,
              vesselId: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          }),
        )
      : await this.prisma.user.update({
          where: { id: userId },
          data,
          select: {
            id: true,
            tenantId: true,
            vesselId: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        });

    return updated;
  }

  /** Creates a SUPER_ADMIN with no tenant. Bypasses withTenant(). */
  async createSuperAdmin(email: string, password: string, username: string) {
    const existing = await this.prisma.user.findFirst({
      where: { email, role: 'SUPER_ADMIN', tenantId: null },
    });
    if (existing) throw new ConflictException('A super admin with this email already exists');
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    return this.prisma.user.create({
      data: {
        id: newId(),
        tenantId: null,
        email,
        username: username ?? null,
        passwordHash,
        role: 'SUPER_ADMIN',
      },
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    });
  }
}
