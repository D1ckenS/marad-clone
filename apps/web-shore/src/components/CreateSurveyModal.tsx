import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  vesselId: string;
  onClose: () => void;
  onCreated: () => void;
}

interface CertificateRow {
  id: string;
  number: string | null;
  certificateType: string | null;
}

const EMPTY = {
  scheduledAt: '',
  kind: '',
  scope: '',
  surveyor: '',
  location: '',
  status: 'SCHEDULED',
  certificateId: '',
  notes: '',
};

export function CreateSurveyModal({ open, vesselId, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);

  // M5: load vessel certificates so the operator can link the survey
  // to its triggering certificate (class-society renewal trail).
  useEffect(() => {
    if (!open || !vesselId) return;
    let cancelled = false;
    api
      .get<CertificateRow[]>(`/certificates?vesselId=${vesselId}`)
      .then((rows) => {
        if (!cancelled) setCertificates(rows);
      })
      .catch(() => {
        if (!cancelled) setCertificates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, vesselId]);

  const certificateOptions = useMemo(
    () => [
      { value: '', label: t('certificates.survey_modal.no_certificate') },
      ...certificates.map((c) => ({
        value: c.id,
        label: c.number ? `${c.certificateType ?? '—'} · ${c.number}` : (c.certificateType ?? c.id),
      })),
    ],
    [certificates, t],
  );

  const statusOptions = useMemo(
    () => [
      { value: 'SCHEDULED', label: t('certificates.survey_modal.status_scheduled') },
      { value: 'IN_PROGRESS', label: t('certificates.survey_modal.status_in_progress') },
      { value: 'COMPLETED', label: t('certificates.survey_modal.status_completed') },
      { value: 'POSTPONED', label: t('certificates.survey_modal.status_postponed') },
      { value: 'CANCELLED', label: t('certificates.survey_modal.status_cancelled') },
    ],
    [t],
  );

  const set =
    (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleClose = () => {
    setForm(EMPTY);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (
      !form.scheduledAt ||
      !form.kind.trim() ||
      !form.scope.trim() ||
      !form.surveyor.trim() ||
      !form.location.trim()
    ) {
      setError(t('certificates.survey_modal.error_required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/surveys', {
        vesselId,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        kind: form.kind.trim(),
        scope: form.scope.trim(),
        surveyor: form.surveyor.trim(),
        location: form.location.trim(),
        status: form.status,
        certificateId: form.certificateId || undefined,
        notes: form.notes.trim() || undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('certificates.survey_modal.error_create'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('certificates.survey_modal.title_create')}
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
          id="sv-scheduled"
          label={`${t('certificates.survey_modal.field_scheduled_at')} *`}
          type="datetime-local"
          value={form.scheduledAt}
          onChange={set('scheduledAt')}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="sv-kind"
            label={`${t('certificates.survey_modal.field_kind')} *`}
            value={form.kind}
            onChange={set('kind')}
            placeholder="Annual / Intermediate / Renewal"
          />
          <Input
            id="sv-scope"
            label={`${t('certificates.survey_modal.field_scope')} *`}
            value={form.scope}
            onChange={set('scope')}
            placeholder="Hull / Machinery / Class"
          />
          <Input
            id="sv-surveyor"
            label={`${t('certificates.survey_modal.field_surveyor')} *`}
            value={form.surveyor}
            onChange={set('surveyor')}
            placeholder="DNV / ABS / LR"
          />
          <Input
            id="sv-location"
            label={`${t('certificates.survey_modal.field_location')} *`}
            value={form.location}
            onChange={set('location')}
            placeholder="Port / yard"
          />
        </div>
        <Select
          id="sv-status"
          label={t('certificates.survey_modal.field_status')}
          options={statusOptions}
          value={form.status}
          onChange={(v) => setForm((f) => ({ ...f, status: v }))}
        />
        <Select
          id="sv-certificate"
          label={t('certificates.survey_modal.field_certificate')}
          options={certificateOptions}
          value={form.certificateId}
          onChange={(v) => setForm((f) => ({ ...f, certificateId: v }))}
        />
        <TextArea
          id="sv-notes"
          label={t('certificates.survey_modal.field_notes')}
          rows={2}
          value={form.notes}
          onChange={set('notes')}
        />
      </div>
    </Modal>
  );
}
