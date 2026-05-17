import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';

interface LoginResult {
  access_token: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">⚓</span>
          <h1 className="text-2xl font-bold text-white mt-2">FleetOps</h1>
          <p className="text-slate-400 text-sm mt-1">Maritime Fleet Management</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          {!isPlatformAdmin && (
            <Input
              id="tenantId"
              label="Organisation ID"
              placeholder="tenant-id"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
              autoFocus
            />
          )}
          <Input
            id="identifier"
            label="Username or email"
            placeholder="john or john@company.com"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoFocus={isPlatformAdmin}
          />
          <Input
            id="password"
            type="password"
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>

          <button
            type="button"
            onClick={() => {
              setIsPlatformAdmin((p) => !p);
              setError(null);
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-600 pt-1"
          >
            {isPlatformAdmin ? '← Back to company login' : 'Platform admin login'}
          </button>
        </form>
      </div>
    </div>
  );
}
