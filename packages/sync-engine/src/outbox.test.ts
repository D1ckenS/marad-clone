import { HlcClock, isUlid } from '@marad-clone/domain';
import { describe, expect, it } from 'vitest';
import { createOutboxEntry } from './outbox.js';

describe('createOutboxEntry', () => {
  const clock = new HlcClock({ nodeId: 'test-node', now: () => 1_000_000 });

  it('sets all fields correctly', () => {
    const hlc = clock.send();
    const entry = createOutboxEntry({
      entityType: 'Component',
      entityId: '01JTEST00000000000000000AA',
      operation: 'upsert',
      payload: { name: { value: 'Engine', hlc: '000000000000-0000-test-node' } },
      hlc,
      nodeId: 'test-node',
    });

    expect(entry.entityType).toBe('Component');
    expect(entry.entityId).toBe('01JTEST00000000000000000AA');
    expect(entry.operation).toBe('upsert');
    expect(entry.nodeId).toBe('test-node');
    expect(entry.sentAt).toBeNull();
    expect(entry.payload).not.toBeNull();
  });

  it('assigns a unique ULID id', () => {
    const hlc = clock.send();
    const a = createOutboxEntry({
      entityType: 'Part',
      entityId: '01JTEST00000000000000000BB',
      operation: 'upsert',
      payload: {},
      hlc,
      nodeId: 'test-node',
    });
    const b = createOutboxEntry({
      entityType: 'Part',
      entityId: '01JTEST00000000000000000BB',
      operation: 'upsert',
      payload: {},
      hlc,
      nodeId: 'test-node',
    });
    expect(isUlid(a.id)).toBe(true);
    expect(isUlid(b.id)).toBe(true);
    expect(a.id).not.toBe(b.id);
  });

  it('encodes the hlc as a string in the entry', () => {
    const hlc = clock.send();
    const entry = createOutboxEntry({
      entityType: 'Part',
      entityId: '01JTEST00000000000000000CC',
      operation: 'delete',
      payload: null,
      hlc,
      nodeId: 'test-node',
    });
    expect(typeof entry.hlc).toBe('string');
    expect(entry.hlc).toMatch(/^[0-9a-f]{12}-[0-9a-f]{4}-.+$/);
  });

  it('allows null payload for deletes', () => {
    const hlc = clock.send();
    const entry = createOutboxEntry({
      entityType: 'Part',
      entityId: '01JTEST00000000000000000DD',
      operation: 'delete',
      payload: null,
      hlc,
      nodeId: 'test-node',
    });
    expect(entry.payload).toBeNull();
    expect(entry.operation).toBe('delete');
  });
});
