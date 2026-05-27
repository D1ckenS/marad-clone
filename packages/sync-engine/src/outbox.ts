import { encodeHlc, type Hlc, newId } from '@fleetops/domain';
import type { LwwRecord, OutboxEntry, SyncOperation } from './types.js';

export function createOutboxEntry(params: {
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  payload: LwwRecord | null;
  hlc: Hlc;
  nodeId: string;
  /** B6: ULID of the user who triggered the write. Defaults to 'system'. */
  actorUserId?: string;
}): OutboxEntry {
  return {
    id: newId(),
    entityType: params.entityType,
    entityId: params.entityId,
    operation: params.operation,
    payload: params.payload,
    hlc: encodeHlc(params.hlc),
    nodeId: params.nodeId,
    actorUserId: params.actorUserId ?? 'system',
    sentAt: null,
  };
}
