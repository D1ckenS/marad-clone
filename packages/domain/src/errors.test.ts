import { describe, expect, it } from 'vitest';
import { DomainError, isDomainError } from './errors.js';

describe('DomainError', () => {
  it('captures code, message, and details', () => {
    const err = new DomainError('INVALID_INPUT', 'bad input', { field: 'imo' });
    expect(err.code).toBe('INVALID_INPUT');
    expect(err.message).toBe('bad input');
    expect(err.details).toEqual({ field: 'imo' });
    expect(err.name).toBe('DomainError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
  });

  it('makes details immutable (frozen copy, not shared with caller)', () => {
    const details = { field: 'imo' };
    const err = new DomainError('INVALID_INPUT', 'bad', details);
    details.field = 'mmsi';
    expect(err.details).toEqual({ field: 'imo' });
    expect(Object.isFrozen(err.details)).toBe(true);
  });

  it('omits details when not provided', () => {
    const err = new DomainError('NOT_FOUND', 'no such vessel');
    expect(err.details).toBeUndefined();
  });

  it('preserves stack trace pointing into DomainError construction', () => {
    const err = new DomainError('INTERNAL', 'boom');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('DomainError');
  });
});

describe('isDomainError', () => {
  it('discriminates DomainError from generic Error and non-Errors', () => {
    expect(isDomainError(new DomainError('INTERNAL', 'x'))).toBe(true);
    expect(isDomainError(new Error('x'))).toBe(false);
    expect(isDomainError(null)).toBe(false);
    expect(isDomainError(undefined)).toBe(false);
    expect(isDomainError({ code: 'INVALID_INPUT' })).toBe(false);
    expect(isDomainError('string')).toBe(false);
  });
});
