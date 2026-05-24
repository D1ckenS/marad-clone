import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface QhseObjectiveEditable {
  id: string;
  category: 'Q' | 'H' | 'S' | 'E';
  label: string;
  target: string;
  actual: string;
  unit: string;
  status: 'GREEN' | 'AMBER' | 'RED';
  delta: string | null;
  trend: number[] | null;
}

interface Props {
  objective: QhseObjectiveEditable;
  onClose: () => void;
  onSaved: () => void;
}

export function EditQhseObjectiveModal({ objective, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    category: objective.category,
    label: objective.label,
    target: objective.target,
    actual: objective.actual,
    unit: objective.unit,
    status: objective.status,
    delta: objective.delta ?? '',
    trendText: (objective.trend ?? []).join(', '),
  }));
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

  useEffect(() => {
    setForm({
      category: objective.category,
      label: objective.label,
      target: objective.target,
      actual: objective.actual,
      unit: objective.unit,
      status: objective.status,
      delta: objective.delta ?? '',
      trendText: (objective.trend ?? []).join(', '),
    });
    setError(null);
  }, [objective]);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

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
      await api.patch(`/qhse-objectives/${objective.id}`, {
        category: form.category,
        label: form.label.trim(),
        target: form.target.trim(),
        actual: form.actual.trim(),
        unit: form.unit.trim(),
        status: form.status,
        delta: form.delta.trim() || null,
        trend: trend.length > 0 ? trend : null,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('qhse.objective_modal.error_update'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={t('qhse.objective_modal.title_edit')}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            {t('common.save')}
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
            onChange={(v) => setForm((f) => ({ ...f, category: v as typeof f.category }))}
          />
          <Select
            id="obj-status"
            label={t('qhse.objective_modal.field_status')}
            options={statusOptions}
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v as typeof f.status }))}
          />
        </div>
        <Input
          id="obj-label"
          label={`${t('qhse.objective_modal.field_label')} *`}
          value={form.label}
          onChange={set('label')}
          autoFocus
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            id="obj-target"
            label={`${t('qhse.objective_modal.field_target')} *`}
            value={form.target}
            onChange={set('target')}
          />
          <Input
            id="obj-actual"
            label={`${t('qhse.objective_modal.field_actual')} *`}
            value={form.actual}
            onChange={set('actual')}
          />
          <Input
            id="obj-unit"
            label={`${t('qhse.objective_modal.field_unit')} *`}
            value={form.unit}
            onChange={set('unit')}
          />
        </div>
        <Input
          id="obj-delta"
          label={t('qhse.objective_modal.field_delta')}
          value={form.delta}
          onChange={set('delta')}
        />
        <Input
          id="obj-trend"
          label={t('qhse.objective_modal.field_trend')}
          value={form.trendText}
          onChange={set('trendText')}
        />
      </div>
    </Modal>
  );
}
