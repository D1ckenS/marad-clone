import { useState } from 'react';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY = {
  ref: '',
  title: '',
  activity: '',
  hazardsText: '',
  controlsText: '',
  residualL: '1',
  residualS: '1',
};

function splitLines(s: string): string[] {
  return s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function CreateJhaModal({ open, onClose, onCreated }: Props) {
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
    if (!form.ref.trim() || !form.title.trim()) {
      setError('Ref and title are required.');
      return;
    }
    const hazards = splitLines(form.hazardsText);
    const controls = splitLines(form.controlsText);
    if (hazards.length === 0 || controls.length === 0) {
      setError('Add at least one hazard and one control (one per line).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/jhas', {
        ref: form.ref.trim(),
        title: form.title.trim(),
        activity: form.activity.trim() || undefined,
        hazards,
        controls,
        residualL: Math.max(1, Math.min(5, Number(form.residualL) || 1)),
        residualS: Math.max(1, Math.min(5, Number(form.residualS) || 1)),
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create JHA.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="New JHA / risk assessment"
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
          <Input
            id="jha-ref"
            label="Ref *"
            value={form.ref}
            onChange={set('ref')}
            placeholder="JHA-001"
            autoFocus
          />
          <Input
            id="jha-activity"
            label="Activity"
            value={form.activity}
            onChange={set('activity')}
            placeholder="Hot work / Enclosed entry"
          />
        </div>
        <Input id="jha-title" label="Title *" value={form.title} onChange={set('title')} />
        <TextArea
          id="jha-hazards"
          label="Hazards (one per line) *"
          rows={3}
          value={form.hazardsText}
          onChange={set('hazardsText')}
          placeholder={'Fall\nDropped object\nAtmosphere'}
        />
        <TextArea
          id="jha-controls"
          label="Key controls (one per line) *"
          rows={3}
          value={form.controlsText}
          onChange={set('controlsText')}
          placeholder={'Harness + lanyard\nExclusion zone\nGas check'}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="jha-l"
            label="Residual likelihood (1-5)"
            type="number"
            min="1"
            max="5"
            value={form.residualL}
            onChange={set('residualL')}
          />
          <Input
            id="jha-s"
            label="Residual severity (1-5)"
            type="number"
            min="1"
            max="5"
            value={form.residualS}
            onChange={set('residualS')}
          />
        </div>
      </div>
    </Modal>
  );
}
