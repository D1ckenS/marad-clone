import { useState } from 'react';
import { Button, Input, Modal, Select } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  vesselId: string;
  onClose: () => void;
  onCreated: () => void;
}

const CATEGORY_OPTIONS = [
  { value: 'FFA', label: 'Fire-fighting (FFA)' },
  { value: 'LSA', label: 'Life-saving (LSA)' },
  { value: 'OTH', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'GREEN', label: 'Green' },
  { value: 'AMBER', label: 'Amber' },
  { value: 'RED', label: 'Red' },
];

const EMPTY = {
  category: 'FFA',
  name: '',
  location: '',
  quantity: '',
  lastCheck: '',
  nextCheck: '',
  status: 'GREEN',
  flag: '',
};

export function CreateSafetyEquipmentModal({ open, vesselId, onClose, onCreated }: Props) {
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
    if (!form.name.trim() || !form.location.trim() || !form.quantity.trim()) {
      setError('Name, location and quantity are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/safety-equipment', {
        vesselId,
        category: form.category,
        name: form.name.trim(),
        location: form.location.trim(),
        quantity: form.quantity.trim(),
        lastCheck: form.lastCheck ? new Date(form.lastCheck).toISOString() : undefined,
        nextCheck: form.nextCheck ? new Date(form.nextCheck).toISOString() : undefined,
        status: form.status,
        flag: form.flag.trim() || undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add safety equipment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Add safety equipment"
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
          id="se-name"
          label="Name *"
          value={form.name}
          onChange={set('name')}
          autoFocus
          placeholder="Foam extinguisher 9L"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="se-loc"
            label="Location *"
            value={form.location}
            onChange={set('location')}
            placeholder="Engine room fwd"
          />
          <Input
            id="se-qty"
            label="Quantity *"
            value={form.quantity}
            onChange={set('quantity')}
            placeholder="4 / 2 sets"
          />
          <Input
            id="se-last"
            label="Last check"
            type="date"
            value={form.lastCheck}
            onChange={set('lastCheck')}
          />
          <Input
            id="se-next"
            label="Next check"
            type="date"
            value={form.nextCheck}
            onChange={set('nextCheck')}
          />
        </div>
        <Input id="se-flag" label="Flag / note" value={form.flag} onChange={set('flag')} />
      </div>
    </Modal>
  );
}
