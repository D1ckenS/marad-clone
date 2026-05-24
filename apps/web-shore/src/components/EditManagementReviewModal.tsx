import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface ManagementReviewEditable {
  id: string;
  kind: string;
  scheduledAt: string;
  chair: string;
  attendees: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED';
  actionsTotal: number;
  actionsDone: number;
  summary: string | null;
}

interface Props {
  review: ManagementReviewEditable;
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_OPTIONS = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function EditManagementReviewModal({ review, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => ({
    kind: review.kind,
    scheduledAt: toLocalInput(review.scheduledAt),
    chair: review.chair,
    attendees: String(review.attendees),
    status: review.status,
    actionsTotal: String(review.actionsTotal),
    actionsDone: String(review.actionsDone),
    summary: review.summary ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      kind: review.kind,
      scheduledAt: toLocalInput(review.scheduledAt),
      chair: review.chair,
      attendees: String(review.attendees),
      status: review.status,
      actionsTotal: String(review.actionsTotal),
      actionsDone: String(review.actionsDone),
      summary: review.summary ?? '',
    });
    setError(null);
  }, [review]);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.kind.trim() || !form.scheduledAt || !form.chair.trim()) {
      setError('Kind, scheduled-at and chair are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/management-reviews/${review.id}`, {
        kind: form.kind.trim(),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        chair: form.chair.trim(),
        attendees: Math.max(0, Number(form.attendees) || 0),
        status: form.status,
        actionsTotal: Math.max(0, Number(form.actionsTotal) || 0),
        actionsDone: Math.max(0, Number(form.actionsDone) || 0),
        summary: form.summary.trim() || null,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update review.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Edit management review"
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
          <Input id="mr-kind" label="Kind *" value={form.kind} onChange={set('kind')} autoFocus />
          <Select
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v as typeof f.status }))}
          />
          <Input
            id="mr-when"
            label="Scheduled at *"
            type="datetime-local"
            value={form.scheduledAt}
            onChange={set('scheduledAt')}
          />
          <Input id="mr-chair" label="Chair *" value={form.chair} onChange={set('chair')} />
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
