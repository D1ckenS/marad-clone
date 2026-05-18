import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Spinner, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Supplier {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  requisitionId: string;
  requisitionTitle: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreatePurchaseOrderModal({
  open,
  requisitionId,
  requisitionTitle,
  onClose,
  onCreated,
}: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(requisitionTitle);
    setSupplierId('');
    setNotes('');
    setExpectedDelivery('');
    setError(null);
    setLoadingSuppliers(true);
    api
      .get<Supplier[]>('/suppliers')
      .then(setSuppliers)
      .catch(() => setError('Could not load suppliers.'))
      .finally(() => setLoadingSuppliers(false));
  }, [open, requisitionTitle]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/purchase-orders', {
        title: title.trim(),
        requisitionId,
        supplierId: supplierId || undefined,
        notes: notes.trim() || undefined,
        expectedDeliveryAt: expectedDelivery || undefined,
      });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create PO.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Create Purchase Order"
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            Create PO
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}

        <div className="text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-md">
          From requisition: <span className="font-medium">{requisitionTitle}</span>
        </div>

        <Input
          id="po-title"
          label="PO Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="po-supplier">
            Supplier
          </label>
          {loadingSuppliers ? (
            <Spinner />
          ) : (
            <Select
              value={supplierId}
              onChange={setSupplierId}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              placeholder="— Assign later —"
            />
          )}
          {suppliers.length === 0 && !loadingSuppliers && (
            <p className="mt-1 text-xs text-amber-600">
              No suppliers yet — create one in the Suppliers tab first, or assign after creating the
              PO.
            </p>
          )}
        </div>

        <Input
          id="po-delivery"
          label="Expected delivery"
          type="date"
          value={expectedDelivery}
          onChange={(e) => setExpectedDelivery(e.target.value)}
        />

        <TextArea
          id="po-notes"
          label="Notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
}
