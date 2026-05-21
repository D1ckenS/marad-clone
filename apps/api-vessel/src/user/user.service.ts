import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, or, sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { newId } from '@fleetops/domain';
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

  /**
   * Find a user by username OR email across all tenants in the vessel DB.
   * Vessel installs are single-tenant in practice; this lets the login
   * endpoint accept just `identifier+password` like shore does. The
   * identifier matches either `username` (preferred) or `email`.
   */
  findByIdentifier(identifier: string) {
    const row = this.drizzle.db
      .select()
      .from(users)
      .where(or(eq(users.username, identifier), eq(users.email, identifier)))
      .get();
    if (!row) throw new NotFoundException(`User ${identifier} not found`);
    return row;
  }

  /** Total user count across all tenants. Used by the first-launch setup check. */
  countAll(): number {
    const row = this.drizzle.db
      .select({ n: sql<number>`COUNT(*)` })
      .from(users)
      .get();
    return row?.n ?? 0;
  }
}
