import { useState } from 'react';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  vesselId: string;
  onClose: () => void;
  onCreated: () => void;
}

const SEVERITY_OPTIONS = [
  { value: 'CONDITION', label: 'Condition' },
  { value: 'RECOMMENDATION', label: 'Recommendation' },
  { value: 'MEMORANDUM', label: 'Memorandum' },
  { value: 'CLOSED', label: 'Closed' },
];

const EMPTY = {
  severity: 'CONDITION',
  title: '',
  detail: '',
  raisedAt: '',
  openedAt: '',
  dueAt: '',
};

export function CreateConditionOfClassModal({ open, vesselId, onClose, onCreated }: Props) {
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
    if (!form.title.trim() || !form.detail.trim() || !form.raisedAt || !form.openedAt) {
      setError('Title, detail, raised-at and opened-at are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/conditions-of-class', {
        vesselId,
        severity: form.severity,
        title: form.title.trim(),
        detail: form.detail.trim(),
        raisedAt: new Date(form.raisedAt).toISOString(),
        openedAt: new Date(form.openedAt).toISOString(),
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create condition of class.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Add condition of class"
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
        <Select
          id="coc-severity"
          label="Severity"
          options={SEVERITY_OPTIONS}
          value={form.severity}
          onChange={(v) => setForm((f) => ({ ...f, severity: v }))}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
