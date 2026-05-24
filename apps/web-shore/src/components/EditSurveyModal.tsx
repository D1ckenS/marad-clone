import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface SurveyEditable {
  id: string;
  scheduledAt: string;
  kind: string;
  scope: string;
  surveyor: string;
  location: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED';
  notes?: string | null;
}

interface Props {
  survey: SurveyEditable;
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_OPTIONS = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'POSTPONED', label: 'Postponed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function EditSurveyModal({ survey, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => ({
    scheduledAt: toLocalInput(survey.scheduledAt),
    kind: survey.kind,
    scope: survey.scope,
    surveyor: survey.surveyor,
    location: survey.location,
    status: survey.status,
    notes: survey.notes ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      scheduledAt: toLocalInput(survey.scheduledAt),
      kind: survey.kind,
      scope: survey.scope,
      surveyor: survey.surveyor,
      location: survey.location,
      status: survey.status,
      notes: survey.notes ?? '',
    });
    setError(null);
  }, [survey]);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

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
      await api.patch(`/surveys/${survey.id}`, {
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        kind: form.kind.trim(),
        scope: form.scope.trim(),
        surveyor: form.surveyor.trim(),
        location: form.location.trim(),
        status: form.status,
        notes: form.notes.trim() || null,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update survey.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Edit survey"
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
        <Input
          id="sv-scheduled"
          label="Scheduled at *"
          type="datetime-local"
          value={form.scheduledAt}
          onChange={set('scheduledAt')}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Input id="sv-kind" label="Kind *" value={form.kind} onChange={set('kind')} />
          <Input id="sv-scope" label="Scope *" value={form.scope} onChange={set('scope')} />
          <Input
            id="sv-surveyor"
            label="Surveyor *"
            value={form.surveyor}
            onChange={set('surveyor')}
          />
          <Input
            id="sv-location"
            label="Location *"
            value={form.location}
            onChange={set('location')}
          />
        </div>
        <Select
          options={STATUS_OPTIONS}
          value={form.status}
          onChange={(v) => setForm((f) => ({ ...f, status: v as typeof f.status }))}
        />
        <TextArea id="sv-notes" label="Notes" rows={2} value={form.notes} onChange={set('notes')} />
      </div>
    </Modal>
  );
}
