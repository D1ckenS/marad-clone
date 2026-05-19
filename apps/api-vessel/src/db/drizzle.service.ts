import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'path';
import * as schema from './schema';

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private sqlite!: Database.Database;
  db!: BetterSQLite3Database<typeof schema>;

  onModuleInit() {
    const url = process.env['DATABASE_URL'] ?? 'vessel.db';
    const migrationsFolder = resolve(process.env['MIGRATIONS_DIR'] ?? 'drizzle');

    this.sqlite = new Database(url);
    // WAL mode not supported by in-memory databases
    if (url !== ':memory:') {
      this.sqlite.pragma('journal_mode = WAL');
      // NORMAL sync is safe in WAL mode and ~2-3× faster than FULL
      this.sqlite.pragma('synchronous = NORMAL');
      // 64 MB page cache (negative = kibibytes)
      this.sqlite.pragma('cache_size = -65536');
      // 256 MB memory-mapped I/O for read-heavy workloads
      this.sqlite.pragma('mmap_size = 268435456');
      // Temp tables and indices in RAM
      this.sqlite.pragma('temp_store = MEMORY');
    }
    this.sqlite.pragma('foreign_keys = ON');
    this.db = drizzle(this.sqlite, { schema });
    migrate(this.db, { migrationsFolder });
  }

  onModuleDestroy() {
    if (this.sqlite?.open) {
      // Flush WAL before Electron quit to prevent data loss on hard reboot
      if (this.sqlite.pragma('journal_mode', { simple: true }) === 'wal') {
        this.sqlite.pragma('wal_checkpoint(TRUNCATE)');
      }
      this.sqlite.close();
    }
  }
}
