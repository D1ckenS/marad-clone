import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Input, Modal, Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { useVessel } from '../context/VesselContext.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Vessel {
  id: string;
  name: string;
  imoNumber: string | null;
}

interface User {
  id: string;
  email: string;
  role: string;
  vesselId: string | null;
}

const ROLES = [
  'TENANT_ADMIN',
  'PURCHASE_MANAGER',
  'MASTER',
  'CHIEF_ENGINEER',
  'OFFICER',
  'CREW',
] as const;

type Role = (typeof ROLES)[number];

const ROLE_COLORS: Record<string, 'blue' | 'amber' | 'green' | 'slate' | 'purple' | 'red'> = {
  TENANT_ADMIN: 'purple',
  PURCHASE_MANAGER: 'blue',
  MASTER: 'amber',
  CHIEF_ENGINEER: 'amber',
  OFFICER: 'green',
  CREW: 'slate',
  SUPER_ADMIN: 'red',
};

// ─── Modals ──────────────────────────────────────────────────────────────────

function CreateVesselModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [imo, setImo] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!name.trim()) {
      setErr('Name is required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/vessels', { name: name.trim(), imoNumber: imo.trim() || undefined });
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create vessel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Add vessel" onClose={onClose} size="sm">
      <div className="flex flex-col gap-3 p-4">
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Vessel name *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="MV Example"
            autoFocus
          />
        </div>
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            IMO number
          </label>
          <Input value={imo} onChange={(e) => setImo(e.target.value)} placeholder="9999999" />
        </div>
        {err && (
          <p className="text-[11.5px]" style={{ color: 'var(--sig-red)' }}>
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Add vessel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditVesselModal({
  vessel,
  onClose,
  onSaved,
}: {
  vessel: Vessel;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(vessel.name);
  const [imo, setImo] = useState(vessel.imoNumber ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!name.trim()) {
      setErr('Name is required');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/vessels/${vessel.id}`, {
        name: name.trim(),
        imoNumber: imo.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update vessel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Edit vessel" onClose={onClose} size="sm">
      <div className="flex flex-col gap-3 p-4">
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Vessel name *
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            IMO number
          </label>
          <Input value={imo} onChange={(e) => setImo(e.target.value)} placeholder="9999999" />
        </div>
        {err && (
          <p className="text-[11.5px]" style={{ color: 'var(--sig-red)' }}>
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

function AddUserModal({
  vessels,
  defaultVesselId,
  onClose,
  onCreated,
}: {
  vessels: Vessel[];
  defaultVesselId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('OFFICER');
  const [vesselId, setVesselId] = useState<string>(defaultVesselId ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) {
      setErr('Email and password are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/users', {
        email: email.trim(),
        username: username.trim() || undefined,
        password,
        role,
        vesselId: vesselId || undefined,
      });
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    height: 36,
    padding: '0 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    fontSize: 13,
    color: 'var(--ink)',
    fontFamily: 'inherit',
  };

  return (
    <Modal open title="Add user" onClose={onClose} size="sm">
      <div className="flex flex-col gap-3 p-4">
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Email *
          </label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@company.com"
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
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            style={selectStyle}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Assign to vessel{' '}
            <span style={{ color: 'var(--ink-3)' }}>
              (optional — leave blank for fleet-wide access)
            </span>
          </label>
          <select
            value={vesselId}
            onChange={(e) => setVesselId(e.target.value)}
            style={selectStyle}
          >
            <option value="">No vessel (fleet-wide)</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        {err && (
          <p className="text-[11.5px]" style={{ color: 'var(--sig-red)' }}>
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Add user
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditUserModal({
  user,
  vessels,
  onClose,
  onSaved,
}: {
  user: User;
  vessels: Vessel[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<Role>(user.role as Role);
  const [vesselId, setVesselId] = useState<string>(user.vesselId ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setSaving(true);
    try {
      await api.patch(`/users/${user.id}`, { role, vesselId: vesselId || null });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    height: 36,
    padding: '0 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    fontSize: 13,
    color: 'var(--ink)',
    fontFamily: 'inherit',
  };

  return (
    <Modal open title="Edit user" onClose={onClose} size="sm">
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[12.5px] m-0" style={{ color: 'var(--ink-2)' }}>
          {user.email}
        </p>
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            style={selectStyle}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Vessel assignment
          </label>
          <select
            value={vesselId}
            onChange={(e) => setVesselId(e.target.value)}
            style={selectStyle}
          >
            <option value="">No vessel (fleet-wide)</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        {err && (
          <p className="text-[11.5px]" style={{ color: 'var(--sig-red)' }}>
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

// ─── Main page ────────────────────────────────────────────────────────────────

export function VesselsPage() {
  const { reload: reloadVesselCtx } = useVessel();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVessel, setSelectedVessel] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [editVessel, setEditVessel] = useState<Vessel | null>(null);
  const [showAddUser, setShowAddUser] = useState<string | null>(null); // vesselId
  const [editUser, setEditUser] = useState<User | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [vs, us] = await Promise.all([
      api.get<Vessel[]>('/vessels').catch(() => [] as Vessel[]),
      api.get<User[]>('/users').catch(() => [] as User[]),
    ]);
    setVessels(vs);
    setUsers(us);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleteVessel = async (id: string) => {
    if (!confirm('Delete this vessel? This cannot be undone.')) return;
    await api.delete(`/vessels/${id}`).catch(() => null);
    reloadVesselCtx();
    load();
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Remove this user?')) return;
    await api.delete(`/users/${id}`).catch(() => null);
    load();
  };

  const afterChange = () => {
    reloadVesselCtx();
    load();
  };

  const usersForVessel = (vesselId: string) => users.filter((u) => u.vesselId === vesselId);
  const unassignedUsers = users.filter((u) => !u.vesselId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1
            className="text-[20px] font-semibold m-0"
            style={{ letterSpacing: '-0.01em', color: 'var(--ink)' }}
          >
            Vessels & Users
          </h1>
          <p className="text-[12.5px] mt-0.5 m-0" style={{ color: 'var(--ink-3)' }}>
            {vessels.length} vessel{vessels.length !== 1 ? 's' : ''} · {users.length} user
            {users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex-1" />
        <Button onClick={() => setShowAddUser('')}>+ Add user</Button>
        <Button onClick={() => setShowCreate(true)}>+ Add vessel</Button>
      </div>

      {/* Vessel cards */}
      <div className="flex flex-col gap-4">
        {vessels.length === 0 && (
          <div
            className="rounded-2 flex items-center justify-center py-12"
            style={{
              background: 'var(--surface)',
              border: '1px dashed var(--border)',
              color: 'var(--ink-3)',
              fontSize: 13,
            }}
          >
            No vessels yet. Add your first vessel to get started.
          </div>
        )}

        {vessels.map((v) => {
          const vUsers = usersForVessel(v.id);
          const isOpen = selectedVessel === v.id;
          return (
            <div
              key={v.id}
              className="rounded-2 overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              {/* Vessel header row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                style={{
                  borderBottom: isOpen ? '1px solid var(--hairline)' : 'none',
                  background: 'var(--surface)',
                }}
                onClick={() => setSelectedVessel(isOpen ? null : v.id)}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'var(--surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--ink-2)',
                    letterSpacing: '0.04em',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  <span>IMO</span>
                  <span style={{ fontSize: 9 }}>{v.imoNumber ?? '—'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                    {v.name}
                  </div>
                  <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                    {vUsers.length} user{vUsers.length !== 1 ? 's' : ''}
                    {v.imoNumber && <> · IMO {v.imoNumber}</>}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditVessel(v);
                  }}
                  className="px-2.5 py-1 rounded-1 text-[11.5px] border"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    cursor: 'pointer',
                    color: 'var(--ink-2)',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteVessel(v.id);
                  }}
                  className="px-2.5 py-1 rounded-1 text-[11.5px] border"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    cursor: 'pointer',
                    color: 'var(--sig-red)',
                  }}
                >
                  Delete
                </button>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  style={{
                    color: 'var(--ink-3)',
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform .15s',
                  }}
                >
                  <path
                    d="M3 5l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Users section (expanded) */}
              {isOpen && (
                <div style={{ background: 'var(--bg)' }}>
                  {/* Users header */}
                  <div
                    className="flex items-center gap-2 px-4 py-2"
                    style={{
                      background: 'var(--surface-2)',
                      borderBottom: '1px solid var(--hairline)',
                    }}
                  >
                    <span
                      className="text-[10.5px] font-semibold uppercase tracking-widest flex-1"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      Users assigned to {v.name}
                    </span>
                    <button
                      onClick={() => setShowAddUser(v.id)}
                      className="px-2.5 py-0.5 rounded-1 text-[11.5px] font-medium"
                      style={{
                        background: 'var(--navy)',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      + Add user
                    </button>
                  </div>

                  {vUsers.length === 0 ? (
                    <div className="px-4 py-4 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                      No users assigned to this vessel yet.
                    </div>
                  ) : (
                    <div>
                      {vUsers.map((u, i) => (
                        <div
                          key={u.id}
                          className="flex items-center gap-3 px-4 py-2.5"
                          style={{
                            borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
                            background: 'var(--surface)',
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-[12.5px] font-medium truncate"
                              style={{ color: 'var(--ink)' }}
                            >
                              {u.email}
                            </div>
                          </div>
                          <Badge color={ROLE_COLORS[u.role] ?? 'slate'}>
                            {u.role.replace(/_/g, ' ')}
                          </Badge>
                          <button
                            onClick={() => setEditUser(u)}
                            className="text-[11px] px-2 py-0.5 rounded-1 border"
                            style={{
                              background: 'var(--surface)',
                              borderColor: 'var(--border)',
                              cursor: 'pointer',
                              color: 'var(--ink-2)',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-[11px] px-2 py-0.5 rounded-1 border"
                            style={{
                              background: 'var(--surface)',
                              borderColor: 'var(--border)',
                              cursor: 'pointer',
                              color: 'var(--sig-red)',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Fleet-wide users (no vessel assigned) */}
        {unassignedUsers.length > 0 && (
          <div
            className="rounded-2 overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surface-2)' }}
            >
              <span
                className="text-[10.5px] font-semibold uppercase tracking-widest flex-1"
                style={{ color: 'var(--ink-3)' }}
              >
                Fleet-wide users (no vessel assigned)
              </span>
            </div>
            {unassignedUsers.map((u, i) => (
              <div
                key={u.id}
                className="flex items-center gap-3 px-4 py-2.5"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--hairline)' }}
              >
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[12.5px] font-medium truncate"
                    style={{ color: 'var(--ink)' }}
                  >
                    {u.email}
                  </div>
                </div>
                <Badge color={ROLE_COLORS[u.role] ?? 'slate'}>{u.role.replace(/_/g, ' ')}</Badge>
                <button
                  onClick={() => setEditUser(u)}
                  className="text-[11px] px-2 py-0.5 rounded-1 border"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    cursor: 'pointer',
                    color: 'var(--ink-2)',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteUser(u.id)}
                  className="text-[11px] px-2 py-0.5 rounded-1 border"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    cursor: 'pointer',
                    color: 'var(--sig-red)',
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateVesselModal onClose={() => setShowCreate(false)} onCreated={afterChange} />
      )}
      {editVessel && (
        <EditVesselModal
          vessel={editVessel}
          onClose={() => setEditVessel(null)}
          onSaved={afterChange}
        />
      )}
      {showAddUser !== null && (
        <AddUserModal
          vessels={vessels}
          defaultVesselId={showAddUser || null}
          onClose={() => setShowAddUser(null)}
          onCreated={load}
        />
      )}
      {editUser && (
        <EditUserModal
          user={editUser}
          vessels={vessels}
          onClose={() => setEditUser(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
