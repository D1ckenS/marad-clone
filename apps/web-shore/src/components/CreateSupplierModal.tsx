import { useState } from 'react';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY = {
  name: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
  country: '',
};

export function CreateSupplierModal({ open, onClose, onCreated }: Props) {
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
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/suppliers', {
        name: form.name.trim(),
        contactName: form.contactName.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        address: form.address.trim() || undefined,
        country: form.country.trim() || undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create supplier.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="New Supplier"
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            Create Supplier
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}
        <Input
          id="sup-name"
          label="Company name *"
          value={form.name}
          onChange={set('name')}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="sup-contact"
            label="Contact person"
            value={form.contactName}
            onChange={set('contactName')}
          />
          <Input
            id="sup-email"
            label="Email"
            type="email"
            value={form.contactEmail}
            onChange={set('contactEmail')}
          />
          <Input
            id="sup-phone"
            label="Phone"
            value={form.contactPhone}
            onChange={set('contactPhone')}
          />
          <Input
            id="sup-country"
            label="Country"
            value={form.country}
            onChange={set('country')}
            placeholder="NL"
          />
        </div>
        <TextArea
          id="sup-addr"
          label="Address"
          rows={2}
          value={form.address}
          onChange={set('address')}
        />
      </div>
    </Modal>
  );
}
