import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
    super({ adapter: new PrismaPg(pool) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Run a block of queries scoped to a tenant.
   * Uses SET LOCAL so the tenant context is confined to this transaction —
   * safe with connection pooling and concurrent requests.
   */
  async withTenant<T>(
    tenantId: string,
    fn: (
      tx: Omit<
        PrismaClient,
        '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
      >,
    ) => Promise<T>,
  ): Promise<T> {
    // Validate tenantId is a ULID before interpolating into raw SQL.
    // PostgreSQL SET does not accept parameterised ($1) values, so we must
    // use $executeRawUnsafe — safe only because we verify the ULID format.
    if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(tenantId)) {
      throw new Error(`withTenant: invalid tenantId format: ${tenantId}`);
    }
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      return fn(tx);
    });
  }
}
