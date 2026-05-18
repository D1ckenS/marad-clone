import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import {
  TypicalPartsList,
  partsToJson,
  partsFromJson,
  type TypicalPart,
} from './TypicalPartsList.js';

export interface Job {
  id: string;
  componentId: string;
  title: string;
  description: string | null;
  intervalDays: number | null;
  intervalRunningHours: string | null;
  estimatedHours: string | null;
  priority: string;
  typicalPartsJson?: string | null;
}

interface Props {
  open: boolean;
  job: Job | null;
  componentName: string;
  onClose: () => void;
  onSaved: () => void;
}

type IntervalMode = 'days' | 'hours';
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;

export function EditJobModal({ open, job, componentName, onClose, onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<IntervalMode>('days');
  const [intervalDays, setIntervalDays] = useState('');
  const [intervalHours, setIntervalHours] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [typicalParts, setTypicalParts] = useState<TypicalPart[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form state whenever the job being edited changes.
  useEffect(() => {
    if (!job) return;
    setTitle(job.title);
    setDescription(job.description ?? '');
    setMode(job.intervalDays != null ? 'days' : 'hours');
    setIntervalDays(job.intervalDays?.toString() ?? '');
    setIntervalHours(job.intervalRunningHours ?? '');
    setEstimatedHours(job.estimatedHours ?? '');
    setPriority(job.priority);
    setTypicalParts(partsFromJson(job.typicalPartsJson));
    setError(null);
  }, [job]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!job) return;
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    const hasDays = mode === 'days' && !!intervalDays;
    const hasHours = mode === 'hours' && !!intervalHours;
    if (!hasDays && !hasHours) {
      setError('An interval is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        estimatedHours: estimatedHours || undefined,
        typicalPartsJson: partsToJson(typicalParts),
      };
      if (mode === 'days') {
        body.intervalDays = Number(intervalDays);
        body.intervalRunningHours = null;
      } else {
        body.intervalRunningHours = intervalHours;
        body.intervalDays = null;
      }

      await api.patch(`/jobs/${job.id}`, body);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Edit Job — ${componentName}`}
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}
        <Input
          id="ej-title"
          label="Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <TextArea
          id="ej-desc"
          label="Description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div>
          <span className="block text-sm font-medium text-slate-700 mb-1">Interval *</span>
          <div className="flex rounded-md border border-slate-200 overflow-hidden text-sm mb-2">
            {(['days', 'hours'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 px-3 transition-colors ${mode === m ? 'bg-blue-600 text-white font-medium' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {m === 'days' ? 'Calendar days' : 'Running hours'}
              </button>
            ))}
          </div>
          {mode === 'days' ? (
            <Input
              id="ej-days"
              label="Every N days"
              type="number"
              min="1"
              step="1"
              value={intervalDays}
              onChange={(e) => setIntervalDays(e.target.value)}
            />
          ) : (
            <Input
              id="ej-hours"
              label="Every N running hours"
              type="number"
              min="1"
              step="1"
              value={intervalHours}
              onChange={(e) => setIntervalHours(e.target.value)}
            />
          )}
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="ej-priority">
              Priority
            </label>
            <Select
              value={priority}
              onChange={setPriority}
              options={PRIORITIES.map((p) => ({ value: p, label: p }))}
            />
          </div>
          <div className="w-40">
            <Input
              id="ej-est"
              label="Est. hours"
              type="number"
              min="0"
              step="0.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
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
