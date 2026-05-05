import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { newId } from '@marad-clone/domain';
import { DrizzleService } from '../db/drizzle.service';
import { tenants } from '../db/schema';
import type { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(dto: CreateTenantDto) {
    const [tenant] = this.drizzle.db
      .insert(tenants)
      .values({ id: newId(), name: dto.name })
      .returning()
      .all();
    return tenant;
  }

  findById(id: string) {
    const tenant = this.drizzle.db.select().from(tenants).where(eq(tenants.id, id)).get();
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }
}
