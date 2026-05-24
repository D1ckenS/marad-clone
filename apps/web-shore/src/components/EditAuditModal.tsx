import { useEffect, useState } from 'react';
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

const KIND_OPTIONS = [
  { value: 'INTERNAL', label: 'Internal' },
  { value: 'EXTERNAL', label: 'External' },
  { value: 'CLASS', label: 'Class society' },
  { value: 'FLAG', label: 'Flag state' },
];

const STATUS_OPTIONS = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function EditAuditModal({ audit, onClose, onSaved }: Props) {
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
      setError('Scope, scheduled-at and auditor are required.');
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
      setError(e instanceof Error ? e.message : 'Failed to update audit.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Edit audit"
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            Save
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
            options={KIND_OPTIONS}
            value={form.kind}
            onChange={(v) => setForm((f) => ({ ...f, kind: v as typeof f.kind }))}
          />
          <Select
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v as typeof f.status }))}
          />
        </div>
        <Input
          id="aud-scope"
          label="Scope *"
          value={form.scope}
          onChange={set('scope')}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="aud-when"
            label="Scheduled at *"
            type="datetime-local"
            value={form.scheduledAt}
            onChange={set('scheduledAt')}
          />
          <Input
            id="aud-auditor"
            label="Auditor *"
            value={form.auditor}
            onChange={set('auditor')}
          />
        </div>
        <TextArea
          id="aud-notes"
          label="Notes"
          rows={2}
          value={form.notes}
          onChange={set('notes')}
        />
      </div>
    </Modal>
  );
}
