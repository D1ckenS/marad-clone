import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface QhseObjectiveEditable {
  id: string;
  category: 'Q' | 'H' | 'S' | 'E';
  label: string;
  target: string;
  actual: string;
  unit: string;
  status: 'GREEN' | 'AMBER' | 'RED';
  delta: string | null;
  trend: number[] | null;
}

interface Props {
  objective: QhseObjectiveEditable;
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORY_OPTIONS = [
  { value: 'Q', label: 'Quality' },
  { value: 'H', label: 'Health' },
  { value: 'S', label: 'Safety' },
  { value: 'E', label: 'Environment' },
];

const STATUS_OPTIONS = [
  { value: 'GREEN', label: 'On target' },
  { value: 'AMBER', label: 'At risk' },
  { value: 'RED', label: 'Off target' },
];

export function EditQhseObjectiveModal({ objective, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => ({
    category: objective.category,
    label: objective.label,
    target: objective.target,
    actual: objective.actual,
    unit: objective.unit,
    status: objective.status,
    delta: objective.delta ?? '',
    trendText: (objective.trend ?? []).join(', '),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      category: objective.category,
      label: objective.label,
      target: objective.target,
      actual: objective.actual,
      unit: objective.unit,
      status: objective.status,
      delta: objective.delta ?? '',
      trendText: (objective.trend ?? []).join(', '),
    });
    setError(null);
  }, [objective]);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.label.trim() || !form.target.trim() || !form.actual.trim() || !form.unit.trim()) {
      setError('Label, target, actual and unit are required.');
      return;
    }
    const trend = form.trendText
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/qhse-objectives/${objective.id}`, {
        category: form.category,
        label: form.label.trim(),
        target: form.target.trim(),
        actual: form.actual.trim(),
        unit: form.unit.trim(),
        status: form.status,
        delta: form.delta.trim() || null,
        trend: trend.length > 0 ? trend : null,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update objective.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Edit QHSE objective"
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
            id="obj-category"
            label="Category"
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v as typeof f.category }))}
          />
          <Select
            id="obj-status"
            label="Status"
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v as typeof f.status }))}
          />
        </div>
        <Input
          id="obj-label"
          label="Label *"
          value={form.label}
          onChange={set('label')}
          autoFocus
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input id="obj-target" label="Target *" value={form.target} onChange={set('target')} />
          <Input id="obj-actual" label="Actual *" value={form.actual} onChange={set('actual')} />
          <Input id="obj-unit" label="Unit *" value={form.unit} onChange={set('unit')} />
        </div>
        <Input id="obj-delta" label="Delta" value={form.delta} onChange={set('delta')} />
        <Input
          id="obj-trend"
          label="Trend (comma-separated numbers)"
          value={form.trendText}
          onChange={set('trendText')}
        />
      </div>
    </Modal>
  );
}
