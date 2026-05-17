import { useEffect, useState } from 'react';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

export interface PartItem {
  id: string;
  name: string;
  partNumber: string | null;
  unit: string;
  description?: string | null;
}

interface Props {
  open: boolean;
  part: PartItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditPartModal({ open, part, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!part) return;
    setName(part.name);
    setPartNumber(part.partNumber ?? '');
    setUnit(part.unit);
    setDescription(part.description ?? '');
    setError(null);
  }, [part]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!part) return;
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/parts/${part.id}`, {
        name: name.trim(),
        partNumber: partNumber.trim() || undefined,
        unit: unit.trim() || undefined,
        description: description.trim() || undefined,
      });
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
      title="Edit Part"
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
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
          id="ep-name"
          label="Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              id="ep-num"
              label="Part Number"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
            />
          </div>
          <div className="w-28">
            <Input
              id="ep-unit"
              label="Unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="pcs / L / kg"
            />
          </div>
        </div>
        <TextArea
          id="ep-desc"
          label="Description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}
