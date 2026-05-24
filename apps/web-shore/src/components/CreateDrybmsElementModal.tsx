import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      setError(t('qhse.drybms_modal.error_required'));
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
      setError(e instanceof Error ? e.message : t('qhse.drybms_modal.error_create'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('qhse.drybms_modal.title_create')}
      onClose={handleClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            {t('common.create')}
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
            label={`${t('qhse.drybms_modal.field_chapter')} *`}
            value={form.chapter}
            onChange={set('chapter')}
            autoFocus
            placeholder="1"
          />
          <Input
            id="db-chap-title"
            label={`${t('qhse.drybms_modal.field_chapter_title')} *`}
            value={form.chapterTitle}
            onChange={set('chapterTitle')}
            placeholder="Leadership"
          />
          <Input
            id="db-score"
            label={t('qhse.drybms_modal.field_score')}
            type="number"
            min="1"
            max="4"
            value={form.score}
            onChange={set('score')}
          />
        </div>
        <Input
          id="db-name"
          label={`${t('qhse.drybms_modal.field_name')} *`}
          value={form.name}
          onChange={set('name')}
          placeholder="Senior management commitment"
        />
        <Input
          id="db-stage"
          label={t('qhse.drybms_modal.field_stage')}
          value={form.stage}
          onChange={set('stage')}
          placeholder="Reactive / Compliant / Proactive / Resilient"
        />
        <TextArea
          id="db-evidence"
          label={t('qhse.drybms_modal.field_evidence')}
          rows={3}
          value={form.evidence}
          onChange={set('evidence')}
        />
      </div>
    </Modal>
  );
}
