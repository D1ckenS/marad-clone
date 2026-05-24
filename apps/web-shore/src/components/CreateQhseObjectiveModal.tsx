import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY = {
  category: 'S',
  label: '',
  target: '',
  actual: '',
  unit: '',
  status: 'GREEN',
  delta: '',
  trendText: '',
};

export function CreateQhseObjectiveModal({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () => [
      { value: 'Q', label: t('qhse.objective_modal.category_quality') },
      { value: 'H', label: t('qhse.objective_modal.category_health') },
      { value: 'S', label: t('qhse.objective_modal.category_safety') },
      { value: 'E', label: t('qhse.objective_modal.category_environment') },
    ],
    [t],
  );

  const statusOptions = useMemo(
    () => [
      { value: 'GREEN', label: t('qhse.objective_modal.status_on_target') },
      { value: 'AMBER', label: t('qhse.objective_modal.status_at_risk') },
      { value: 'RED', label: t('qhse.objective_modal.status_off_target') },
    ],
    [t],
  );

  const set =
    (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleClose = () => {
    setForm(EMPTY);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.label.trim() || !form.target.trim() || !form.actual.trim() || !form.unit.trim()) {
      setError(t('qhse.objective_modal.error_required'));
      return;
    }
    const trend = form.trendText
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));
    setSaving(true);
    setError(null);
    try {
      await api.post('/qhse-objectives', {
        category: form.category,
        label: form.label.trim(),
        target: form.target.trim(),
        actual: form.actual.trim(),
        unit: form.unit.trim(),
        status: form.status,
        delta: form.delta.trim() || undefined,
        trend: trend.length > 0 ? trend : undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('qhse.objective_modal.error_create'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('qhse.objective_modal.title_create')}
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
          <Select
            id="obj-category"
            label={t('qhse.objective_modal.field_category')}
            options={categoryOptions}
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
          />
          <Select
            id="obj-status"
            label={t('qhse.objective_modal.field_status')}
            options={statusOptions}
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v }))}
          />
        </div>
        <Input
          id="obj-label"
          label={`${t('qhse.objective_modal.field_label')} *`}
          value={form.label}
          onChange={set('label')}
          autoFocus
          placeholder="LTI rate"
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            id="obj-target"
            label={`${t('qhse.objective_modal.field_target')} *`}
            value={form.target}
            onChange={set('target')}
            placeholder="0"
          />
          <Input
            id="obj-actual"
            label={`${t('qhse.objective_modal.field_actual')} *`}
            value={form.actual}
            onChange={set('actual')}
            placeholder="0"
          />
          <Input
            id="obj-unit"
            label={`${t('qhse.objective_modal.field_unit')} *`}
            value={form.unit}
            onChange={set('unit')}
            placeholder="per 1M hours"
          />
        </div>
        <Input
          id="obj-delta"
          label={t('qhse.objective_modal.field_delta')}
          value={form.delta}
          onChange={set('delta')}
          placeholder="-0.2 vs last quarter"
        />
        <Input
          id="obj-trend"
          label={t('qhse.objective_modal.field_trend')}
          value={form.trendText}
          onChange={set('trendText')}
          placeholder="0, 0, 1, 0, 0"
        />
      </div>
    </Modal>
  );
}
