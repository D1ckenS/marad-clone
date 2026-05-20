import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import type { Category } from './CreatePartModal.js';

export interface PartItem {
  id: string;
  name: string;
  partNumber: string | null;
  unit: string;
  description?: string | null;
  categoryId?: string | null;
}

interface Props {
  open: boolean;
  part: PartItem | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditPartModal({ open, part, categories, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!part) return;
    setName(part.name);
    setPartNumber(part.partNumber ?? '');
    setUnit(part.unit);
    setDescription(part.description ?? '');
    setCategoryId(part.categoryId ?? '');
    setError(null);
  }, [part]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!part) return;
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/parts/${part.id}`, {
        name: name.trim(),
        partNumber: partNumber.trim() || undefined,
        unit: unit.trim() || undefined,
        description: description.trim() || undefined,
        categoryId: categoryId || null,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('common.edit')}
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
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
        <Input
          id="ep-name"
          label={t('inventory.part_name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              id="ep-num"
              label={t('inventory.part_number')}
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
            />
          </div>
          <div className="w-28">
            <Input
              id="ep-unit"
              label={t('inventory.unit')}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="pcs / L / kg"
            />
          </div>
        </div>
        <div>
          <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
            Category <span style={{ color: 'var(--ink-3)' }}>(optional)</span>
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
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
          id="ep-desc"
          label={t('common.description')}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}
