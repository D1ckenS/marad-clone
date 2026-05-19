import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Binding {
  id: string;
  barcode: string;
  partId: string;
}

interface Props {
  open: boolean;
  partId: string;
  partName: string;
  onClose: () => void;
}

export function ManageBarcodesModal({ open, partId, partName, onClose }: Props) {
  const { t } = useTranslation();
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [loading, setLoading] = useState(false);
  const [newBarcode, setNewBarcode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .get<Binding[]>(`/barcode-bindings?partId=${partId}`)
      .then(setBindings)
      .catch(() => setError('Could not load barcodes.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) {
      setNewBarcode('');
      setError(null);
      load();
    }
  }, [open]);

  const handleAdd = async () => {
    const val = newBarcode.trim();
    if (!val) {
      setError('Enter a barcode value.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/barcode-bindings', { partId, barcode: val });
      setNewBarcode('');
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to bind barcode.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/barcode-bindings/${id}`);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove binding.');
    }
  };

  return (
    <Modal
      open={open}
      title={`Barcodes — ${partName}`}
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}

        {loading ? (
          <div className="py-4 flex justify-center">
            <Spinner />
          </div>
        ) : bindings.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No barcodes bound yet.</p>
        ) : (
          <div className="space-y-1">
            {bindings.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0"
              >
                <span className="flex-1 font-mono text-sm text-slate-700">{b.barcode}</span>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500 mb-2">
            Bind a new barcode (scan the physical label or type the value):
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="bc-new"
                label=""
                value={newBarcode}
                onChange={(e) => setNewBarcode(e.target.value)}
                placeholder="e.g. OIL-001-BIN-A"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                }}
              />
            </div>
            <div className="pt-0.5">
              <Button loading={saving} onClick={handleAdd} disabled={!newBarcode.trim()}>
                Bind
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
