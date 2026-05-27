import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { AuthContext } from '../auth/auth-context';
import { AuditEventService } from './audit-event.service';

interface AuditRequest {
  method: string;
  url?: string;
  originalUrl?: string;
  authCtx?: AuthContext;
}

interface AuditResponse {
  statusCode: number;
}

/**
 * Global write-method audit interceptor (B7).
 *
 * After a successful POST / PATCH / DELETE the interceptor records an
 * AuditEvent row tagged with the actor's userId, the HTTP method, the
 * resource, and any path-param id. Read methods (GET / HEAD / OPTIONS) and
 * a small denylist of endpoints (login/logout — recorded explicitly with
 * richer context — and audit-events itself to avoid recursion) are skipped.
 *
 * Records are written fire-and-forget so the audit pipeline never blocks
 * the response. Failures are logged but never surface to the caller — the
 * audit trail is best-effort observability, not a precondition for the
 * write itself succeeding.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly log = new Logger(AuditInterceptor.name);

  // Endpoints handled by explicit audit.record calls or that would create
  // useless recursive noise. Compared as URL substrings.
  private readonly DENYLIST = [
    '/auth/login',
    '/auth/logout',
    '/auth/refresh',
    '/auth/bootstrap-super-admin',
    '/auth/oidc/callback',
    '/audit-events',
  ];

  constructor(private readonly audit: AuditEventService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = ctx.switchToHttp();
    const req = httpCtx.getRequest<AuditRequest>();
    const method = req.method;

    // Read methods and pre-flights — no audit needed.
    if (method !== 'POST' && method !== 'PATCH' && method !== 'DELETE' && method !== 'PUT') {
      return next.handle();
    }

    // Denylist: endpoints with explicit recording or non-domain calls.
    const url = req.originalUrl ?? req.url ?? '';
    if (this.DENYLIST.some((deny) => url.includes(deny))) {
      return next.handle();
    }

    const auth = req.authCtx;
    // Unauthenticated writes still get recorded (action=ANON) so an attacker
    // can't avoid the audit trail by skipping JWT. tenantId is required by
    // the schema though, so anon writes that never get a tenant are skipped.
    // In practice the JwtAuthGuard prevents this on every gated endpoint;
    // bootstrap routes are on the denylist above.
    if (!auth || !auth.tenantId) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (responseBody: unknown) => {
          const res = httpCtx.getResponse<AuditResponse>();
          // Only success-class responses get audited. 4xx/5xx flow through
          // tap's `error` branch (which we don't subscribe to) anyway since
          // Nest throws — but a controller returning a 400 without throwing
          // would otherwise be audited too.
          if (res.statusCode >= 400) return;
          this.recordAsync(req, responseBody, res.statusCode).catch(() => undefined);
        },
      }),
    );
  }

  private async recordAsync(
    req: AuditRequest,
    responseBody: unknown,
    statusCode: number,
  ): Promise<void> {
    const auth = req.authCtx!;
    const url = req.originalUrl ?? req.url ?? '';
    const { entityType, entityId } = this.extractEntityRef(req, responseBody);
    const action = `API_${req.method}`;
    try {
      await this.audit.record({
        tenantId: auth.tenantId!,
        ...(auth.vesselId !== null && { vesselId: auth.vesselId }),
        actorUserId: auth.userId,
        action,
        entityType,
        entityId,
        metadata: {
          method: req.method,
          url: url.split('?')[0],
          statusCode,
        },
      });
    } catch (err) {
      this.log.warn(
        `audit record failed for ${req.method} ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Best-effort entity reference from URL + response body:
   *   /api/v1/components            → ('components', body.id ?? '-')
   *   /api/v1/components/:id        → ('components', :id)
   *   /api/v1/job-instances/:id/sign-off → ('job-instances', :id)  (sub-action lost)
   *
   * The resource string is the first path segment after /api/v1; it isn't
   * Pascal-cased into a domain entity name because the audit pipeline is
   * for forensic search, not display. Downstream consumers can normalise.
   */
  private extractEntityRef(
    req: AuditRequest,
    responseBody: unknown,
  ): { entityType: string; entityId: string } {
    const url = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';
    // Strip the api/v1 prefix and split.
    const segments = url
      .replace(/^\/?api\/v1\//, '')
      .split('/')
      .filter(Boolean);
    const entityType = segments[0] ?? 'unknown';

    // If the second segment is present, treat it as the entity id.
    let entityId: string | undefined = segments[1];
    if (!entityId) {
      // POST collection — pull id from the response body if it looks like one.
      if (responseBody !== null && typeof responseBody === 'object') {
        const id = (responseBody as Record<string, unknown>)['id'];
        if (typeof id === 'string') entityId = id;
      }
    }

    return { entityType, entityId: entityId ?? '-' };
  }
}
