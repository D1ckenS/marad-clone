import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Input, Modal, Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Company {
  id: string;
  name: string;
  shortName: string | null;
  createdAt: string;
  vesselCount: number;
  userCount: number;
}

// ─── Modals ──────────────────────────────────────────────────────────────────

function CreateCompanyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!name.trim() || !adminEmail.trim() || !adminUsername.trim() || !adminPassword) {
      setErr('Company name, admin email, username and password are all required');
      return;
    }
    setSaving(true);
    try {
      await api.post<unknown>('/tenants', {
        name: name.trim(),
        shortName: shortName.trim() || undefined,
        admin: {
          email: adminEmail.trim(),
          username: adminUsername.trim(),
          password: adminPassword,
        },
      });
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create company');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Add company" onClose={onClose} size="sm">
      <div className="flex flex-col gap-3 p-4">
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Company name *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Shipping B.V."
            autoFocus
          />
        </div>
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Short name{' '}
            <span style={{ color: 'var(--ink-3)' }}>
              (shown in the sidebar — falls back to full name)
            </span>
          </label>
          <Input
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="Acme"
          />
        </div>
        <div
          className="rounded-2 p-3 flex flex-col gap-3"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-widest m-0"
            style={{ color: 'var(--ink-3)' }}
          >
            First admin account
          </p>
          <div>
            <label
              className="text-[11.5px] font-medium mb-1 block"
              style={{ color: 'var(--ink-2)' }}
            >
              Email *
            </label>
            <Input
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@company.com"
            />
          </div>
          <div>
            <label
              className="text-[11.5px] font-medium mb-1 block"
              style={{ color: 'var(--ink-2)' }}
            >
              Username *
            </label>
            <Input
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              placeholder="e.g. Admin"
            />
          </div>
          <div>
            <label
              className="text-[11.5px] font-medium mb-1 block"
              style={{ color: 'var(--ink-2)' }}
            >
              Password *
            </label>
            <Input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Min 8 characters"
            />
          </div>
        </div>
        {err && (
          <p className="text-[11.5px] m-0" style={{ color: 'var(--sig-red)' }}>
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Create company
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditCompanyModal({
  company,
  onClose,
  onSaved,
}: {
  company: Company;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(company.name);
  const [shortName, setShortName] = useState(company.shortName ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!name.trim()) {
      setErr('Name is required');
      return;
    }
    setSaving(true);
    try {
      await api.patch<unknown>(`/tenants/${company.id}`, {
        name: name.trim(),
        shortName: shortName.trim() || null,
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update company');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Edit company" onClose={onClose} size="sm">
      <div className="flex flex-col gap-3 p-4">
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Company name *
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Short name{' '}
            <span style={{ color: 'var(--ink-3)' }}>
              (shown in the sidebar — falls back to full name)
            </span>
          </label>
          <Input
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="Leave blank to use full name"
          />
        </div>
        {err && (
          <p className="text-[11.5px] m-0" style={{ color: 'var(--sig-red)' }}>
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Create admin modal ───────────────────────────────────────────────────────

function CreateAdminModal({
  company,
  onClose,
  onCreated,
}: {
  company: Company;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) {
      setErr('Email and password are required');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/tenants/${company.id}/users`, {
        email: email.trim(),
        username: username.trim() || undefined,
        password,
        role: 'TENANT_ADMIN',
      });
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create admin');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={`Create admin for ${company.shortName ?? company.name}`}
      onClose={onClose}
      size="sm"
    >
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[12px] m-0" style={{ color: 'var(--ink-3)' }}>
          Creates a <strong>Tenant Admin</strong> account. This user can then log in and manage
          vessels and users for their company.
        </p>
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Email *
          </label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@company.com"
            autoFocus
          />
        </div>
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Username * <span style={{ color: 'var(--ink-3)' }}>(used to log in)</span>
          </label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. John"
            required
          />
        </div>
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Password *
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
          />
        </div>
        {err && (
          <p className="text-[11.5px] m-0" style={{ color: 'var(--sig-red)' }}>
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Create admin
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [edit, setEdit] = useState<Company | null>(null);
  const [createAdmin, setCreateAdmin] = useState<Company | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const cs = await api.get<Company[]>('/tenants').catch(() => [] as Company[]);
    setCompanies(cs);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ maxWidth: '1000px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1
            className="text-[20px] font-semibold m-0"
            style={{ letterSpacing: '-0.01em', color: 'var(--ink)' }}
          >
            Companies
          </h1>
          <p className="text-[12.5px] mt-0.5 m-0" style={{ color: 'var(--ink-3)' }}>
            Platform-level management · visible only to super admins
          </p>
        </div>
        <div className="flex-1" />
        <Button onClick={() => setShowCreate(true)}>+ Add company</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner />
        </div>
      ) : (
        <div
          className="rounded-2 overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {/* Column headers */}
          <div
            className="grid gap-4 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-widest"
            style={{
              gridTemplateColumns: 'minmax(200px, 1fr) 130px 90px 90px 110px 150px',
              background: 'var(--surface-sunk)',
              color: 'var(--ink-3)',
              borderBottom: '1px solid var(--hairline)',
            }}
          >
            <span>Company</span>
            <span>Short name</span>
            <span style={{ textAlign: 'left' }}>Vessels</span>
            <span style={{ textAlign: 'left' }}>Users</span>
            <span>Created</span>
            <span style={{ textAlign: 'center' }}>Action</span>
          </div>

          {companies.length === 0 && (
            <div className="px-4 py-8 text-center text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
              No companies yet.
            </div>
          )}

          {companies.map((c, i) => (
            <div
              key={c.id}
              className="grid gap-4 px-4 py-3 items-center"
              style={{
                gridTemplateColumns: 'minmax(200px, 1fr) 130px 90px 90px 110px 150px',
                borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
              }}
            >
              <div className="min-w-0">
                <div
                  className="text-[13.5px] font-semibold truncate"
                  style={{ color: 'var(--ink)' }}
                >
                  {c.name}
                </div>
                <div className="font-mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                  {c.id}
                </div>
              </div>
              <div className="min-w-0">
                {c.shortName ? (
                  <span
                    className="text-[12.5px] font-medium truncate block"
                    style={{ color: 'var(--ink-2)' }}
                  >
                    {c.shortName}
                  </span>
                ) : (
                  <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                    —
                  </span>
                )}
              </div>
              <div style={{ textAlign: 'left' }}>
                <Badge color="blue">{c.vesselCount}</Badge>
              </div>
              <div style={{ textAlign: 'left' }}>
                <Badge color="slate">{c.userCount}</Badge>
              </div>
              <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                {new Date(c.createdAt).toLocaleDateString('en-GB')}
              </span>
              <div className="flex gap-1.5 justify-end">
                <button
                  onClick={() => setCreateAdmin(c)}
                  className="text-[11px] px-2 py-1 rounded-1 font-medium"
                  style={{
                    background: 'var(--navy)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  + Admin
                </button>
                <button
                  onClick={() => setEdit(c)}
                  className="text-[11.5px] px-2.5 py-1 rounded-1 border"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    cursor: 'pointer',
                    color: 'var(--ink-2)',
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateCompanyModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {edit && <EditCompanyModal company={edit} onClose={() => setEdit(null)} onSaved={load} />}
      {createAdmin && (
        <CreateAdminModal
          company={createAdmin}
          onClose={() => setCreateAdmin(null)}
          onCreated={load}
        />
      )}
    </div>
  );
}
