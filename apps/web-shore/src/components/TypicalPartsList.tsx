/**
 * Reusable part-list editor used in both CreateJobModal and EditJobModal.
 * Renders a list of { partId, partName, typicalQuantity, unit } entries
 * with add/remove controls and a part picker.
 */
import { useEffect, useState } from 'react';
import { Button, Input, Select } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

export interface TypicalPart {
  partId: string;
  partName: string;
  typicalQuantity: string;
  unit: string;
}

interface PartOption {
  id: string;
  name: string;
  unit: string;
}

interface Props {
  value: TypicalPart[];
  onChange: (parts: TypicalPart[]) => void;
}

export function TypicalPartsList({ value, onChange }: Props) {
  const [parts, setParts] = useState<PartOption[]>([]);
  const [addingPartId, setAddingPartId] = useState('');
  const [addingQty, setAddingQty] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    api
      .get<PartOption[]>('/parts')
      .then(setParts)
      .catch(() => undefined);
  }, []);

  const selectedPart = parts.find((p) => p.id === addingPartId);

  const handleAdd = () => {
    if (!addingPartId || !addingQty || parseFloat(addingQty) <= 0) return;
    if (value.some((v) => v.partId === addingPartId)) return; // no duplicates
    onChange([
      ...value,
      {
        partId: addingPartId,
        partName: selectedPart?.name ?? addingPartId,
        typicalQuantity: addingQty,
        unit: selectedPart?.unit ?? '',
      },
    ]);
    setAddingPartId('');
    setAddingQty('');
    setShowAdd(false);
  };

  const remove = (partId: string) => onChange(value.filter((v) => v.partId !== partId));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">Typical parts used</span>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="text-xs text-blue-600 hover:underline"
        >
          {showAdd ? 'Cancel' : '+ Add part'}
        </button>
      </div>

      {value.length === 0 && !showAdd && (
        <p className="text-xs text-slate-400 italic">
          No parts defined. These pre-fill the sign-off form.
        </p>
      )}

      {value.map((p) => (
        <div key={p.partId} className="flex items-center gap-2 py-1 text-sm">
          <span className="flex-1 text-slate-700">{p.partName}</span>
          <span className="text-slate-500 tabular-nums">
            {p.typicalQuantity} {p.unit}
          </span>
          <button
            type="button"
            onClick={() => remove(p.partId)}
            className="text-slate-300 hover:text-red-500 transition-colors text-xs"
          >
            ✕
          </button>
        </div>
      ))}

      {showAdd && (
        <div className="mt-2 flex items-end gap-2 bg-slate-50 p-2 rounded-md">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Part</label>
            <Select
              value={addingPartId}
              onChange={setAddingPartId}
              options={parts.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="— Select —"
            />
          </div>
          <div className="w-24">
            <label className="block text-xs text-slate-500 mb-1">
              Qty {selectedPart?.unit ? `(${selectedPart.unit})` : ''}
            </label>
            <Input
              id="tpl-qty"
              value={addingQty}
              type="number"
              min="0.01"
              step="0.01"
              onChange={(e) => setAddingQty(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!addingPartId || !addingQty}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

export function partsToJson(parts: TypicalPart[]): string | undefined {
  return parts.length > 0 ? JSON.stringify(parts) : undefined;
}

export function partsFromJson(json: string | null | undefined): TypicalPart[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as TypicalPart[];
  } catch {
    return [];
  }
}
