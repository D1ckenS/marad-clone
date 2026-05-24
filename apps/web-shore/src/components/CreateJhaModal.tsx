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
    if (!form.ref.trim() || !form.title.trim()) {
      setError(t('safety.jha_modal.error_required'));
      return;
    }
    const hazards = splitLines(form.hazardsText);
    const controls = splitLines(form.controlsText);
    if (hazards.length === 0 || controls.length === 0) {
      setError(t('safety.jha_modal.error_hazards_controls'));
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
      setError(e instanceof Error ? e.message : t('safety.jha_modal.error_create'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('safety.jha_modal.title_create')}
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
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="jha-ref"
            label={`${t('safety.jha_modal.field_ref')} *`}
            value={form.ref}
            onChange={set('ref')}
            placeholder="JHA-001"
            autoFocus
          />
          <Input
            id="jha-activity"
            label={t('safety.jha_modal.field_activity')}
            value={form.activity}
            onChange={set('activity')}
            placeholder="Hot work / Enclosed entry"
          />
        </div>
        <Input
          id="jha-title"
          label={`${t('safety.jha_modal.field_title')} *`}
          value={form.title}
          onChange={set('title')}
        />
        <TextArea
          id="jha-hazards"
          label={`${t('safety.jha_modal.field_hazards')} *`}
          rows={3}
          value={form.hazardsText}
          onChange={set('hazardsText')}
          placeholder={'Fall\nDropped object\nAtmosphere'}
        />
        <TextArea
          id="jha-controls"
          label={`${t('safety.jha_modal.field_controls')} *`}
          rows={3}
          value={form.controlsText}
          onChange={set('controlsText')}
          placeholder={'Harness + lanyard\nExclusion zone\nGas check'}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="jha-l"
            label={t('safety.jha_modal.field_residual_l')}
            type="number"
            min="1"
            max="5"
            value={form.residualL}
            onChange={set('residualL')}
          />
          <Input
            id="jha-s"
            label={t('safety.jha_modal.field_residual_s')}
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
