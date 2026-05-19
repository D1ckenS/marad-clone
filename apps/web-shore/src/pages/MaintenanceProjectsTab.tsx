import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

const STATUS_COLOR: Record<string, { bg: string; text: string; labelKey: string }> = {
  PLANNING: { bg: '#F4F2EC', text: '#0A1F33', labelKey: 'maintenance.project_status_planning' },
  ACTIVE: { bg: '#D1FAE5', text: '#2F7D4F', labelKey: 'maintenance.project_status_active' },
  ON_HOLD: { bg: '#FEF3C7', text: '#B5731E', labelKey: 'maintenance.project_status_on_hold' },
  COMPLETED: { bg: '#DBEAFE', text: '#1F5B9D', labelKey: 'maintenance.project_status_completed' },
  CANCELLED: { bg: '#FEE2E2', text: '#AB382E', labelKey: 'maintenance.project_status_cancelled' },
};

const TASK_COLOR: Record<string, { bg: string; border: string }> = {
  TODO: { bg: '#E5E3DA', border: '#C8C6BE' },
  IN_PROGRESS: { bg: '#BFDBFE', border: '#1F5B9D' },
  DONE: { bg: '#BBF7D0', border: '#2F7D4F' },
  BLOCKED: { bg: '#FECACA', border: '#AB382E' },
};

interface ProjectTask {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  plannedDays: number | null;
  predecessorId: string | null;
  assignedToRole: string | null;
  description: string | null;
}

interface Project {
  id: string;
  vesselId: string;
  title: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  tasks: ProjectTask[];
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function GanttBar({
  task,
  ganttStart,
  totalDays,
}: {
  task: ProjectTask;
  ganttStart: Date;
  totalDays: number;
}) {
  const start = parseDate(task.startDate);
  const end = parseDate(task.endDate);
  if (!start || !end || totalDays === 0) return <div style={{ height: 20 }} />;

  const leftPct = (daysBetween(ganttStart, start) / totalDays) * 100;
  const widthPct = Math.max(1, (daysBetween(start, end) / totalDays) * 100);
  const colors = TASK_COLOR[task.status] ?? TASK_COLOR['TODO']!;

  return (
    <div style={{ position: 'relative', height: 20, flex: 1 }}>
      <div
        style={{
          position: 'absolute',
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          height: '100%',
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: 3,
          fontSize: 10,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 4,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
          color: '#0A1F33',
        }}
        title={task.title}
      >
        {task.title}
      </div>
    </div>
  );
}

function CreateProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/projects', {
        title: title.trim(),
        description: description || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,31,51,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 8px 40px rgba(10,31,51,0.12)',
          width: 480,
          padding: 28,
        }}
      >
        <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0A1F33' }}>
          New Project
        </h2>
        {error && <div style={{ color: '#AB382E', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#0A1F33',
                display: 'block',
                marginBottom: 4,
              }}
            >
              Title *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                border: '1px solid #E5E3DA',
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 13,
                boxSizing: 'border-box',
              }}
              placeholder="e.g. Annual Dry Dock 2026"
            />
          </div>
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#0A1F33',
                display: 'block',
                marginBottom: 4,
              }}
            >
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              style={{
                width: '100%',
                border: '1px solid #E5E3DA',
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 13,
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#0A1F33',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #E5E3DA',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#0A1F33',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #E5E3DA',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #E5E3DA',
              borderRadius: 6,
              background: '#fff',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Cancel
          </button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Create Project'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddTaskModal({
  open,
  projectId,
  onClose,
  onCreated,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [plannedDays, setPlannedDays] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTitle('');
      setStartDate('');
      setEndDate('');
      setPlannedDays('');
      setRole('');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/projects/${projectId}/tasks`, {
        title: title.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        plannedDays: plannedDays ? parseInt(plannedDays) : undefined,
        assignedToRole: role || undefined,
      });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,31,51,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 8px 40px rgba(10,31,51,0.12)',
          width: 460,
          padding: 28,
        }}
      >
        <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0A1F33' }}>
          Add Task
        </h2>
        {error && <div style={{ color: '#AB382E', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#0A1F33',
                display: 'block',
                marginBottom: 4,
              }}
            >
              Task Title *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                border: '1px solid #E5E3DA',
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 13,
                boxSizing: 'border-box',
              }}
              placeholder="e.g. Hull cleaning"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#0A1F33',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Start
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #E5E3DA',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#0A1F33',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                End
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #E5E3DA',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#0A1F33',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Planned days
              </label>
              <input
                type="number"
                min={1}
                value={plannedDays}
                onChange={(e) => setPlannedDays(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #E5E3DA',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
                placeholder="e.g. 5"
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#0A1F33',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Assigned role
              </label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #E5E3DA',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
                placeholder="e.g. CHIEF_ENGINEER"
              />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #E5E3DA',
              borderRadius: 6,
              background: '#fff',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Cancel
          </button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Add Task'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onAddTask,
  onStatusChange,
  onDelete,
}: {
  project: Project;
  onAddTask: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const statusStyle = STATUS_COLOR[project.status] ?? STATUS_COLOR['PLANNING']!;

  const allDates = project.tasks
    .flatMap((t) => [parseDate(t.startDate), parseDate(t.endDate)])
    .filter(Boolean) as Date[];
  if (parseDate(project.startDate)) allDates.push(parseDate(project.startDate)!);
  if (parseDate(project.endDate)) allDates.push(parseDate(project.endDate)!);
  const ganttStart =
    allDates.length > 0 ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : new Date();
  const ganttEnd =
    allDates.length > 0
      ? new Date(Math.max(...allDates.map((d) => d.getTime())))
      : new Date(ganttStart.getTime() + 30 * 86400000);
  const totalDays = Math.max(1, daysBetween(ganttStart, ganttEnd));

  return (
    <div
      style={{
        border: '1px solid #E5E3DA',
        borderRadius: 10,
        marginBottom: 16,
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: '#F4F2EC',
          borderBottom: '1px solid #E5E3DA',
        }}
      >
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            color: '#8893A0',
            padding: 0,
          }}
        >
          {expanded ? '▾' : '▸'}
        </button>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#0A1F33', flex: 1 }}>
          {project.title}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 10,
            background: statusStyle.bg,
            color: statusStyle.text,
          }}
        >
          {t(statusStyle.labelKey)}
        </span>
        {project.startDate && (
          <span style={{ fontSize: 12, color: '#8893A0' }}>
            {project.startDate}
            {project.endDate ? ` → ${project.endDate}` : ''}
          </span>
        )}
        <button
          onClick={() => onAddTask(project.id)}
          style={{
            fontSize: 12,
            padding: '4px 10px',
            border: '1px solid #E5E3DA',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
            color: '#0A1F33',
          }}
        >
          + Task
        </button>
        <select
          value={project.status}
          onChange={(e) => onStatusChange(project.id, e.target.value)}
          style={{
            fontSize: 12,
            border: '1px solid #E5E3DA',
            borderRadius: 6,
            padding: '4px 8px',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          {Object.entries(STATUS_COLOR).map(([k, v]) => (
            <option key={k} value={k}>
              {t(v.labelKey)}
            </option>
          ))}
        </select>
        <button
          onClick={() => onDelete(project.id)}
          style={{
            fontSize: 12,
            padding: '4px 8px',
            border: '1px solid #FECACA',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
            color: '#AB382E',
          }}
        >
          Delete
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '12px 16px' }}>
          {project.tasks.length === 0 ? (
            <div style={{ color: '#8893A0', fontSize: 13, padding: '8px 0' }}>
              No tasks yet. Click "+ Task" to add one.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #EEEBE2' }}>
                  <th
                    style={{
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#8893A0',
                      padding: '4px 8px 4px 0',
                      width: 220,
                    }}
                  >
                    Task
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#8893A0',
                      padding: '4px 8px',
                      width: 80,
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#8893A0',
                      padding: '4px 8px',
                      width: 80,
                    }}
                  >
                    Days
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#8893A0',
                      padding: '4px 8px',
                      width: 80,
                    }}
                  >
                    Role
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#8893A0',
                      padding: '4px 4px 4px 8px',
                    }}
                  >
                    Timeline
                  </th>
                </tr>
              </thead>
              <tbody>
                {project.tasks.map((task) => {
                  const tc = TASK_COLOR[task.status] ?? TASK_COLOR['TODO']!;
                  return (
                    <tr key={task.id} style={{ borderBottom: '1px solid #EEEBE2' }}>
                      <td style={{ padding: '6px 8px 6px 0', fontSize: 13, color: '#0A1F33' }}>
                        {task.title}
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 8,
                            background: tc.bg,
                            border: `1px solid ${tc.border}`,
                            color: '#0A1F33',
                          }}
                        >
                          {task.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', fontSize: 12, color: '#8893A0' }}>
                        {task.plannedDays ? `${task.plannedDays}d` : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', fontSize: 12, color: '#8893A0' }}>
                        {task.assignedToRole ?? '—'}
                      </td>
                      <td style={{ padding: '6px 4px 6px 8px' }}>
                        <GanttBar task={task} ganttStart={ganttStart} totalDays={totalDays} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export function MaintenanceProjectsTab() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [addTaskFor, setAddTaskFor] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Project[]>('/projects')
      .then(setProjects)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.patch(`/projects/${id}`, { status });
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project and all its tasks?')) return;
    try {
      await api.delete(`/projects/${id}`);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const statusCounts = Object.keys(STATUS_COLOR).reduce<Record<string, number>>((acc, k) => {
    acc[k] = projects.filter((p) => p.status === k).length;
    return acc;
  }, {});

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', gap: 16 }}>
          {Object.entries(STATUS_COLOR).map(([k, v]) => (
            <div key={k} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0A1F33' }}>
                {statusCounts[k] ?? 0}
              </div>
              <div style={{ fontSize: 11, color: '#8893A0' }}>{t(v.labelKey)}</div>
            </div>
          ))}
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Project</Button>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
        </div>
      )}
      {error && <div style={{ color: '#AB382E', fontSize: 13, padding: 16 }}>{error}</div>}
      {!loading && !error && projects.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#8893A0', fontSize: 13 }}>
          No projects yet.{' '}
          <button
            onClick={() => setShowCreate(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#1F5B9D',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: 13,
            }}
          >
            Create the first project.
          </button>
        </div>
      )}
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onAddTask={setAddTaskFor}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      ))}

      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          load();
        }}
      />
      <AddTaskModal
        open={addTaskFor !== null}
        projectId={addTaskFor ?? ''}
        onClose={() => setAddTaskFor(null)}
        onCreated={() => {
          setAddTaskFor(null);
          load();
        }}
      />
    </div>
  );
}
