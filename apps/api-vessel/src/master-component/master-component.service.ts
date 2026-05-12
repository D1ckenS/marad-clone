import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { masterComponents } from '../db/schema';

/**
 * Vessel-side master library is read-only here. Templates are authored on
 * shore and replicated to the vessel via the sync engine; the vessel uses
 * them to clone Components but never edits them locally. (Cross-vessel
 * master replication itself lands in a later PR — for now the vessel side
 * just exposes a list/get interface against whatever the sync stream has
 * delivered.)
 */
@Injectable()
export class MasterComponentService {
  constructor(private readonly drizzle: DrizzleService) {}

  findAll(auth: AuthContext) {
    return this.drizzle.db
      .select()
      .from(masterComponents)
      .where(and(eq(masterComponents.tenantId, auth.tenantId), isNull(masterComponents.deletedAt)))
      .orderBy(masterComponents.name)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(masterComponents)
      .where(
        and(
          eq(masterComponents.id, id),
          eq(masterComponents.tenantId, auth.tenantId),
          isNull(masterComponents.deletedAt),
        ),
      )
      .get();
    if (row === undefined) throw new NotFoundException(`MasterComponent ${id} not found`);
    return row;
  }
}
