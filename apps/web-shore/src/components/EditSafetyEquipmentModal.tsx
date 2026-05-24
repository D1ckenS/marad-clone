import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface SafetyEquipmentEditable {
  id: string;
  category: 'FFA' | 'LSA' | 'OTH';
  name: string;
  location: string;
  quantity: string;
  lastCheck: string | null;
  nextCheck: string | null;
  status: 'GREEN' | 'AMBER' | 'RED';
  flag: string | null;
}

interface Props {
  equipment: SafetyEquipmentEditable;
  onClose: () => void;
  onSaved: () => void;
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

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function EditSafetyEquipmentModal({ equipment, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => ({
    category: equipment.category,
    name: equipment.name,
    location: equipment.location,
    quantity: equipment.quantity,
    lastCheck: toDateInput(equipment.lastCheck),
    nextCheck: toDateInput(equipment.nextCheck),
    status: equipment.status,
    flag: equipment.flag ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      category: equipment.category,
      name: equipment.name,
      location: equipment.location,
      quantity: equipment.quantity,
      lastCheck: toDateInput(equipment.lastCheck),
      nextCheck: toDateInput(equipment.nextCheck),
      status: equipment.status,
      flag: equipment.flag ?? '',
    });
    setError(null);
  }, [equipment]);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.location.trim() || !form.quantity.trim()) {
      setError('Name, location and quantity are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/safety-equipment/${equipment.id}`, {
        category: form.category,
        name: form.name.trim(),
        location: form.location.trim(),
        quantity: form.quantity.trim(),
        lastCheck: form.lastCheck ? new Date(form.lastCheck).toISOString() : null,
        nextCheck: form.nextCheck ? new Date(form.nextCheck).toISOString() : null,
        status: form.status,
        flag: form.flag.trim() || null,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update safety equipment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Edit safety equipment"
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
            id="se-category"
            label="Category"
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v as typeof f.category }))}
          />
          <Select
            id="se-status"
            label="Status"
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v as typeof f.status }))}
          />
        </div>
        <Input id="se-name" label="Name *" value={form.name} onChange={set('name')} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Input id="se-loc" label="Location *" value={form.location} onChange={set('location')} />
          <Input id="se-qty" label="Quantity *" value={form.quantity} onChange={set('quantity')} />
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
