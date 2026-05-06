import type { PrismaSyncAdapter } from './prisma-sync-adapter';

export type PrismaSyncAdapterFactory = (tenantId: string, vesselId: string) => PrismaSyncAdapter;

export const PRISMA_SYNC_ADAPTER_FACTORY = 'PRISMA_SYNC_ADAPTER_FACTORY' as const;
