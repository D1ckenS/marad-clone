import { useState } from 'react';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (partId: string, partName: string) => void;
}

const EMPTY = { name: '', partNumber: '', unit: 'pcs', description: '' };

export function CreatePartModal({ open, onClose, onCreated }: Props) {
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
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await api.post<{ id: string }>('/parts', {
        name: form.name.trim(),
        partNumber: form.partNumber.trim() || undefined,
        unit: form.unit.trim() || 'pcs',
        description: form.description.trim() || undefined,
      });
      setForm(EMPTY);
      onCreated(created.id, form.name.trim());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create part.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="New Part"
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            Create Part
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}
        <Input
          id="part-name"
          label="Name *"
          value={form.name}
          onChange={set('name')}
          placeholder="Engine Oil SAE 40"
          autoFocus
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              id="part-num"
              label="Part Number"
              value={form.partNumber}
              onChange={set('partNumber')}
              placeholder="OIL-001"
            />
          </div>
          <div className="w-32">
            <Input
              id="part-unit"
              label="Unit"
              value={form.unit}
              onChange={set('unit')}
              placeholder="pcs / L / kg"
            />
          </div>
        </div>
        <TextArea
          id="part-desc"
          label="Description"
          rows={2}
          value={form.description}
          onChange={set('description')}
          placeholder="Optional details..."
        />
        <div className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-md">
          After creating the part you can configure stock levels (min / reorder / max) per location.
        </div>
      </div>
    </Modal>
  );
}
