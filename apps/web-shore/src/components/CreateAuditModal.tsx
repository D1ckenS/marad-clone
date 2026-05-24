import { useState } from 'react';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  /** Optional vesselId; when omitted, the audit is created at fleet level. */
  vesselId?: string | null;
  onClose: () => void;
  onCreated: () => void;
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

const EMPTY = {
  kind: 'INTERNAL',
  scope: '',
  scheduledAt: '',
  auditor: '',
  status: 'SCHEDULED',
  notes: '',
};

export function CreateAuditModal({ open, vesselId, onClose, onCreated }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleClose = () => {
    setForm(EMPTY);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.scope.trim() || !form.scheduledAt || !form.auditor.trim()) {
      setError('Scope, scheduled-at and auditor are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/audits', {
        vesselId: vesselId || undefined,
        kind: form.kind,
        scope: form.scope.trim(),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        auditor: form.auditor.trim(),
        status: form.status,
        notes: form.notes.trim() || undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to schedule audit.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Schedule audit"
      onClose={handleClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            Create
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
            label="Kind"
            options={KIND_OPTIONS}
            value={form.kind}
            onChange={(v) => setForm((f) => ({ ...f, kind: v }))}
          />
          <Select
            id="aud-status"
            label="Status"
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v }))}
          />
        </div>
        <Input
          id="aud-scope"
          label="Scope *"
          value={form.scope}
          onChange={set('scope')}
          autoFocus
          placeholder="PMS module / SMS / Bridge"
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
            placeholder="Name / org"
          />
        </div>
        <TextArea
          id="aud-notes"
          label="Notes"
          rows={2}
          value={form.notes}
          onChange={set('notes')}
        />
        {!vesselId && (
          <div className="text-xs italic" style={{ color: 'var(--ink-3)' }}>
            No vessel selected — audit will be created at fleet level.
          </div>
        )}
      </div>
    </Modal>
  );
}
