import { useEffect, useState } from 'react';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

export interface ComponentItem {
  id: string;
  name: string;
  description: string | null;
  sfi: string | null;
  parentId: string | null;
  runningHours: string;
}

interface Props {
  open: boolean;
  component: ComponentItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditComponentModal({ open, component, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sfi, setSfi] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!component) return;
    setName(component.name);
    setDescription(component.description ?? '');
    setSfi(component.sfi ?? '');
    setError(null);
  }, [component]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!component) return;
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/components/${component.id}`, {
        name: name.trim(),
        description: description.trim() || undefined,
        sfi: sfi.trim() || undefined,
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
      title="Edit Component"
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
          id="ec-name"
          label="Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <TextArea
          id="ec-desc"
          label="Description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Input
          id="ec-sfi"
          label="SFI Code"
          value={sfi}
          onChange={(e) => setSfi(e.target.value)}
          placeholder="230.01"
        />
      </div>
    </Modal>
  );
}
