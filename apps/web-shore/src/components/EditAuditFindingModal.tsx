import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface AuditFindingEditable {
  id: string;
  auditId: string | null;
  classification: string;
  smsRef: string | null;
  title: string;
  detail: string | null;
  owner: string | null;
  openedAt: string;
  dueAt: string | null;
}

interface Props {
  finding: AuditFindingEditable;
  onClose: () => void;
  onSaved: () => void;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function EditAuditFindingModal({ finding, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    auditId: finding.auditId ?? '',
    classification: finding.classification,
    smsRef: finding.smsRef ?? '',
    title: finding.title,
    detail: finding.detail ?? '',
    owner: finding.owner ?? '',
    openedAt: toLocalInput(finding.openedAt),
    dueAt: toLocalInput(finding.dueAt),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      auditId: finding.auditId ?? '',
      classification: finding.classification,
      smsRef: finding.smsRef ?? '',
      title: finding.title,
      detail: finding.detail ?? '',
      owner: finding.owner ?? '',
      openedAt: toLocalInput(finding.openedAt),
      dueAt: toLocalInput(finding.dueAt),
    });
    setError(null);
  }, [finding]);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.classification.trim() || !form.title.trim() || !form.openedAt) {
      setError(t('qhse.finding_modal.error_required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/audit-findings/${finding.id}`, {
        auditId: form.auditId.trim() || null,
        classification: form.classification.trim(),
        smsRef: form.smsRef.trim() || null,
        title: form.title.trim(),
        detail: form.detail.trim() || null,
        owner: form.owner.trim() || null,
        openedAt: new Date(form.openedAt).toISOString(),
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('qhse.finding_modal.error_update'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={t('qhse.finding_modal.title_edit')}
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
        <Input
          id="af-class"
          label={`${t('qhse.finding_modal.field_classification')} *`}
          value={form.classification}
          onChange={set('classification')}
          autoFocus
        />
        <Input
          id="af-title"
          label={`${t('qhse.finding_modal.field_title')} *`}
          value={form.title}
          onChange={set('title')}
        />
        <TextArea
          id="af-detail"
          label={t('qhse.finding_modal.field_detail')}
          rows={3}
          value={form.detail}
          onChange={set('detail')}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="af-audit"
            label={t('qhse.finding_modal.field_audit_id')}
            value={form.auditId}
            onChange={set('auditId')}
          />
          <Input
            id="af-sms"
            label={t('qhse.finding_modal.field_sms_ref')}
            value={form.smsRef}
            onChange={set('smsRef')}
          />
          <Input
            id="af-owner"
            label={t('qhse.finding_modal.field_owner')}
            value={form.owner}
            onChange={set('owner')}
          />
          <Input
            id="af-opened"
            label={`${t('qhse.finding_modal.field_opened_at')} *`}
            type="datetime-local"
            value={form.openedAt}
            onChange={set('openedAt')}
          />
          <Input
            id="af-due"
            label={t('qhse.finding_modal.field_due_at')}
            type="datetime-local"
            value={form.dueAt}
            onChange={set('dueAt')}
          />
        </div>
      </div>
    </Modal>
  );
}
