import { decodeTime, monotonicFactory, ulid } from 'ulidx';
import { DomainError } from './errors.js';

const monotonicUlid = monotonicFactory();

const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Branded ULID — a string that has been validated as Crockford-base32, length 26. */
export type Ulid = string & { readonly __brand: 'Ulid' };

/** Generate a new monotonic ULID — strictly sortable by creation order, even within the same ms. */
export function newId(): Ulid {
  return monotonicUlid() as Ulid;
}

/** Parse a string as a ULID. Throws DomainError(INVALID_INPUT) if malformed. */
export function asUlid(s: string): Ulid {
  if (!isUlid(s)) {
    throw new DomainError('INVALID_INPUT', `Not a valid ULID: ${s}`);
  }
  return s as Ulid;
}

/** Type guard: true if `s` is a syntactically valid ULID. */
export function isUlid(s: unknown): s is Ulid {
  return typeof s === 'string' && ULID_REGEX.test(s);
}

/** Extract the millisecond-precision timestamp encoded in a ULID. */
export function idTimestampMs(id: Ulid): number {
  return decodeTime(id);
}

/** Non-monotonic ULID generator — for cases where ordering doesn't matter. */
export { ulid as nonMonotonicUlid };
