import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface SurveyEditable {
  id: string;
  scheduledAt: string;
  kind: string;
  scope: string;
  surveyor: string;
  location: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED';
  notes?: string | null;
}

interface Props {
  survey: SurveyEditable;
  onClose: () => void;
  onSaved: () => void;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function EditSurveyModal({ survey, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    scheduledAt: toLocalInput(survey.scheduledAt),
    kind: survey.kind,
    scope: survey.scope,
    surveyor: survey.surveyor,
    location: survey.location,
    status: survey.status,
    notes: survey.notes ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    setForm({
      scheduledAt: toLocalInput(survey.scheduledAt),
      kind: survey.kind,
      scope: survey.scope,
      surveyor: survey.surveyor,
      location: survey.location,
      status: survey.status,
      notes: survey.notes ?? '',
    });
    setError(null);
  }, [survey]);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

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
      await api.patch(`/surveys/${survey.id}`, {
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        kind: form.kind.trim(),
        scope: form.scope.trim(),
        surveyor: form.surveyor.trim(),
        location: form.location.trim(),
        status: form.status,
        notes: form.notes.trim() || null,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('certificates.survey_modal.error_update'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={t('certificates.survey_modal.title_edit')}
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
          />
          <Input
            id="sv-scope"
            label={`${t('certificates.survey_modal.field_scope')} *`}
            value={form.scope}
            onChange={set('scope')}
          />
          <Input
            id="sv-surveyor"
            label={`${t('certificates.survey_modal.field_surveyor')} *`}
            value={form.surveyor}
            onChange={set('surveyor')}
          />
          <Input
            id="sv-location"
            label={`${t('certificates.survey_modal.field_location')} *`}
            value={form.location}
            onChange={set('location')}
          />
        </div>
        <Select
          id="sv-status"
          label={t('certificates.survey_modal.field_status')}
          options={statusOptions}
          value={form.status}
          onChange={(v) => setForm((f) => ({ ...f, status: v as typeof f.status }))}
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
