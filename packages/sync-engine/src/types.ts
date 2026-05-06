/** A single field value paired with the HLC at which it was last written. */
export type LwwField<T = unknown> = {
  readonly value: T;
  readonly hlc: string; // encoded HLC string
};

/** A record's fields expressed as per-field LWW entries. */
export type LwwRecord = Record<string, LwwField>;

export type SyncOperation = 'upsert' | 'delete';

/** An undelivered outbound sync event sitting in the local outbox. */
export type OutboxEntry = {
  readonly id: string; // ULID — identity of this outbox row
  readonly entityType: string;
  readonly entityId: string;
  readonly operation: SyncOperation;
  readonly payload: LwwRecord | null; // null for deletes
  readonly hlc: string; // encoded HLC of this event
  readonly nodeId: string;
  sentAt: number | null; // wall-clock ms when handed to transport; null = pending
};

/** A sync delta as seen by the receiving node (no outbox-specific fields). */
export type SyncDelta = {
  readonly entityType: string;
  readonly entityId: string;
  readonly operation: SyncOperation;
  readonly payload: LwwRecord | null;
  readonly hlc: string;
  readonly nodeId: string;
};

/** The local materialised view of one synced entity. */
export type SyncRecord = {
  readonly entityType: string;
  readonly entityId: string;
  readonly hlc: string; // latest HLC seen for this record overall
  readonly deletedAt: string | null; // ISO 8601 UTC; null = not deleted
  readonly fields: LwwRecord;
};

export type ApplyResult = {
  readonly record: SyncRecord;
  readonly merged: boolean; // true if any field changed or delete status changed
};

/** Port: what the sync engine needs from the storage layer. */
export interface SyncAdapter {
  appendOutbox(entry: OutboxEntry): Promise<void>;
  readPendingOutbox(limit: number): Promise<OutboxEntry[]>;
  markSent(ids: string[]): Promise<void>;
  applyRemoteDelta(delta: SyncDelta): Promise<ApplyResult>;
  readLocalRecord(entityType: string, entityId: string): Promise<SyncRecord | null>;
}
