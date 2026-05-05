import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { newId } from '@marad-clone/domain';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';

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
            passwordHash,
            role: dto.role ?? Role.OFFICER,
            vesselId: dto.vesselId ?? null,
          },
          select: { id: true, tenantId: true, email: true, role: true, createdAt: true },
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
}
