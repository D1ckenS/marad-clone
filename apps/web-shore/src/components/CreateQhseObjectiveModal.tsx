import { useState } from 'react';
import { Button, Input, Modal, Select } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
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

const EMPTY = {
  category: 'S',
  label: '',
  target: '',
  actual: '',
  unit: '',
  status: 'GREEN',
  delta: '',
  trendText: '',
};

export function CreateQhseObjectiveModal({ open, onClose, onCreated }: Props) {
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
      await api.post('/qhse-objectives', {
        category: form.category,
        label: form.label.trim(),
        target: form.target.trim(),
        actual: form.actual.trim(),
        unit: form.unit.trim(),
        status: form.status,
        delta: form.delta.trim() || undefined,
        trend: trend.length > 0 ? trend : undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create objective.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="New QHSE objective"
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
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
          />
          <Select
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v }))}
          />
        </div>
        <Input
          id="obj-label"
          label="Label *"
          value={form.label}
          onChange={set('label')}
          autoFocus
          placeholder="LTI rate"
        />
        <div className="grid grid-cols-3 gap-3">
          <Input
            id="obj-target"
            label="Target *"
            value={form.target}
            onChange={set('target')}
            placeholder="0"
          />
          <Input
            id="obj-actual"
            label="Actual *"
            value={form.actual}
            onChange={set('actual')}
            placeholder="0"
          />
          <Input
            id="obj-unit"
            label="Unit *"
            value={form.unit}
            onChange={set('unit')}
            placeholder="per 1M hours"
          />
        </div>
        <Input
          id="obj-delta"
          label="Delta"
          value={form.delta}
          onChange={set('delta')}
          placeholder="-0.2 vs last quarter"
        />
        <Input
          id="obj-trend"
          label="Trend (comma-separated numbers)"
          value={form.trendText}
          onChange={set('trendText')}
          placeholder="0, 0, 1, 0, 0"
        />
      </div>
    </Modal>
  );
}
