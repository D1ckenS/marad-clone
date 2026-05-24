import { useEffect, useState } from 'react';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface JhaEditable {
  id: string;
  ref: string;
  title: string;
  activity: string | null;
  hazards: unknown;
  controls: unknown;
  residualL: number;
  residualS: number;
}

interface Props {
  jha: JhaEditable;
  onClose: () => void;
  onSaved: () => void;
}

function splitLines(s: string): string[] {
  return s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

function joinLines(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value.map((v) => (typeof v === 'string' ? v : String(v))).join('\n');
}

export function EditJhaModal({ jha, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => ({
    ref: jha.ref,
    title: jha.title,
    activity: jha.activity ?? '',
    hazardsText: joinLines(jha.hazards),
    controlsText: joinLines(jha.controls),
    residualL: String(jha.residualL),
    residualS: String(jha.residualS),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      ref: jha.ref,
      title: jha.title,
      activity: jha.activity ?? '',
      hazardsText: joinLines(jha.hazards),
      controlsText: joinLines(jha.controls),
      residualL: String(jha.residualL),
      residualS: String(jha.residualS),
    });
    setError(null);
  }, [jha]);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

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
      await api.patch(`/jhas/${jha.id}`, {
        ref: form.ref.trim(),
        title: form.title.trim(),
        activity: form.activity.trim() || null,
        hazards,
        controls,
        residualL: Math.max(1, Math.min(5, Number(form.residualL) || 1)),
        residualS: Math.max(1, Math.min(5, Number(form.residualS) || 1)),
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update JHA.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Edit JHA / risk assessment"
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
          <Input id="jha-ref" label="Ref *" value={form.ref} onChange={set('ref')} autoFocus />
          <Input
            id="jha-activity"
            label="Activity"
            value={form.activity}
            onChange={set('activity')}
          />
        </div>
        <Input id="jha-title" label="Title *" value={form.title} onChange={set('title')} />
        <TextArea
          id="jha-hazards"
          label="Hazards (one per line) *"
          rows={3}
          value={form.hazardsText}
          onChange={set('hazardsText')}
        />
        <TextArea
          id="jha-controls"
          label="Key controls (one per line) *"
          rows={3}
          value={form.controlsText}
          onChange={set('controlsText')}
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
