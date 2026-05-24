import { useState } from 'react';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY = {
  chapter: '',
  chapterTitle: '',
  name: '',
  score: '1',
  stage: '',
  evidence: '',
};

export function CreateDrybmsElementModal({ open, onClose, onCreated }: Props) {
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
    if (!form.chapter.trim() || !form.chapterTitle.trim() || !form.name.trim()) {
      setError('Chapter, chapter title and name are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/drybms-elements', {
        chapter: form.chapter.trim(),
        chapterTitle: form.chapterTitle.trim(),
        name: form.name.trim(),
        score: Math.max(1, Math.min(4, Number(form.score) || 1)),
        stage: form.stage.trim() || undefined,
        evidence: form.evidence.trim() || undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add element.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Add DryBMS element"
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            id="db-chap"
            label="Chapter *"
            value={form.chapter}
            onChange={set('chapter')}
            autoFocus
            placeholder="1"
          />
          <Input
            id="db-chap-title"
            label="Chapter title *"
            value={form.chapterTitle}
            onChange={set('chapterTitle')}
            placeholder="Leadership"
          />
          <Input
            id="db-score"
            label="Score (1-4)"
            type="number"
            min="1"
            max="4"
            value={form.score}
            onChange={set('score')}
          />
        </div>
        <Input
          id="db-name"
          label="Name *"
          value={form.name}
          onChange={set('name')}
          placeholder="Senior management commitment"
        />
        <Input
          id="db-stage"
          label="Maturity stage"
          value={form.stage}
          onChange={set('stage')}
          placeholder="Reactive / Compliant / Proactive / Resilient"
        />
        <TextArea
          id="db-evidence"
          label="Evidence"
          rows={3}
          value={form.evidence}
          onChange={set('evidence')}
        />
      </div>
    </Modal>
  );
}
