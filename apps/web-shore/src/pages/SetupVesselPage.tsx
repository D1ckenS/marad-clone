import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { useAuth } from '../context/useAuth.js';
import { LanguageSwitcher } from '../components/LanguageSwitcher.js';

interface SetupStatus {
  userCount: number;
  needsBootstrap: boolean;
  bootstrapEnabled: boolean;
}
interface BootstrapResult {
  access_token: string;
}

/**
 * First-launch provisioning screen for a fresh vessel install. Only rendered
 * when GET /auth/setup-status reports `needsBootstrap: true`. Calls
 * POST /auth/bootstrap-vessel-admin (gated by VESSEL_BOOTSTRAP_KEY env on the
 * server) and signs in on success.
 */
export function SetupVesselPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [bootstrapKey, setBootstrapKey] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [vesselName, setVesselName] = useState('');
  const [vesselImoNumber, setVesselImoNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<SetupStatus>('/auth/setup-status')
      .then((s) => setStatus(s))
      .catch((e: unknown) =>
        setStatusError(e instanceof Error ? e.message : 'Could not reach the vessel API'),
      );
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<BootstrapResult>('/auth/bootstrap-vessel-admin', {
        bootstrapKey,
        tenantId: tenantId.trim(),
        tenantName: tenantName.trim(),
        ...(vesselName.trim() && { vesselName: vesselName.trim() }),
        ...(vesselImoNumber.trim() && { vesselImoNumber: vesselImoNumber.trim() }),
        email: email.trim(),
        password,
      });
      login(res.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provisioning failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (statusError) {
    return (
      <Screen>
        <div className="text-center text-red-300 text-sm">{statusError}</div>
      </Screen>
    );
  }

  if (status === null) {
    return (
      <Screen>
        <div className="text-center text-slate-400 text-sm">Checking vessel status…</div>
      </Screen>
    );
  }

  if (!status.bootstrapEnabled) {
    return (
      <Screen>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="font-semibold text-slate-900 mb-2">Vessel not provisioned</h2>
          <p className="text-sm text-slate-600 mb-3">
            This vessel laptop has no users yet, and provisioning is disabled. Ask shore IT to set{' '}
            <code>VESSEL_BOOTSTRAP_KEY</code> in the desktop environment, then relaunch.
          </p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900 text-lg">First-launch setup</h2>
          <p className="text-sm text-slate-600 mt-1">
            This vessel install is empty. Create the initial tenant administrator below.
          </p>
        </div>
        <Input
          id="bootstrapKey"
          type="password"
          label="Bootstrap key"
          placeholder="from shore IT"
          value={bootstrapKey}
          onChange={(e) => setBootstrapKey(e.target.value)}
          required
        />
        <Input
          id="tenantId"
          label="Tenant ID (ULID)"
          placeholder="01KQWX2HPGZBJJR9Z8W53SQJM4"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          required
        />
        <Input
          id="tenantName"
          label="Tenant name"
          placeholder="Arab Bridge Maritime"
          value={tenantName}
          onChange={(e) => setTenantName(e.target.value)}
          required
        />
        <Input
          id="vesselName"
          label="Vessel name (optional)"
          placeholder="MV Example"
          value={vesselName}
          onChange={(e) => setVesselName(e.target.value)}
        />
        <Input
          id="vesselImoNumber"
          label="Vessel IMO number (optional)"
          placeholder="9372688"
          value={vesselImoNumber}
          onChange={(e) => setVesselImoNumber(e.target.value)}
        />
        <Input
          id="email"
          type="email"
          label="Admin email"
          placeholder="captain@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          id="password"
          type="password"
          label="Password (≥ 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          id="confirm"
          type="password"
          label="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}
        <Button type="submit" className="w-full" loading={submitting}>
          Create vessel administrator
        </Button>
      </form>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-4xl">⚓</span>
          <h1 className="text-2xl font-bold text-white mt-2">FleetOps</h1>
          <p className="text-slate-400 text-sm mt-1">Vessel setup</p>
        </div>
        {children}
        <div className="mt-4 flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
