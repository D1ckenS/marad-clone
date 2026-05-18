import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { CreateComponentModal } from '../components/CreateComponentModal.js';
import { EditComponentModal, type ComponentItem } from '../components/EditComponentModal.js';
import { CreateJobModal } from '../components/CreateJobModal.js';
import { EditJobModal, type Job } from '../components/EditJobModal.js';
import { CreateJobInstanceModal } from '../components/CreateJobInstanceModal.js';
import { LogRunningHoursModal } from '../components/LogRunningHoursModal.js';
import { JobInstancesPage } from './JobInstancesPage.js';
import { MaintenanceHistoryTab } from './MaintenanceHistoryTab.js';
import { MaintenanceTemplatesTab } from './MaintenanceTemplatesTab.js';
import { MaintenanceRunningHoursTab } from './MaintenanceRunningHoursTab.js';
import { MaintenanceProjectsTab } from './MaintenanceProjectsTab.js';

type MaintenanceTab =
  | 'components'
  | 'jobs'
  | 'history'
  | 'templates'
  | 'running-hours'
  | 'projects';

const TABS: { id: MaintenanceTab; label: string }[] = [
  { id: 'components', label: 'Components' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'history', label: 'History' },
  { id: 'templates', label: 'Templates' },
  { id: 'running-hours', label: 'Running Hours' },
  { id: 'projects', label: 'Projects' },
];

type Component = ComponentItem;

interface TreeNode extends Component {
  children: TreeNode[];
}

function buildTree(items: Component[]): TreeNode[] {
  const byId = new Map(items.map((c) => [c.id, { ...c, children: [] as TreeNode[] }]));
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: 'text-red-600 bg-red-50',
  HIGH: 'text-orange-600 bg-orange-50',
  NORMAL: 'text-slate-600 bg-slate-100',
  LOW: 'text-slate-400 bg-slate-50',
};

interface NodeActions {
  onAddChild: (parentId: string, parentName: string) => void;
  onAddJob: (componentId: string, componentName: string) => void;
  onEditJob: (job: Job, componentName: string) => void;
  onScheduleJob: (jobId: string, componentId: string) => void;
  onLogHours: (component: Component) => void;
  onEditComponent: (component: Component) => void;
  onDeleteComponent: (id: string, name: string) => void;
}

function JobRow({ job, actions }: { job: Job; actions: NodeActions }) {
  const intervalLabel = job.intervalDays
    ? `Every ${job.intervalDays} days`
    : `Every ${job.intervalRunningHours} h`;
  return (
    <div className="flex items-center gap-2 py-1.5 px-3 group text-xs hover:bg-slate-50 rounded">
      <span className="text-slate-400">└</span>
      <span className="flex-1 font-medium text-slate-700">{job.title}</span>
      <span className="text-slate-400">{intervalLabel}</span>
      <span
        className={`px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_COLOR[job.priority] ?? PRIORITY_COLOR.NORMAL}`}
      >
        {job.priority}
      </span>
      <div className="hidden group-hover:flex gap-1">
        <button
          onClick={() => actions.onScheduleJob(job.id, job.componentId)}
          className="px-2 py-0.5 rounded border border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          + Instance
        </button>
        <button
          onClick={() => actions.onEditJob(job, '')}
          className="px-2 py-0.5 rounded border border-slate-300 text-slate-600 hover:border-slate-500 hover:text-slate-800 transition-colors"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

function ComponentNode({
  node,
  depth,
  actions,
  jobsByComponentId,
}: {
  node: TreeNode;
  depth: number;
  actions: NodeActions;
  jobsByComponentId: Map<string, Job[]>;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const jobs = jobsByComponentId.get(node.id) ?? [];
  const hasContent = node.children.length > 0 || jobs.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-slate-100 group"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {hasContent ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-slate-400 hover:text-slate-700 w-4 text-xs leading-none"
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="text-sm font-medium text-slate-800 flex-1">{node.name}</span>
        {node.sfi && <Badge color="blue">{node.sfi}</Badge>}
        <span className="text-xs text-slate-400 tabular-nums">{node.runningHours} h</span>
        {jobs.length > 0 && (
          <span className="text-xs text-slate-400 tabular-nums">
            {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </span>
        )}
        <div className="hidden group-hover:flex items-center gap-1 ml-2">
          <button
            onClick={() => actions.onLogHours(node)}
            className="text-xs px-2 py-0.5 rounded border border-slate-300 text-slate-600 hover:border-green-400 hover:text-green-700 transition-colors"
          >
            Log h
          </button>
          <button
            onClick={() => actions.onAddJob(node.id, node.name)}
            className="text-xs px-2 py-0.5 rounded border border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            + Job
          </button>
          <button
            onClick={() => actions.onAddChild(node.id, node.name)}
            className="text-xs px-2 py-0.5 rounded border border-slate-300 text-slate-600 hover:border-slate-500 hover:text-slate-800 transition-colors"
          >
            + Child
          </button>
          <button
            onClick={() => actions.onEditComponent(node)}
            className="text-xs px-2 py-0.5 rounded border border-slate-300 text-slate-600 hover:border-slate-500 hover:text-slate-800 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => actions.onDeleteComponent(node.id, node.name)}
            className="text-xs px-2 py-0.5 rounded border border-red-200 text-red-400 hover:border-red-400 hover:text-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ paddingLeft: `${depth * 20 + 12}px` }}>
          {jobs.map((j) => (
            <JobRow
              key={j.id}
              job={j}
              actions={{ ...actions, onEditJob: (job) => actions.onEditJob(job, node.name) }}
            />
          ))}
          {node.children.map((child) => (
            <ComponentNode
              key={child.id}
              node={child}
              depth={depth + 1}
              actions={actions}
              jobsByComponentId={jobsByComponentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type Modal =
  | { kind: 'none' }
  | { kind: 'component'; parentId?: string; parentName?: string }
  | { kind: 'editComponent'; component: Component }
  | { kind: 'logHours'; component: Component }
  | { kind: 'job'; componentId: string; componentName: string }
  | { kind: 'editJob'; job: Job; componentName: string }
  | { kind: 'instance'; jobId: string; componentId: string };

export function ComponentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: MaintenanceTab = (searchParams.get('tab') as MaintenanceTab) ?? 'components';

  const [components, setComponents] = useState<Component[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>({ kind: 'none' });

  const load = () => {
    setLoading(true);
    Promise.all([api.get<Component[]>('/components'), api.get<Job[]>('/jobs')])
      .then(([comps, js]) => {
        setComponents(comps);
        setJobs(js);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const close = () => setModal({ kind: 'none' });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete component "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/components/${id}`);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const jobsByComponentId = new Map<string, Job[]>();
  for (const j of jobs) {
    const arr = jobsByComponentId.get(j.componentId) ?? [];
    arr.push(j);
    jobsByComponentId.set(j.componentId, arr);
  }

  const actions: NodeActions = {
    onAddChild: (parentId, parentName) => setModal({ kind: 'component', parentId, parentName }),
    onAddJob: (componentId, componentName) => setModal({ kind: 'job', componentId, componentName }),
    onEditJob: (job, componentName) => setModal({ kind: 'editJob', job, componentName }),
    onScheduleJob: (jobId, componentId) => setModal({ kind: 'instance', jobId, componentId }),
    onLogHours: (component) => setModal({ kind: 'logHours', component }),
    onEditComponent: (component) => setModal({ kind: 'editComponent', component }),
    onDeleteComponent: handleDelete,
  };

  const tree = buildTree(components);

  return (
    <div>
      {/* ── Module header + tab bar ──────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: '-0.011em',
            color: '#0A1F33',
            margin: '0 0 16px',
          }}
        >
          Maintenance
        </h1>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E5E3DA' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSearchParams(t.id === 'components' ? {} : { tab: t.id })}
              style={{
                padding: '0 2px',
                height: 36,
                marginRight: 20,
                border: 'none',
                borderBottom: `2px solid ${activeTab === t.id ? '#0A1F33' : 'transparent'}`,
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === t.id ? 600 : 500,
                color: activeTab === t.id ? '#0A1F33' : '#8893A0',
                fontFamily: 'inherit',
                transition: 'color .1s, border-color .1s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      {activeTab === 'jobs' && <JobInstancesPage />}
      {activeTab === 'history' && <MaintenanceHistoryTab />}
      {activeTab === 'templates' && (
        <MaintenanceTemplatesTab
          onCreateJob={(cId, cName) =>
            setModal({ kind: 'job', componentId: cId, componentName: cName })
          }
          onEditJob={(job, cName) => setModal({ kind: 'editJob', job, componentName: cName })}
          onScheduleJob={(jobId, cId) => setModal({ kind: 'instance', jobId, componentId: cId })}
        />
      )}
      {activeTab === 'running-hours' && <MaintenanceRunningHoursTab />}
      {activeTab === 'projects' && <MaintenanceProjectsTab />}

      {/* ── Components tab ───────────────────────────────────────── */}
      {activeTab === 'components' && (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900" style={{ display: 'none' }}>
                Components
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">Equipment hierarchy for this vessel</p>
            </div>
            <Button onClick={() => setModal({ kind: 'component' })}>+ New Component</Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            {loading && (
              <div className="p-8">
                <Spinner />
              </div>
            )}
            {error && <div className="p-6 text-sm text-red-600">{error}</div>}
            {!loading && !error && components.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">
                No components yet.{' '}
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => setModal({ kind: 'component' })}
                >
                  Add the first one.
                </button>
              </div>
            )}
            {!loading && !error && tree.length > 0 && (
              <div className="py-2">
                {tree.map((node) => (
                  <ComponentNode
                    key={node.id}
                    node={node}
                    depth={0}
                    actions={actions}
                    jobsByComponentId={jobsByComponentId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <CreateComponentModal
        open={modal.kind === 'component'}
        parentId={modal.kind === 'component' ? modal.parentId : null}
        parentName={modal.kind === 'component' ? modal.parentName : null}
        onClose={close}
        onCreated={() => {
          close();
          load();
        }}
      />
      <EditComponentModal
        open={modal.kind === 'editComponent'}
        component={modal.kind === 'editComponent' ? modal.component : null}
        onClose={close}
        onSaved={() => {
          close();
          load();
        }}
      />
      <LogRunningHoursModal
        open={modal.kind === 'logHours'}
        componentId={modal.kind === 'logHours' ? modal.component.id : ''}
        componentName={modal.kind === 'logHours' ? modal.component.name : ''}
        currentHours={modal.kind === 'logHours' ? modal.component.runningHours : '0'}
        onClose={close}
        onLogged={() => {
          close();
          load();
        }}
      />
      <CreateJobModal
        open={modal.kind === 'job'}
        componentId={modal.kind === 'job' ? modal.componentId : ''}
        componentName={modal.kind === 'job' ? modal.componentName : ''}
        onClose={close}
        onCreated={(newJobId) => {
          const compId = modal.kind === 'job' ? modal.componentId : '';
          setModal({ kind: 'instance', jobId: newJobId, componentId: compId });
        }}
      />
      <EditJobModal
        open={modal.kind === 'editJob'}
        job={modal.kind === 'editJob' ? modal.job : null}
        componentName={modal.kind === 'editJob' ? modal.componentName : ''}
        onClose={close}
        onSaved={() => {
          close();
          load();
        }}
      />
      <CreateJobInstanceModal
        open={modal.kind === 'instance'}
        jobId={modal.kind === 'instance' ? modal.jobId : null}
        componentId={modal.kind === 'instance' ? modal.componentId : null}
        onClose={close}
        onCreated={() => {
          close();
          load();
        }}
      />
    </div>
  );
}
