import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface ConditionOfClassEditable {
  id: string;
  severity: 'CONDITION' | 'RECOMMENDATION' | 'MEMORANDUM' | 'CLOSED';
  title: string;
  detail: string;
  raisedAt: string;
  openedAt: string;
  dueAt: string | null;
}

interface Props {
  condition: ConditionOfClassEditable;
  onClose: () => void;
  onSaved: () => void;
}

const SEVERITY_OPTIONS = [
  { value: 'CONDITION', label: 'Condition' },
  { value: 'RECOMMENDATION', label: 'Recommendation' },
  { value: 'MEMORANDUM', label: 'Memorandum' },
  { value: 'CLOSED', label: 'Closed' },
];

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function EditConditionOfClassModal({ condition, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => ({
    severity: condition.severity,
    title: condition.title,
    detail: condition.detail,
    raisedAt: toLocalInput(condition.raisedAt),
    openedAt: toLocalInput(condition.openedAt),
    dueAt: toLocalInput(condition.dueAt),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      severity: condition.severity,
      title: condition.title,
      detail: condition.detail,
      raisedAt: toLocalInput(condition.raisedAt),
      openedAt: toLocalInput(condition.openedAt),
      dueAt: toLocalInput(condition.dueAt),
    });
    setError(null);
  }, [condition]);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.detail.trim() || !form.raisedAt || !form.openedAt) {
      setError('Title, detail, raised-at and opened-at are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/conditions-of-class/${condition.id}`, {
        severity: form.severity,
        title: form.title.trim(),
        detail: form.detail.trim(),
        raisedAt: new Date(form.raisedAt).toISOString(),
        openedAt: new Date(form.openedAt).toISOString(),
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update condition of class.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Edit condition of class"
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
        <Select
          id="coc-severity"
          label="Severity"
          options={SEVERITY_OPTIONS}
          value={form.severity}
          onChange={(v) => setForm((f) => ({ ...f, severity: v as typeof f.severity }))}
        />
        <Input
          id="coc-title"
          label="Title *"
          value={form.title}
          onChange={set('title')}
          autoFocus
        />
        <TextArea
          id="coc-detail"
          label="Detail *"
          rows={3}
          value={form.detail}
          onChange={set('detail')}
        />
        <div className="grid grid-cols-3 gap-3">
          <Input
            id="coc-raised"
            label="Raised at *"
            type="datetime-local"
            value={form.raisedAt}
            onChange={set('raisedAt')}
          />
          <Input
            id="coc-opened"
            label="Opened at *"
            type="datetime-local"
            value={form.openedAt}
            onChange={set('openedAt')}
          />
          <Input
            id="coc-due"
            label="Due at"
            type="datetime-local"
            value={form.dueAt}
            onChange={set('dueAt')}
          />
        </div>
      </div>
    </Modal>
  );
}
