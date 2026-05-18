import { useState } from 'react';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { TypicalPartsList, partsToJson, type TypicalPart } from './TypicalPartsList.js';

interface Props {
  open: boolean;
  componentId: string;
  componentName: string;
  onClose: () => void;
  /** Called with the new job's id so the caller can open a job-instance modal. */
  onCreated: (newJobId: string) => void;
}

type IntervalMode = 'days' | 'hours';
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
const EMPTY = {
  title: '',
  description: '',
  intervalDays: '',
  intervalHours: '',
  estimatedHours: '',
  priority: 'NORMAL' as string,
};

export function CreateJobModal({ open, componentId, componentName, onClose, onCreated }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [mode, setMode] = useState<IntervalMode>('days');
  const [typicalParts, setTypicalParts] = useState<TypicalPart[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (field: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleClose = () => {
    setForm(EMPTY);
    setMode('days');
    setTypicalParts([]);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    const hasDays = mode === 'days' && !!form.intervalDays;
    const hasHours = mode === 'hours' && !!form.intervalHours;
    if (!hasDays && !hasHours) {
      setError('An interval (days or running hours) is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        componentId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        estimatedHours: form.estimatedHours || undefined,
        typicalPartsJson: partsToJson(typicalParts),
      };
      if (mode === 'days') body.intervalDays = Number(form.intervalDays);
      else body.intervalRunningHours = form.intervalHours;

      const created = await api.post<{ id: string }>('/jobs', body);
      setForm(EMPTY);
      onCreated(created.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create job.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`New Job — ${componentName}`}
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            Create Job
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}
        <Input
          id="job-title"
          label="Title *"
          value={form.title}
          onChange={set('title')}
          placeholder="Oil Change"
          autoFocus
        />
        <TextArea
          id="job-desc"
          label="Description"
          rows={2}
          value={form.description}
          onChange={set('description')}
          placeholder="Optional details..."
        />

        {/* Interval type toggle */}
        <div>
          <span className="block text-sm font-medium text-slate-700 mb-1">Interval *</span>
          <div className="flex rounded-md border border-slate-200 overflow-hidden text-sm mb-2">
            {(['days', 'hours'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 px-3 transition-colors ${
                  mode === m
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {m === 'days' ? 'Calendar days' : 'Running hours'}
              </button>
            ))}
          </div>
          {mode === 'days' ? (
            <Input
              id="job-days"
              label="Every N days"
              type="number"
              min="1"
              step="1"
              value={form.intervalDays}
              onChange={set('intervalDays')}
              placeholder="90"
            />
          ) : (
            <Input
              id="job-hours"
              label="Every N running hours"
              type="number"
              min="1"
              step="1"
              value={form.intervalHours}
              onChange={set('intervalHours')}
              placeholder="250"
            />
          )}
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="job-priority">
              Priority
            </label>
            <Select
              value={form.priority}
              onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
              options={PRIORITIES.map((p) => ({ value: p, label: p }))}
            />
          </div>
          <div className="w-40">
            <Input
              id="job-est"
              label="Est. hours"
              type="number"
              min="0"
              step="0.5"
              value={form.estimatedHours}
              onChange={set('estimatedHours')}
              placeholder="2"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <TypicalPartsList value={typicalParts} onChange={setTypicalParts} />
        </div>
      </div>
    </Modal>
  );
}
