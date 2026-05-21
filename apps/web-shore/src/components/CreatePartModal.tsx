import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

export interface Category {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onCreated: (partId: string, partName: string) => void;
}

const EMPTY = { name: '', partNumber: '', unit: 'pcs', description: '', categoryId: '' };

export function CreatePartModal({ open, categories, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (field: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleClose = () => {
    setForm(EMPTY);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await api.post<{ id: string }>('/parts', {
        name: form.name.trim(),
        partNumber: form.partNumber.trim() || undefined,
        unit: form.unit.trim() || 'pcs',
        description: form.description.trim() || undefined,
        categoryId: form.categoryId || undefined,
      });
      setForm(EMPTY);
      onCreated(created.id, form.name.trim());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create part.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('inventory.new_part')}
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
        <Input
          id="part-name"
          label={t('inventory.part_name')}
          value={form.name}
          onChange={set('name')}
          placeholder="Engine Oil SAE 40"
          autoFocus
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              id="part-num"
              label={t('inventory.part_number')}
              value={form.partNumber}
              onChange={set('partNumber')}
              placeholder="OIL-001"
            />
          </div>
          <div className="w-32">
            <Input
              id="part-unit"
              label={t('inventory.unit')}
              value={form.unit}
              onChange={set('unit')}
              placeholder="pcs / L / kg"
            />
          </div>
        </div>
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Category <span style={{ color: 'var(--ink-3)' }}>(optional)</span>
          </label>
          <select
            value={form.categoryId}
            onChange={set('categoryId')}
            style={{
              width: '100%',
              height: 34,
              padding: '0 8px',
              fontSize: 13,
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
              color: 'var(--ink)',
              fontFamily: 'inherit',
            }}
          >
            <option value="">— No category —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <TextArea
          id="part-desc"
          label={t('common.description')}
          rows={2}
          value={form.description}
          onChange={set('description')}
          placeholder="Optional details..."
        />
        <div className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-md">
          After creating the part you can configure stock levels (min / reorder / max) per location.
        </div>
      </div>
    </Modal>
  );
}
