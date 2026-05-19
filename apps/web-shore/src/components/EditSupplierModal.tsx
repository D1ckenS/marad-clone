import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface SupplierFull {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  country: string | null;
  isActive: boolean;
}

interface Props {
  supplier: SupplierFull;
  onClose: () => void;
  onSaved: () => void;
}

export function EditSupplierModal({ supplier, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: supplier.name,
    contactName: supplier.contactName ?? '',
    contactEmail: supplier.contactEmail ?? '',
    contactPhone: supplier.contactPhone ?? '',
    country: supplier.country ?? '',
    address: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      name: supplier.name,
      contactName: supplier.contactName ?? '',
      contactEmail: supplier.contactEmail ?? '',
      contactPhone: supplier.contactPhone ?? '',
      country: supplier.country ?? '',
      address: '',
    });
    setError(null);
  }, [supplier]);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/suppliers/${supplier.id}`, {
        name: form.name.trim(),
        contactName: form.contactName.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        address: form.address.trim() || undefined,
        country: form.country.trim() || undefined,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update supplier.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={t('common.edit')}
      onClose={onClose}
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
          <div
            className="text-sm bg-red-50 px-3 py-2 rounded-md"
            style={{ color: 'var(--sig-red)' }}
          >
            {error}
          </div>
        )}
        <Input
          id="sup-name"
          label={`${t('companies.company_name')} *`}
          value={form.name}
          onChange={set('name')}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="sup-contact"
            label={t('purchase.col_contact')}
            value={form.contactName}
            onChange={set('contactName')}
          />
          <Input
            id="sup-email"
            label={t('purchase.col_email')}
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
            label={t('purchase.col_country')}
            value={form.country}
            onChange={set('country')}
            placeholder="NL"
          />
        </div>
        <TextArea
          id="sup-addr"
          label={t('inventory.location')}
          rows={2}
          value={form.address}
          onChange={set('address')}
        />
      </div>
    </Modal>
  );
}
