import { Injectable, ServiceUnavailableException } from '@nestjs/common';

/**
 * OIDC integration scaffold for Microsoft Entra (or any OIDC IDP).
 *
 * P0-10 ships the URL shape and dev-mode behaviour only. When env vars
 * `OIDC_AUTHORITY`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, and
 * `OIDC_REDIRECT_URI` are absent, both methods return 503 with a clear
 * "not configured" message. A follow-up ticket will:
 *   1. add `openid-client@5.x` (pinned in CLAUDE.md §3)
 *   2. discover the IDP's well-known endpoints in `init()`
 *   3. implement PKCE in `beginLogin()`
 *   4. exchange the code, look up / create the user in `completeLogin()`
 *   5. mint a shore RS256 access + refresh pair via AuthService.issueTokens
 */
@Injectable()
export class OidcService {
  private get configured(): boolean {
    return (
      typeof process.env['OIDC_AUTHORITY'] === 'string' &&
      typeof process.env['OIDC_CLIENT_ID'] === 'string' &&
      typeof process.env['OIDC_CLIENT_SECRET'] === 'string' &&
      typeof process.env['OIDC_REDIRECT_URI'] === 'string'
    );
  }

  beginLogin(): { authorizationUrl: string; state: string } {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'OIDC is not configured. Set OIDC_AUTHORITY, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI to enable.',
      );
    }
    // Real implementation deferred — see class-level comment.
    throw new ServiceUnavailableException(
      'OIDC scaffold present but real flow not implemented (P0-10 follow-up).',
    );
  }

  async completeLogin(_code: string, _state: string): Promise<never> {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'OIDC is not configured. Set OIDC_AUTHORITY, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI to enable.',
      );
    }
    throw new ServiceUnavailableException(
      'OIDC scaffold present but real flow not implemented (P0-10 follow-up).',
    );
  }
}
