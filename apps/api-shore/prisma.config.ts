import path from 'path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Load .env so DATABASE_URL is available both for migrate and for the adapter.
config({ path: path.join(__dirname, '.env') });

export default defineConfig({
  schemaPath: path.join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    // Used by the migration engine (shadow DB, introspection, migrate dev/deploy).
    url: process.env['DATABASE_URL'] ?? '',
  },
  migrate: {
    // Used by PrismaClient at runtime via the driver adapter.
    adapter: () => {
      const pool = new Pool({
        connectionString: process.env['DATABASE_URL'],
      });
      return new PrismaPg(pool);
    },
  },
});
