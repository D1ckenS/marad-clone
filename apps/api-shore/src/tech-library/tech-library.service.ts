import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';

// Known 2BA API shape — endpoint provided by customer's license agreement.
// Nareto uses a compatible REST search endpoint.
const DEFAULT_ENDPOINTS: Record<string, string> = {
  TWO_BA: 'https://api.2ba.nl/1/json/Product/Search',
  NARETO: 'https://api.nareto.net/v1/products/search',
};

@Injectable()
export class TechLibraryService {
  private readonly logger = new Logger(TechLibraryService.name);

  constructor(private readonly prisma: PrismaService) {}

  getConfig(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.techLibraryConnector.findFirst({ where: { tenantId: auth.tenantId! } }),
    );
  }

  upsertConfig(
    auth: AuthContext,
    dto: { provider: 'TWO_BA' | 'NARETO'; apiKey: string; endpoint?: string; enabled?: boolean },
  ) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.techLibraryConnector.upsert({
        where: { tenantId: auth.tenantId! },
        create: {
          id: newId(),
          tenantId: auth.tenantId!,
          provider: dto.provider,
          apiKey: dto.apiKey,
          endpoint: dto.endpoint ?? null,
          enabled: dto.enabled ?? true,
        },
        update: {
          provider: dto.provider,
          apiKey: dto.apiKey,
          endpoint: dto.endpoint ?? null,
          ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        },
      }),
    );
  }

  async lookup(auth: AuthContext, query: string) {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters');
    }

    const config = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.techLibraryConnector.findFirst({ where: { tenantId: auth.tenantId!, enabled: true } }),
    );

    if (!config) {
      throw new ServiceUnavailableException(
        'Tech library connector is not configured. Add your 2BA or Nareto API key in Integrations settings.',
      );
    }

    const endpoint = config.endpoint ?? DEFAULT_ENDPOINTS[config.provider];
    if (!endpoint) {
      throw new ServiceUnavailableException('No endpoint configured for this provider');
    }

    const url = `${endpoint}?${new URLSearchParams({ query: query.trim(), pageSize: '20' })}`;

    this.logger.log({ msg: 'tech-library lookup', provider: config.provider, query });

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn({ msg: 'tech-library upstream error', status: res.status, body });
      throw new ServiceUnavailableException(
        `Tech library API returned ${res.status}. Check your API key and license.`,
      );
    }

    const data = (await res.json()) as unknown;
    return { provider: config.provider, query, results: data };
  }
}
