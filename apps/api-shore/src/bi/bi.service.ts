import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';

interface SupersetLoginResponse {
  access_token: string;
}

interface SupersetGuestTokenResponse {
  token: string;
}

@Injectable()
export class BiService {
  private readonly logger = new Logger(BiService.name);

  // In-process Superset admin token cache (TTL 5 min).
  private supersetAdminToken: string | null = null;
  private supersetAdminTokenExpiresAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  // ── Dashboard registry ─────────────────────────────────────────────────────

  listDashboards(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.biDashboard.findMany({
        where: { tenantId: auth.tenantId!, enabled: true },
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      }),
    );
  }

  listAllDashboards(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.biDashboard.findMany({
        where: { tenantId: auth.tenantId! },
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      }),
    );
  }

  upsertDashboard(
    auth: AuthContext,
    dto: {
      id?: string;
      supersetDashboardId: string;
      title: string;
      description?: string;
      category?: string;
      sortOrder?: number;
      enabled?: boolean;
    },
  ) {
    const id = dto.id ?? newId();
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.biDashboard.upsert({
        where: { id },
        create: {
          id,
          tenantId: auth.tenantId!,
          supersetDashboardId: dto.supersetDashboardId,
          title: dto.title,
          description: dto.description ?? null,
          category: dto.category ?? null,
          sortOrder: dto.sortOrder ?? 0,
          enabled: dto.enabled ?? true,
        },
        update: {
          supersetDashboardId: dto.supersetDashboardId,
          title: dto.title,
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        },
      }),
    );
  }

  async removeDashboard(auth: AuthContext, id: string) {
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.biDashboard.delete({ where: { id, tenantId: auth.tenantId! } }),
    );
  }

  // ── Guest token ────────────────────────────────────────────────────────────

  async getGuestToken(auth: AuthContext, dashboardDbId: string): Promise<string> {
    const supersetUrl = process.env['SUPERSET_URL'];
    if (!supersetUrl) {
      throw new ServiceUnavailableException(
        'Superset is not configured. Set SUPERSET_URL, SUPERSET_ADMIN_USERNAME, SUPERSET_ADMIN_PASSWORD in the environment.',
      );
    }

    const dashboard = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.biDashboard.findFirst({
        where: { id: dashboardDbId, tenantId: auth.tenantId!, enabled: true },
      }),
    );
    if (!dashboard) {
      throw new ServiceUnavailableException(`Dashboard ${dashboardDbId} not found or disabled.`);
    }

    const adminToken = await this.getSupersetAdminToken(supersetUrl);

    const res = await fetch(`${supersetUrl}/api/v1/security/guest_token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: { username: 'guest', first_name: 'Fleet', last_name: 'User' },
        resources: [{ type: 'dashboard', id: dashboard.supersetDashboardId }],
        // Per-tenant RLS: Superset datasets must have a `tenant_id` column.
        rls: [{ clause: `tenant_id = '${auth.tenantId!}'` }],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error({ msg: 'Superset guest_token failed', status: res.status, body });
      throw new ServiceUnavailableException(`Superset returned ${res.status} for guest token.`);
    }

    const data = (await res.json()) as SupersetGuestTokenResponse;
    return data.token;
  }

  /** Returns Superset URL from env for the frontend to know where to point the SDK. */
  getSupersetUrl(): string | null {
    return process.env['SUPERSET_URL'] ?? null;
  }

  private async getSupersetAdminToken(supersetUrl: string): Promise<string> {
    const now = Date.now();
    if (this.supersetAdminToken && now < this.supersetAdminTokenExpiresAt) {
      return this.supersetAdminToken;
    }

    const username = process.env['SUPERSET_ADMIN_USERNAME'] ?? 'admin';
    const password = process.env['SUPERSET_ADMIN_PASSWORD'] ?? 'fleetops_superset_dev';

    const res = await fetch(`${supersetUrl}/api/v1/security/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, provider: 'db' }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new ServiceUnavailableException(
        'Cannot authenticate with Superset. Check SUPERSET_ADMIN_USERNAME / SUPERSET_ADMIN_PASSWORD.',
      );
    }

    const data = (await res.json()) as SupersetLoginResponse;
    this.supersetAdminToken = data.access_token;
    // Cache for 4 min (Superset default JWT TTL is 5 min).
    this.supersetAdminTokenExpiresAt = now + 4 * 60 * 1000;
    return this.supersetAdminToken;
  }
}
