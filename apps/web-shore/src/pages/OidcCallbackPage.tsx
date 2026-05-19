import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/useAuth.js';

export function OidcCallbackPage() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(`Microsoft returned an error: ${errorParam}`);
      return;
    }

    if (!code || !state) {
      setError('Missing code or state in callback URL.');
      return;
    }

    api
      .post<{ access_token: string }>('/auth/oidc/callback', { code, state })
      .then((res) => {
        login(res.access_token);
        navigate('/dashboard', { replace: true });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'SSO login failed');
      });
  }, [searchParams, login, navigate]);

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: '#0f172a',
          color: '#fff',
          padding: 24,
        }}
      >
        <span style={{ fontSize: 32 }}>⚠️</span>
        <p style={{ fontSize: 15, fontWeight: 500 }}>SSO login failed</p>
        <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 400, textAlign: 'center' }}>
          {error}
        </p>
        <button
          onClick={() => navigate('/login')}
          style={{
            padding: '8px 20px',
            border: '1px solid #334155',
            borderRadius: 8,
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: '#0f172a',
        color: '#94a3b8',
        fontSize: 13,
      }}
    >
      <span style={{ fontSize: 32 }}>⚓</span>
      <p>Completing sign-in…</p>
    </div>
  );
}
