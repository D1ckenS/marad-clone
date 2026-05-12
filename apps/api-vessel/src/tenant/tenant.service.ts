import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { newId } from '@marad-clone/domain';
import * as bcrypt from 'bcrypt';
import { DrizzleService } from '../db/drizzle.service';
import { tenants, users } from '../db/schema';
import type { CreateTenantDto } from './dto/create-tenant.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class TenantService {
  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Bootstrap a tenant + initial TENANT_ADMIN. Mirrors the shore flow so
   * the vessel install can self-provision when offline (no shore reachable
   * to push down the first user).
   */
  async create(dto: CreateTenantDto) {
    const tenantId = newId();
    const userId = newId();
    const passwordHash = await bcrypt.hash(dto.admin.password, SALT_ROUNDS);

    try {
      return this.drizzle.db.transaction((tx) => {
        const [tenant] = tx
          .insert(tenants)
          .values({ id: tenantId, name: dto.name })
          .returning()
          .all();
        const [admin] = tx
          .insert(users)
          .values({
            id: userId,
            tenantId,
            email: dto.admin.email,
            passwordHash,
            role: 'TENANT_ADMIN',
          })
          .returning({
            id: users.id,
            tenantId: users.tenantId,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
          })
          .all();
        return { tenant, admin };
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
        throw new ConflictException(`User ${dto.admin.email} already exists in this tenant`);
      }
      throw err;
    }
  }

  findById(id: string) {
    const tenant = this.drizzle.db.select().from(tenants).where(eq(tenants.id, id)).get();
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }
}
