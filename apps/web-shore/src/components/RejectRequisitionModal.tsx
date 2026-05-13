import { useState } from 'react';
import { Button, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  requisitionId: string | null;
  onClose: () => void;
  onRejected: () => void;
}

export function RejectRequisitionModal({ requisitionId, onClose, onRejected }: Props) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setReason('');
    setError(null);
    onClose();
  };

  const handleReject = async () => {
    if (!requisitionId) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/requisitions/${requisitionId}/reject`, {
        reason: reason.trim() || undefined,
      });
      setReason('');
      onRejected();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Rejection failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={requisitionId !== null}
      title="Reject Requisition"
      onClose={handleClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" loading={saving} onClick={handleReject}>
            Reject
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}
        <TextArea
          id="reject-reason"
          label="Reason (optional)"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Provide a reason for rejection..."
          autoFocus
        />
      </div>
    </Modal>
  );
}
