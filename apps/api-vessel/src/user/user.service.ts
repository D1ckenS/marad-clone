import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { newId } from '@marad-clone/domain';
import { DrizzleService } from '../db/drizzle.service';
import { users } from '../db/schema';
import type { CreateUserDto } from './dto/create-user.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class UserService {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(tenantId: string, dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    try {
      const [user] = this.drizzle.db
        .insert(users)
        .values({
          id: newId(),
          tenantId,
          email: dto.email,
          passwordHash,
          role: dto.role ?? 'OFFICER',
          vesselId: dto.vesselId ?? null,
        })
        .returning({
          id: users.id,
          tenantId: users.tenantId,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
        })
        .all();
      return user;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
        throw new ConflictException(`User ${dto.email} already exists in this tenant`);
      }
      throw err;
    }
  }

  findByEmail(tenantId: string, email: string) {
    const user = this.drizzle.db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.email, email)))
      .get();
    if (!user) throw new NotFoundException(`User ${email} not found`);
    return user;
  }
}
