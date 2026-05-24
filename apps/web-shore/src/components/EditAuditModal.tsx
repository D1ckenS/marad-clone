import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface AuditEditable {
  id: string;
  kind: 'INTERNAL' | 'EXTERNAL' | 'CLASS' | 'FLAG';
  scope: string;
  scheduledAt: string;
  auditor: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  notes?: string | null;
}

interface Props {
  audit: AuditEditable;
  onClose: () => void;
  onSaved: () => void;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function EditAuditModal({ audit, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    kind: audit.kind,
    scope: audit.scope,
    scheduledAt: toLocalInput(audit.scheduledAt),
    auditor: audit.auditor,
    status: audit.status,
    notes: audit.notes ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kindOptions = useMemo(
    () => [
      { value: 'INTERNAL', label: t('qhse.audit_modal.kind_internal') },
      { value: 'EXTERNAL', label: t('qhse.audit_modal.kind_external') },
      { value: 'CLASS', label: t('qhse.audit_modal.kind_class') },
      { value: 'FLAG', label: t('qhse.audit_modal.kind_flag') },
    ],
    [t],
  );

  const statusOptions = useMemo(
    () => [
      { value: 'SCHEDULED', label: t('qhse.audit_modal.status_scheduled') },
      { value: 'IN_PROGRESS', label: t('qhse.audit_modal.status_in_progress') },
      { value: 'COMPLETED', label: t('qhse.audit_modal.status_completed') },
      { value: 'CANCELLED', label: t('qhse.audit_modal.status_cancelled') },
    ],
    [t],
  );

  useEffect(() => {
    setForm({
      kind: audit.kind,
      scope: audit.scope,
      scheduledAt: toLocalInput(audit.scheduledAt),
      auditor: audit.auditor,
      status: audit.status,
      notes: audit.notes ?? '',
    });
    setError(null);
  }, [audit]);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.scope.trim() || !form.scheduledAt || !form.auditor.trim()) {
      setError(t('qhse.audit_modal.error_required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/audits/${audit.id}`, {
        kind: form.kind,
        scope: form.scope.trim(),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        auditor: form.auditor.trim(),
        status: form.status,
        notes: form.notes.trim() || null,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('qhse.audit_modal.error_update'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={t('qhse.audit_modal.title_edit')}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Select
            id="aud-kind"
            label={t('qhse.audit_modal.field_kind')}
            options={kindOptions}
            value={form.kind}
            onChange={(v) => setForm((f) => ({ ...f, kind: v as typeof f.kind }))}
          />
          <Select
            id="aud-status"
            label={t('qhse.audit_modal.field_status')}
            options={statusOptions}
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v as typeof f.status }))}
          />
        </div>
        <Input
          id="aud-scope"
          label={`${t('qhse.audit_modal.field_scope')} *`}
          value={form.scope}
          onChange={set('scope')}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="aud-when"
            label={`${t('qhse.audit_modal.field_scheduled_at')} *`}
            type="datetime-local"
            value={form.scheduledAt}
            onChange={set('scheduledAt')}
          />
          <Input
            id="aud-auditor"
            label={`${t('qhse.audit_modal.field_auditor')} *`}
            value={form.auditor}
            onChange={set('auditor')}
          />
        </div>
        <TextArea
          id="aud-notes"
          label={t('qhse.audit_modal.field_notes')}
          rows={2}
          value={form.notes}
          onChange={set('notes')}
        />
      </div>
    </Modal>
  );
}
