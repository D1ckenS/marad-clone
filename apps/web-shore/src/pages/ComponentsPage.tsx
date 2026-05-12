import { useEffect, useState } from 'react';
import { Badge, Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Component {
  id: string;
  name: string;
  description: string | null;
  sfi: string | null;
  parentId: string | null;
  runningHours: string;
}

interface TreeNode extends Component {
  children: TreeNode[];
}

function buildTree(items: Component[]): TreeNode[] {
  const byId = new Map(items.map((c) => [c.id, { ...c, children: [] as TreeNode[] }]));
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function ComponentNode({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-md hover:bg-slate-100 cursor-default group`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {hasChildren ? (
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
        <span className="text-xs text-slate-400">{node.runningHours} h</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <ComponentNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ComponentsPage() {
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Component[]>('/components')
      .then(setComponents)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const tree = buildTree(components);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Components</h1>
        <p className="text-sm text-slate-500 mt-0.5">Equipment hierarchy for this vessel</p>
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
            No components found for this vessel.
          </div>
        )}
        {!loading && !error && tree.length > 0 && (
          <div className="py-2">
            {tree.map((node) => (
              <ComponentNode key={node.id} node={node} depth={0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
