import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { useAuth } from '../context/useAuth.js';
import { LanguageSwitcher } from '../components/LanguageSwitcher.js';

interface LoginResult {
  access_token: string;
}

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<'microsoft' | 'google' | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = isPlatformAdmin ? { identifier, password } : { tenantId, identifier, password };
      const res = await api.post<LoginResult>('/auth/login', body);
      login(res.access_token);
      navigate(isPlatformAdmin ? '/companies' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.login_failed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSsoLogin(provider: 'ENTRA' | 'GOOGLE') {
    if (!tenantId.trim()) {
      setError(t('auth.sso_needs_org_id'));
      return;
    }
    setError(null);
    setSsoLoading(provider === 'GOOGLE' ? 'google' : 'microsoft');
    try {
      const res = await api.get<{ authorizationUrl: string; state: string }>(
        `/auth/oidc/login?tenantId=${encodeURIComponent(tenantId)}&provider=${provider}`,
      );
      window.location.href = res.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.sso_failed'));
      setSsoLoading(null);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">⚓</span>
          <h1 className="text-2xl font-bold text-white mt-2">{t('app.name')}</h1>
          <p className="text-slate-400 text-sm mt-1">{t('app.tagline')}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          {!isPlatformAdmin && (
            <Input
              id="tenantId"
              label={t('auth.organisation_id')}
              placeholder="tenant-id"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
              autoFocus
            />
          )}
          <Input
            id="identifier"
            label={t('auth.username_or_email')}
            placeholder="john or john@company.com"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoFocus={isPlatformAdmin}
          />
          <Input
            id="password"
            type="password"
            label={t('auth.password')}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            {t('auth.sign_in')}
          </Button>

          {!isPlatformAdmin && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#94a3b8',
                  fontSize: 11,
                }}
              >
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                <span>{t('auth.or')}</span>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              </div>
              <button
                type="button"
                onClick={() => handleSsoLogin('ENTRA')}
                disabled={ssoLoading !== null}
                style={{
                  width: '100%',
                  padding: '9px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  background: '#fff',
                  cursor: ssoLoading !== null ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#1a1a2e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: ssoLoading !== null ? 0.7 : 1,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 23 23" fill="none">
                  <path d="M1 1h10v10H1z" fill="#f25022" />
                  <path d="M12 1h10v10H12z" fill="#7fba00" />
                  <path d="M1 12h10v10H1z" fill="#00a4ef" />
                  <path d="M12 12h10v10H12z" fill="#ffb900" />
                </svg>
                {ssoLoading === 'microsoft' ? t('auth.redirecting') : t('auth.sign_in_microsoft')}
              </button>
              <button
                type="button"
                onClick={() => handleSsoLogin('GOOGLE')}
                disabled={ssoLoading !== null}
                style={{
                  width: '100%',
                  padding: '9px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  background: '#fff',
                  cursor: ssoLoading !== null ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#1a1a2e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: ssoLoading !== null ? 0.7 : 1,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
                  <path
                    d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
                    fill="#FFC107"
                  />
                  <path
                    d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 7.1 29.5 4.6 24 4.6 16.3 4.6 9.7 8.7 6.3 14.7z"
                    fill="#FF3D00"
                  />
                  <path
                    d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.3C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3.1-11.3-7.5l-6.6 5.1C9.6 40 16.3 44 24 44z"
                    fill="#4CAF50"
                  />
                  <path
                    d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.4 4.2-4.4 5.5l6.2 5.3C36.9 39.3 44 34 44 24c0-1.2-.1-2.4-.4-3.5z"
                    fill="#1976D2"
                  />
                </svg>
                {ssoLoading === 'google' ? t('auth.redirecting') : t('auth.sign_in_google')}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setIsPlatformAdmin((p) => !p);
              setError(null);
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-600 pt-1"
          >
            {isPlatformAdmin ? t('auth.back_to_company_login') : t('auth.platform_admin_login')}
          </button>
        </form>

        <div style={{ marginTop: 16, width: 220, marginInline: 'auto' }}>
          <LanguageSwitcher size="md" placement="top" />
        </div>
      </div>
    </div>
  );
}
