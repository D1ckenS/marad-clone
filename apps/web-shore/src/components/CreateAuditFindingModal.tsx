import { useState } from 'react';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  vesselId: string;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY = {
  auditId: '',
  classification: 'Minor NC',
  smsRef: '',
  title: '',
  detail: '',
  owner: '',
  openedAt: '',
  dueAt: '',
};

export function CreateAuditFindingModal({ open, vesselId, onClose, onCreated }: Props) {
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
    if (!form.classification.trim() || !form.title.trim() || !form.openedAt) {
      setError('Classification, title and opened-at are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/audit-findings', {
        vesselId,
        auditId: form.auditId.trim() || undefined,
        classification: form.classification.trim(),
        smsRef: form.smsRef.trim() || undefined,
        title: form.title.trim(),
        detail: form.detail.trim() || undefined,
        owner: form.owner.trim() || undefined,
        openedAt: new Date(form.openedAt).toISOString(),
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to raise finding.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Raise audit finding"
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
        <Input
          id="af-class"
          label="Classification *"
          value={form.classification}
          onChange={set('classification')}
          placeholder="Major NC / Minor NC / Observation"
          autoFocus
        />
        <Input id="af-title" label="Title *" value={form.title} onChange={set('title')} />
        <TextArea
          id="af-detail"
          label="Detail"
          rows={3}
          value={form.detail}
          onChange={set('detail')}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="af-audit"
            label="Audit ID"
            value={form.auditId}
            onChange={set('auditId')}
            placeholder="Optional"
          />
          <Input
            id="af-sms"
            label="SMS ref"
            value={form.smsRef}
            onChange={set('smsRef')}
            placeholder="SMS-1.2.3"
          />
          <Input
            id="af-owner"
            label="Owner"
            value={form.owner}
            onChange={set('owner')}
            placeholder="Chief Officer"
          />
          <Input
            id="af-opened"
            label="Opened at *"
            type="datetime-local"
            value={form.openedAt}
            onChange={set('openedAt')}
          />
          <Input
            id="af-due"
            label="Due at"
            type="datetime-local"
            value={form.dueAt}
            onChange={set('dueAt')}
          />
        </div>
      </div>
    </Modal>
  );
}
