/**
 * Canonical error codes thrown by domain logic. Transport layers (HTTP, gRPC,
 * etc.) map these to status codes; domain code itself never knows about HTTP.
 */
export type DomainErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PRECONDITION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INTERNAL';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details ? Object.freeze({ ...details }) : undefined;
    // Restore prototype chain (necessary for instanceof checks across some
    // bundler / transpilation paths).
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}

/** Type guard. */
export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}
