import { useState } from 'react';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  vesselId: string;
  onClose: () => void;
  onCreated: () => void;
}

const STATUS_OPTIONS = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'POSTPONED', label: 'Postponed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const EMPTY = {
  scheduledAt: '',
  kind: '',
  scope: '',
  surveyor: '',
  location: '',
  status: 'SCHEDULED',
  notes: '',
};

export function CreateSurveyModal({ open, vesselId, onClose, onCreated }: Props) {
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
    if (
      !form.scheduledAt ||
      !form.kind.trim() ||
      !form.scope.trim() ||
      !form.surveyor.trim() ||
      !form.location.trim()
    ) {
      setError('Scheduled date, kind, scope, surveyor and location are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/surveys', {
        vesselId,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        kind: form.kind.trim(),
        scope: form.scope.trim(),
        surveyor: form.surveyor.trim(),
        location: form.location.trim(),
        status: form.status,
        notes: form.notes.trim() || undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create survey.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Schedule survey"
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
        <Input
          id="sv-scheduled"
          label="Scheduled at *"
          type="datetime-local"
          value={form.scheduledAt}
          onChange={set('scheduledAt')}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="sv-kind"
            label="Kind *"
            value={form.kind}
            onChange={set('kind')}
            placeholder="Annual / Intermediate / Renewal"
          />
          <Input
            id="sv-scope"
            label="Scope *"
            value={form.scope}
            onChange={set('scope')}
            placeholder="Hull / Machinery / Class"
          />
          <Input
            id="sv-surveyor"
            label="Surveyor *"
            value={form.surveyor}
            onChange={set('surveyor')}
            placeholder="DNV / ABS / LR"
          />
          <Input
            id="sv-location"
            label="Location *"
            value={form.location}
            onChange={set('location')}
            placeholder="Port / yard"
          />
        </div>
        <Select
          options={STATUS_OPTIONS}
          value={form.status}
          onChange={(v) => setForm((f) => ({ ...f, status: v }))}
        />
        <TextArea id="sv-notes" label="Notes" rows={2} value={form.notes} onChange={set('notes')} />
      </div>
    </Modal>
  );
}
