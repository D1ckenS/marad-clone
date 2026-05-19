import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select, Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Job {
  id: string;
  title: string;
  componentId: string;
  intervalDays: number | null;
  intervalRunningHours: string | null;
}

interface Props {
  open: boolean;
  /** Pre-filled when coming from "Add Job" → immediately create an instance. */
  jobId?: string | null;
  componentId?: string | null;
  onClose: () => void;
  onCreated: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

export function CreateJobInstanceModal({ open, jobId, componentId, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(jobId ?? '');
  const [dueAt, setDueAt] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load job list when no jobId is pre-supplied.
  useEffect(() => {
    if (!open) return;
    setSelectedJobId(jobId ?? '');
    setDueAt(today());
    setError(null);
    if (!jobId) {
      setLoadingJobs(true);
      api
        .get<Job[]>('/jobs')
        .then(setJobs)
        .catch(() => setError('Could not load jobs.'))
        .finally(() => setLoadingJobs(false));
    }
  }, [open, jobId]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedJobId) {
      setError('Select a job.');
      return;
    }
    const resolvedJob = jobs.find((j) => j.id === selectedJobId);
    const resolvedComponentId = componentId ?? resolvedJob?.componentId;
    if (!resolvedComponentId) {
      setError('Could not determine component.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.post('/job-instances', {
        jobId: selectedJobId,
        componentId: resolvedComponentId,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create job instance.');
    } finally {
      setSaving(false);
    }
  };

  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const intervalLabel = selectedJob
    ? selectedJob.intervalDays
      ? `Every ${selectedJob.intervalDays} days`
      : `Every ${selectedJob.intervalRunningHours} h`
    : null;

  return (
    <Modal
      open={open}
      title="Schedule Job Instance"
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            {t('maintenance.new_instance')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}

        {/* Job selector — hidden when jobId is pre-supplied */}
        {!jobId && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="ji-job">
              Job *
            </label>
            {loadingJobs ? (
              <div className="py-2">
                <Spinner />
              </div>
            ) : (
              <Select
                value={selectedJobId}
                onChange={setSelectedJobId}
                options={jobs.map((j) => ({ value: j.id, label: j.title }))}
                placeholder="— Select a job —"
              />
            )}
            {intervalLabel && <p className="mt-1 text-xs text-slate-500">{intervalLabel}</p>}
          </div>
        )}

        {jobId && (
          <div className="text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-md">
            Scheduling a new instance for the job just created.
          </div>
        )}

        <Input
          id="ji-due"
          label="Due date"
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
      </div>
    </Modal>
  );
}
