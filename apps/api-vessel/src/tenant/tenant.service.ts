import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql, and, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import * as bcrypt from 'bcrypt';
import { DrizzleService } from '../db/drizzle.service';
import { tenants, users, vessels } from '../db/schema';
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

  /**
   * Returns every tenant in the vessel DB with vessel + user counts. The
   * shore version powers the Companies page for SUPER_ADMIN; mirroring it
   * here lets the same UI work on a desktop install.
   */
  findAll() {
    const rows = this.drizzle.db
      .select({
        id: tenants.id,
        name: tenants.name,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
        hlc: tenants.hlc,
        deletedAt: tenants.deletedAt,
      })
      .from(tenants)
      .where(isNull(tenants.deletedAt))
      .all();
    return rows.map((t) => {
      const vesselCount =
        this.drizzle.db
          .select({ n: sql<number>`COUNT(*)` })
          .from(vessels)
          .where(and(eq(vessels.tenantId, t.id), isNull(vessels.deletedAt)))
          .get()?.n ?? 0;
      const userCount =
        this.drizzle.db
          .select({ n: sql<number>`COUNT(*)` })
          .from(users)
          .where(eq(users.tenantId, t.id))
          .get()?.n ?? 0;
      return { ...t, shortName: null, vesselCount, userCount };
    });
  }

  /** SUPER_ADMIN: update tenant name. */
  update(id: string, dto: { name?: string }) {
    const updates: Partial<typeof tenants.$inferInsert> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    updates.updatedAt = new Date().toISOString();
    const [updated] = this.drizzle.db
      .update(tenants)
      .set(updates)
      .where(eq(tenants.id, id))
      .returning()
      .all();
    if (!updated) throw new NotFoundException(`Tenant ${id} not found`);
    return updated;
  }
}
