import { useState } from 'react';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  vesselId: string;
  onClose: () => void;
  onCreated: () => void;
}

const KIND_OPTIONS = [
  { value: 'PSC', label: 'Port State Control' },
  { value: 'VETTING', label: 'Vetting' },
  { value: 'FLAG', label: 'Flag' },
];

const EMPTY = {
  inspectedAt: '',
  kind: 'PSC',
  mou: '',
  port: '',
  inspector: '',
  deficiencies: '0',
  detained: false,
  status: 'Open',
  findings: '',
};

export function CreateInspectionModal({ open, vesselId, onClose, onCreated }: Props) {
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
    if (!form.inspectedAt || !form.port.trim() || !form.inspector.trim() || !form.status.trim()) {
      setError('Inspected-at, port, inspector and status are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/inspections', {
        vesselId,
        inspectedAt: new Date(form.inspectedAt).toISOString(),
        kind: form.kind,
        mou: form.mou.trim() || undefined,
        port: form.port.trim(),
        inspector: form.inspector.trim(),
        deficiencies: Number(form.deficiencies) || 0,
        detained: form.detained,
        status: form.status.trim(),
        findings: form.findings.trim() || undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to record inspection.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Record inspection"
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
            id="ins-when"
            label="Inspected at *"
            type="datetime-local"
            value={form.inspectedAt}
            onChange={set('inspectedAt')}
            autoFocus
          />
          <Select
            id="ins-kind"
            label="Kind"
            options={KIND_OPTIONS}
            value={form.kind}
            onChange={(v) => setForm((f) => ({ ...f, kind: v }))}
          />
          <Input
            id="ins-port"
            label="Port *"
            value={form.port}
            onChange={set('port')}
            placeholder="Singapore"
          />
          <Input
            id="ins-inspector"
            label="Inspector *"
            value={form.inspector}
            onChange={set('inspector')}
            placeholder="MPA / USCG / ABS"
          />
          <Input
            id="ins-mou"
            label="MOU"
            value={form.mou}
            onChange={set('mou')}
            placeholder="Tokyo / Paris"
          />
          <Input
            id="ins-status"
            label="Status *"
            value={form.status}
            onChange={set('status')}
            placeholder="Open / Closed"
          />
          <Input
            id="ins-def"
            label="Deficiencies"
            type="number"
            min="0"
            value={form.deficiencies}
            onChange={set('deficiencies')}
          />
          <label className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink-2)' }}>
            <input
              type="checkbox"
              checked={form.detained}
              onChange={(e) => setForm((f) => ({ ...f, detained: e.target.checked }))}
            />
            Detained
          </label>
        </div>
        <TextArea
          id="ins-findings"
          label="Findings"
          rows={3}
          value={form.findings}
          onChange={set('findings')}
        />
      </div>
    </Modal>
  );
}
