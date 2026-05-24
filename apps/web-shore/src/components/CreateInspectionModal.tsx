import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  vesselId: string;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY = {
  inspectedAt: '',
  kind: 'PSC',
  mou: '',
  port: '',
  inspector: '',
  deficiencies: '0',
  detained: false,
  status: 'Open',
  findings: '',
};

export function CreateInspectionModal({ open, vesselId, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kindOptions = useMemo(
    () => [
      { value: 'PSC', label: t('certificates.inspection_modal.kind_psc') },
      { value: 'VETTING', label: t('certificates.inspection_modal.kind_vetting') },
      { value: 'FLAG', label: t('certificates.inspection_modal.kind_flag') },
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
    if (!form.inspectedAt || !form.port.trim() || !form.inspector.trim() || !form.status.trim()) {
      setError(t('certificates.inspection_modal.error_required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/inspections', {
        vesselId,
        inspectedAt: new Date(form.inspectedAt).toISOString(),
        kind: form.kind,
        mou: form.mou.trim() || undefined,
        port: form.port.trim(),
        inspector: form.inspector.trim(),
        deficiencies: Number(form.deficiencies) || 0,
        detained: form.detained,
        status: form.status.trim(),
        findings: form.findings.trim() || undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('certificates.inspection_modal.error_create'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('certificates.inspection_modal.title_create')}
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
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="ins-when"
            label={`${t('certificates.inspection_modal.field_inspected_at')} *`}
            type="datetime-local"
            value={form.inspectedAt}
            onChange={set('inspectedAt')}
            autoFocus
          />
          <Select
            id="ins-kind"
            label={t('certificates.inspection_modal.field_kind')}
            options={kindOptions}
            value={form.kind}
            onChange={(v) => setForm((f) => ({ ...f, kind: v }))}
          />
          <Input
            id="ins-port"
            label={`${t('certificates.inspection_modal.field_port')} *`}
            value={form.port}
            onChange={set('port')}
            placeholder="Singapore"
          />
          <Input
            id="ins-inspector"
            label={`${t('certificates.inspection_modal.field_inspector')} *`}
            value={form.inspector}
            onChange={set('inspector')}
            placeholder="MPA / USCG / ABS"
          />
          <Input
            id="ins-mou"
            label={t('certificates.inspection_modal.field_mou')}
            value={form.mou}
            onChange={set('mou')}
            placeholder="Tokyo / Paris"
          />
          <Input
            id="ins-status"
            label={`${t('certificates.inspection_modal.field_status')} *`}
            value={form.status}
            onChange={set('status')}
            placeholder="Open / Closed"
          />
          <Input
            id="ins-def"
            label={t('certificates.inspection_modal.field_deficiencies')}
            type="number"
            min="0"
            value={form.deficiencies}
            onChange={set('deficiencies')}
          />
          <label className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink-2)' }}>
            <input
              type="checkbox"
              checked={form.detained}
              onChange={(e) => setForm((f) => ({ ...f, detained: e.target.checked }))}
            />
            {t('certificates.inspection_modal.field_detained')}
          </label>
        </div>
        <TextArea
          id="ins-findings"
          label={t('certificates.inspection_modal.field_findings')}
          rows={3}
          value={form.findings}
          onChange={set('findings')}
        />
      </div>
    </Modal>
  );
}
