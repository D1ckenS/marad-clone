import { useState } from 'react';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const STATUS_OPTIONS = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const EMPTY = {
  kind: 'Annual',
  scheduledAt: '',
  chair: '',
  attendees: '0',
  status: 'SCHEDULED',
  actionsTotal: '0',
  actionsDone: '0',
  summary: '',
};

export function CreateManagementReviewModal({ open, onClose, onCreated }: Props) {
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
    if (!form.kind.trim() || !form.scheduledAt || !form.chair.trim()) {
      setError('Kind, scheduled-at and chair are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/management-reviews', {
        kind: form.kind.trim(),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        chair: form.chair.trim(),
        attendees: Math.max(0, Number(form.attendees) || 0),
        status: form.status,
        actionsTotal: Math.max(0, Number(form.actionsTotal) || 0),
        actionsDone: Math.max(0, Number(form.actionsDone) || 0),
        summary: form.summary.trim() || undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to schedule review.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Schedule management review"
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
          <Input
            id="mr-kind"
            label="Kind *"
            value={form.kind}
            onChange={set('kind')}
            autoFocus
            placeholder="Annual / Quarterly"
          />
          <Select
            id="mr-status"
            label="Status"
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v }))}
          />
          <Input
            id="mr-when"
            label="Scheduled at *"
            type="datetime-local"
            value={form.scheduledAt}
            onChange={set('scheduledAt')}
          />
          <Input
            id="mr-chair"
            label="Chair *"
            value={form.chair}
            onChange={set('chair')}
            placeholder="CEO / DPA"
          />
          <Input
            id="mr-att"
            label="Attendees"
            type="number"
            min="0"
            value={form.attendees}
            onChange={set('attendees')}
          />
          <Input
            id="mr-actions"
            label="Actions (total)"
            type="number"
            min="0"
            value={form.actionsTotal}
            onChange={set('actionsTotal')}
          />
          <Input
            id="mr-done"
            label="Actions (done)"
            type="number"
            min="0"
            value={form.actionsDone}
            onChange={set('actionsDone')}
          />
        </div>
        <TextArea
          id="mr-summary"
          label="Summary"
          rows={3}
          value={form.summary}
          onChange={set('summary')}
        />
      </div>
    </Modal>
  );
}
