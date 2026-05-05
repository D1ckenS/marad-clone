import { DomainError } from './errors.js';

/**
 * Hybrid Logical Clock value. Combines wall-clock ms with a logical counter
 * to provide a strictly-increasing, causally-consistent timestamp across nodes.
 *
 * Reference: Kulkarni et al., "Logical Physical Clocks" (2014).
 */
export interface Hlc {
  /** ms since Unix epoch. 48 bits → safe through year ~10889. */
  readonly physicalMs: number;
  /** 16-bit tie-breaker counter for events within the same millisecond. */
  readonly counter: number;
  /** Originating node identifier (stable per device/process). */
  readonly nodeId: string;
}

const MAX_COUNTER = 0xffff;
const MAX_PHYSICAL_MS = 0xffffffffffff;
const HLC_REGEX = /^([0-9a-f]{12})-([0-9a-f]{4})-(.+)$/;

/** Encode an HLC as a sortable string: `<12-hex-ms>-<4-hex-counter>-<nodeId>`. */
export function encodeHlc(hlc: Hlc): string {
  if (!Number.isInteger(hlc.physicalMs) || hlc.physicalMs < 0 || hlc.physicalMs > MAX_PHYSICAL_MS) {
    throw new DomainError('INVALID_INPUT', `physicalMs out of range: ${hlc.physicalMs}`);
  }
  if (!Number.isInteger(hlc.counter) || hlc.counter < 0 || hlc.counter > MAX_COUNTER) {
    throw new DomainError('INVALID_INPUT', `counter out of range: ${hlc.counter}`);
  }
  if (hlc.nodeId.length === 0) {
    throw new DomainError('INVALID_INPUT', 'nodeId must not be empty');
  }
  const ms = hlc.physicalMs.toString(16).padStart(12, '0');
  const counter = hlc.counter.toString(16).padStart(4, '0');
  return `${ms}-${counter}-${hlc.nodeId}`;
}

/** Parse a sortable HLC string. Throws DomainError(INVALID_INPUT) if malformed. */
export function decodeHlc(s: string): Hlc {
  const m = HLC_REGEX.exec(s);
  if (!m) {
    throw new DomainError('INVALID_INPUT', `Not a valid HLC string: ${s}`);
  }
  const physicalMs = parseInt(m[1] as string, 16);
  const counter = parseInt(m[2] as string, 16);
  const nodeId = m[3] as string;
  if (!Number.isFinite(physicalMs) || !Number.isFinite(counter) || nodeId.length === 0) {
    throw new DomainError('INVALID_INPUT', `Malformed HLC: ${s}`);
  }
  return { physicalMs, counter, nodeId };
}

/** Total order over Hlc: physicalMs, then counter, then nodeId. */
export function compareHlc(a: Hlc, b: Hlc): -1 | 0 | 1 {
  if (a.physicalMs !== b.physicalMs) return a.physicalMs < b.physicalMs ? -1 : 1;
  if (a.counter !== b.counter) return a.counter < b.counter ? -1 : 1;
  if (a.nodeId !== b.nodeId) return a.nodeId < b.nodeId ? -1 : 1;
  return 0;
}

export interface HlcClockOptions {
  readonly nodeId: string;
  /** Wall-clock source. Defaults to Date.now. Inject in tests. */
  readonly now?: () => number;
}

/**
 * Hybrid Logical Clock: tracks the largest HLC observed locally and bumps it
 * on send (local event) or receive (incoming remote event).
 */
export class HlcClock {
  private _last: Hlc;
  private readonly nodeId: string;
  private readonly now: () => number;

  constructor(opts: HlcClockOptions) {
    if (opts.nodeId.length === 0) {
      throw new DomainError('INVALID_INPUT', 'nodeId must not be empty');
    }
    this.nodeId = opts.nodeId;
    this.now = opts.now ?? Date.now;
    this._last = { physicalMs: 0, counter: 0, nodeId: opts.nodeId };
  }

  /** Generate a new HLC for a local event (e.g. a write). */
  send(): Hlc {
    const wallMs = this.now();
    const newPhysical = Math.max(wallMs, this._last.physicalMs);
    const newCounter = newPhysical === this._last.physicalMs ? this._last.counter + 1 : 0;
    if (newCounter > MAX_COUNTER) {
      throw new DomainError(
        'INTERNAL',
        `HLC counter overflow at ${newPhysical} ms — too many events in one millisecond`,
      );
    }
    this._last = { physicalMs: newPhysical, counter: newCounter, nodeId: this.nodeId };
    return this._last;
  }

  /** Update the clock after observing a remote HLC; return the new local HLC. */
  receive(remote: Hlc): Hlc {
    const wallMs = this.now();
    const maxPhysical = Math.max(wallMs, this._last.physicalMs, remote.physicalMs);
    let newCounter: number;
    if (maxPhysical === this._last.physicalMs && maxPhysical === remote.physicalMs) {
      newCounter = Math.max(this._last.counter, remote.counter) + 1;
    } else if (maxPhysical === this._last.physicalMs) {
      newCounter = this._last.counter + 1;
    } else if (maxPhysical === remote.physicalMs) {
      newCounter = remote.counter + 1;
    } else {
      newCounter = 0;
    }
    if (newCounter > MAX_COUNTER) {
      throw new DomainError('INTERNAL', `HLC counter overflow on receive at ${maxPhysical} ms`);
    }
    this._last = { physicalMs: maxPhysical, counter: newCounter, nodeId: this.nodeId };
    return this._last;
  }

  /** Snapshot the clock's current value without advancing it. */
  current(): Hlc {
    return this._last;
  }
}
