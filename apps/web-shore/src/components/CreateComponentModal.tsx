import { useState } from 'react';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  /** Pre-set when adding a child component. */
  parentId?: string | null | undefined;
  parentName?: string | null | undefined;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY = { name: '', description: '', sfi: '', runningHours: '0' };

export function CreateComponentModal({ open, parentId, parentName, onClose, onCreated }: Props) {
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
      await api.post('/components', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        sfi: form.sfi.trim() || undefined,
        runningHours: form.runningHours || '0',
        parentId: parentId ?? undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create component.');
    } finally {
      setSaving(false);
    }
  };

  const title = parentId ? `Add Child to "${parentName ?? parentId}"` : 'New Component';

  return (
    <Modal
      open={open}
      title={title}
      onClose={handleClose}
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
        <Input
          id="comp-name"
          label="Name *"
          value={form.name}
          onChange={set('name')}
          placeholder="Main Engine"
          autoFocus
        />
        <TextArea
          id="comp-desc"
          label="Description"
          rows={2}
          value={form.description}
          onChange={set('description')}
          placeholder="Optional details..."
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              id="comp-sfi"
              label="SFI Code"
              value={form.sfi}
              onChange={set('sfi')}
              placeholder="230.01"
            />
          </div>
          <div className="w-36">
            <Input
              id="comp-rh"
              label="Initial Running Hours"
              type="number"
              min="0"
              step="0.1"
              value={form.runningHours}
              onChange={set('runningHours')}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
