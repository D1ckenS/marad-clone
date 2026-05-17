import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Spinner } from '@fleetops/ui-kit';
import type { BadgeColor } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { SignOffModal } from '../components/SignOffModal.js';
import { CreateJobInstanceModal } from '../components/CreateJobInstanceModal.js';

interface JobInstance {
  id: string;
  jobId: string;
  componentId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'OVERDUE' | 'DEFERRED';
  dueAt: string | null;
  dueAtRunningHours: string | null;
  assignedToUserId: string | null;
}

const statusColor: Record<JobInstance['status'], BadgeColor> = {
  PENDING: 'slate',
  IN_PROGRESS: 'blue',
  DONE: 'green',
  OVERDUE: 'red',
  DEFERRED: 'amber',
};

const statusLabel: Record<JobInstance['status'], string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  OVERDUE: 'Overdue',
  DEFERRED: 'Deferred',
};

export function JobInstancesPage() {
  interface JobMeta {
    id: string;
    typicalPartsJson?: string | null;
  }
  const [instances, setInstances] = useState<JobInstance[]>([]);
  const [jobsById, setJobsById] = useState<Map<string, JobMeta>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signOffTarget, setSignOffTarget] = useState<{
    instanceId: string;
    typicalPartsJson?: string | null | undefined;
  } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this job instance?')) return;
    try {
      await api.delete(`/job-instances/${id}`);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get<JobInstance[]>('/job-instances'), api.get<JobMeta[]>('/jobs')])
      .then(([insts, jobs]) => {
        setInstances(insts);
        setJobsById(new Map(jobs.map((j) => [j.id, j])));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Job Instances</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Scheduled maintenance tasks for this vessel
          </p>
        </div>
        <Button onClick={() => setScheduleOpen(true)}>+ Schedule Job</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && (
          <div className="p-8">
            <Spinner />
          </div>
        )}
        {error && <div className="p-6 text-sm text-red-600">{error}</div>}
        {!loading && !error && instances.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm">
            No job instances found.{' '}
            <button className="text-blue-600 hover:underline" onClick={() => setScheduleOpen(true)}>
              Schedule the first one.
            </button>
          </div>
        )}
        {!loading && !error && instances.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Due date
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Due hours
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Job ID
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {instances.map((ji) => (
                <tr key={ji.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Badge color={statusColor[ji.status]}>{statusLabel[ji.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {ji.dueAt ? new Date(ji.dueAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {ji.dueAtRunningHours ? `${ji.dueAtRunningHours} h` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs truncate max-w-[10rem]">
                    {ji.jobId}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {ji.status !== 'DONE' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setSignOffTarget({
                              instanceId: ji.id,
                              typicalPartsJson: jobsById.get(ji.jobId)?.typicalPartsJson,
                            })
                          }
                        >
                          Sign Off
                        </Button>
                      )}
                      <button
                        onClick={() => handleDelete(ji.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors px-1"
                        title="Delete instance"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SignOffModal
        jobInstanceId={signOffTarget?.instanceId ?? null}
        typicalPartsJson={signOffTarget?.typicalPartsJson}
        onClose={() => setSignOffTarget(null)}
        onSuccess={() => {
          setSignOffTarget(null);
          load();
        }}
      />
      <CreateJobInstanceModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onCreated={() => {
          setScheduleOpen(false);
          load();
        }}
      />
    </div>
  );
}
