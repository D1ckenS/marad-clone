import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { useAuth } from '../context/useAuth.js';

interface ProfileData {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface UpdateResult {
  access_token: string;
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { login } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [infoStatus, setInfoStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pwStatus, setPwStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    api
      .get<ProfileData>('/users/me')
      .then((p) => {
        setProfile(p);
        setFirstName(p.firstName ?? '');
        setLastName(p.lastName ?? '');
        setEmail(p.email);
      })
      .catch(() => {});
  }, []);

  async function handleInfoSave(e: React.FormEvent) {
    e.preventDefault();
    setInfoStatus(null);
    setInfoLoading(true);
    try {
      const res = await api.patch<UpdateResult>('/users/me', {
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        email: email.trim(),
      });
      login(res.access_token);
      setInfoStatus({ ok: true, msg: t('profile.profile_updated') });
    } catch (err) {
      setInfoStatus({ ok: false, msg: err instanceof Error ? err.message : 'Update failed.' });
    } finally {
      setInfoLoading(false);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPwStatus(null);
    if (newPassword !== confirmPassword) {
      setPwStatus({ ok: false, msg: t('profile.passwords_no_match') });
      return;
    }
    setPwLoading(true);
    try {
      const res = await api.patch<UpdateResult>('/users/me', {
        currentPassword,
        newPassword,
      });
      login(res.access_token);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwStatus({ ok: true, msg: t('profile.password_changed') });
    } catch (err) {
      setPwStatus({ ok: false, msg: err instanceof Error ? err.message : 'Update failed.' });
    } finally {
      setPwLoading(false);
    }
  }

  if (!profile) {
    return <div style={{ color: '#8893A0', fontSize: 14, padding: 8 }}>{t('profile.loading')}</div>;
  }

  const roleLabel = profile.role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div style={{ maxWidth: 480 }}>
      <h1
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#0A1F33',
          marginBottom: 4,
          letterSpacing: '-0.01em',
        }}
      >
        {t('profile.title')}
      </h1>
      <p style={{ fontSize: 13, color: '#8893A0', marginTop: 0, marginBottom: 28 }}>
        {roleLabel}
        {profile.username ? ` · @${profile.username}` : ''}
      </p>

      {/* ── Personal information ─────────────────────────────────────── */}
      <section
        style={{
          background: '#fff',
          border: '1px solid #E5E3DA',
          borderRadius: 10,
          padding: '20px 24px',
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#0A1F33',
            marginTop: 0,
            marginBottom: 16,
          }}
        >
          {t('profile.personal_info')}
        </h2>
        <form
          onSubmit={handleInfoSave}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              id="firstName"
              label={t('profile.first_name')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              id="lastName"
              label={t('profile.last_name')}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <Input
            id="email"
            label={t('profile.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {infoStatus && (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: infoStatus.ok ? '#2F7D4F' : '#AB382E',
                background: infoStatus.ok ? '#F0FAF4' : '#FDF2F1',
                borderRadius: 6,
                padding: '8px 12px',
              }}
            >
              {infoStatus.msg}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" loading={infoLoading} size="sm">
              {t('profile.save_changes')}
            </Button>
          </div>
        </form>
      </section>

      {/* ── Change password ──────────────────────────────────────────── */}
      <section
        style={{
          background: '#fff',
          border: '1px solid #E5E3DA',
          borderRadius: 10,
          padding: '20px 24px',
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#0A1F33',
            marginTop: 0,
            marginBottom: 16,
          }}
        >
          {t('profile.change_password')}
        </h2>
        <form
          onSubmit={handlePasswordSave}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <Input
            id="currentPassword"
            label={t('profile.current_password')}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            id="newPassword"
            label={t('profile.new_password')}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            id="confirmPassword"
            label={t('profile.confirm_password')}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {pwStatus && (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: pwStatus.ok ? '#2F7D4F' : '#AB382E',
                background: pwStatus.ok ? '#F0FAF4' : '#FDF2F1',
                borderRadius: 6,
                padding: '8px 12px',
              }}
            >
              {pwStatus.msg}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" loading={pwLoading} size="sm">
              {t('profile.change_password')}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
