import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, type BadgeColor, Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { CreatePartModal } from '../components/CreatePartModal.js';
import { AddStockLevelModal } from '../components/AddStockLevelModal.js';
import { PostStockMovementModal } from '../components/PostStockMovementModal.js';

interface StockLevelSummary {
  id: string;
  locationId: string;
  locationName: string;
  minStock: string;
  maxStock: string | null;
  reorderPoint: string | null;
  rob: string;
  status: 'green' | 'amber' | 'red' | 'purple';
}

interface PartSummary {
  id: string;
  name: string;
  partNumber: string | null;
  unit: string;
  stockLevels: StockLevelSummary[];
}

const STATUS_COLOR: Record<StockLevelSummary['status'], BadgeColor> = {
  green: 'green',
  amber: 'amber',
  red: 'red',
  purple: 'purple',
};
const STATUS_LABEL: Record<StockLevelSummary['status'], string> = {
  green: 'OK',
  amber: 'Reorder',
  red: 'Low',
  purple: 'Out',
};

type ActiveModal =
  | { kind: 'none' }
  | { kind: 'stockLevel'; partId: string; partName: string }
  | { kind: 'movement'; partId: string; partName: string };

function StockChip({ level }: { level: StockLevelSummary }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Badge color={STATUS_COLOR[level.status]}>{STATUS_LABEL[level.status]}</Badge>
      <span className="text-slate-600 font-mono">{parseFloat(level.rob).toFixed(2)}</span>
      <span className="text-slate-400">{level.locationName}</span>
    </div>
  );
}

function PartRow({
  part,
  onStockLevel,
  onMovement,
}: {
  part: PartSummary;
  onStockLevel: (partId: string, partName: string) => void;
  onMovement: (partId: string, partName: string) => void;
}) {
  const worstStatus = (['purple', 'red', 'amber', 'green'] as const).find((s) =>
    part.stockLevels.some((l) => l.status === s),
  );

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50 group">
      <td className="py-3 px-4">
        <div className="font-medium text-slate-800 text-sm">{part.name}</div>
        {part.partNumber && (
          <div className="text-xs text-slate-400 font-mono mt-0.5">{part.partNumber}</div>
        )}
      </td>
      <td className="py-3 px-4 text-xs text-slate-500">{part.unit}</td>
      <td className="py-3 px-4">
        {part.stockLevels.length === 0 ? (
          <button
            onClick={() => onStockLevel(part.id, part.name)}
            className="text-xs text-blue-600 hover:underline italic"
          >
            Configure stock levels →
          </button>
        ) : (
          <div className="space-y-1">
            {part.stockLevels.map((l) => (
              <StockChip key={l.id} level={l} />
            ))}
          </div>
        )}
      </td>
      <td className="py-3 px-4">
        {worstStatus && (
          <Badge color={STATUS_COLOR[worstStatus]}>{STATUS_LABEL[worstStatus]}</Badge>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="hidden group-hover:flex justify-end gap-1">
          <button
            onClick={() => onStockLevel(part.id, part.name)}
            className="text-xs px-2 py-0.5 rounded border border-slate-300 text-slate-600 hover:border-slate-500 hover:text-slate-800 transition-colors"
            title="Add / edit stock level config"
          >
            Stock config
          </button>
          <button
            onClick={() => onMovement(part.id, part.name)}
            className="text-xs px-2 py-0.5 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
            title="Post a receipt, consumption, or adjustment"
          >
            Post movement
          </button>
        </div>
      </td>
    </tr>
  );
}

export function InventoryPage() {
  const [parts, setParts] = useState<PartSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [createPartOpen, setCreatePartOpen] = useState(false);
  const [modal, setModal] = useState<ActiveModal>({ kind: 'none' });

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<PartSummary[]>('/parts/inventory-summary')
      .then(setParts)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeModal = () => setModal({ kind: 'none' });

  const visible = parts.filter((p) => {
    if (filter === 'out') return p.stockLevels.some((l) => l.status === 'purple');
    if (filter === 'low')
      return p.stockLevels.some((l) => l.status === 'red' || l.status === 'amber');
    return true;
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Spare parts &amp; stock levels for this vessel
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'low', 'out'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f === 'all' ? 'All' : f === 'low' ? 'Low / Reorder' : 'Out of stock'}
            </button>
          ))}
          <Button onClick={() => setCreatePartOpen(true)}>+ New Part</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && (
          <div className="p-8 flex justify-center">
            <Spinner />
          </div>
        )}
        {error && <div className="p-6 text-sm text-red-600">{error}</div>}
        {!loading && !error && visible.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm">
            {parts.length === 0 ? (
              <>
                No parts yet.{' '}
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => setCreatePartOpen(true)}
                >
                  Add the first one.
                </button>
              </>
            ) : (
              'No parts match the current filter.'
            )}
          </div>
        )}
        {!loading && !error && visible.length > 0 && (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="py-3 px-4">Part</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4">Stock by location</th>
                <th className="py-3 px-4">Overall</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <PartRow
                  key={p.id}
                  part={p}
                  onStockLevel={(id, name) =>
                    setModal({ kind: 'stockLevel', partId: id, partName: name })
                  }
                  onMovement={(id, name) =>
                    setModal({ kind: 'movement', partId: id, partName: name })
                  }
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex gap-4 text-xs text-slate-500">
        {(['green', 'amber', 'red', 'purple'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <Badge color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Badge>
            {
              {
                green: 'Above reorder',
                amber: 'Below reorder',
                red: 'Below minimum',
                purple: 'Zero / no config',
              }[s]
            }
          </span>
        ))}
      </div>

      {/* Modals */}
      <CreatePartModal
        open={createPartOpen}
        onClose={() => setCreatePartOpen(false)}
        onCreated={(partId, partName) => {
          setCreatePartOpen(false);
          // Jump straight to stock level config for the new part.
          setModal({ kind: 'stockLevel', partId, partName });
          load();
        }}
      />
      <AddStockLevelModal
        open={modal.kind === 'stockLevel'}
        partId={modal.kind === 'stockLevel' ? modal.partId : ''}
        partName={modal.kind === 'stockLevel' ? modal.partName : ''}
        onClose={closeModal}
        onSaved={() => {
          closeModal();
          load();
        }}
      />
      <PostStockMovementModal
        open={modal.kind === 'movement'}
        partId={modal.kind === 'movement' ? modal.partId : ''}
        partName={modal.kind === 'movement' ? modal.partName : ''}
        onClose={closeModal}
        onPosted={() => {
          closeModal();
          load();
        }}
      />
    </div>
  );
}
