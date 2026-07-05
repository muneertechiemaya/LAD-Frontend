import { Node, Edge, MarkerType } from 'reactflow';

export interface WorkflowPreviewStep {
  id: string;
  channel?: string;
  type: string;
  title: string;
  description?: string;
  message?: string;
  leadLimit?: number;
}

export type WorkflowLayout = 'horizontal' | 'vertical';

/* ═══════════════════════════════════════════════════════════════════
   LINEAR 1:1 LAYOUT — one node per step, Start → steps… → End.
   A FAITHFUL mirror of the workflowPreview array (the single source of
   truth): every step is exactly one editable node and vice versa, so
   adding/removing a node maps 1:1 to a config step. (An earlier version
   synthesised decorative branch nodes — Accepted / No-Response / Soft
   Bump / Nurture … — that were not real steps and made node↔step
   add/delete ambiguous; that is intentionally gone.)
   ═══════════════════════════════════════════════════════════════════ */

const Y_GAP = 180;      // vertical gap between rows
const LINEAR_CX = 300;  // shared column x for the vertical spine
const LINEAR_Y0 = 40;   // y of the Start node

function linearNode(id: string, type: string, title: string, description: string, index: number): Node {
  return {
    id,
    type: 'custom',
    position: { x: LINEAR_CX, y: LINEAR_Y0 + index * Y_GAP },
    draggable: true,
    data: { title, type, description, _layout: 'vertical' },
  };
}

function makeEdge(src: string, tgt: string): Edge {
  const c = '#c4c9d4';
  return {
    id: `e-${src}-${tgt}`,
    source: src, sourceHandle: 'bottom',
    target: tgt, targetHandle: 'top',
    type: 'smoothstep',
    animated: true,
    data: { label: '', color: c },
    style: { stroke: c, strokeWidth: 2, strokeDasharray: '6,6' },
    markerEnd: { type: MarkerType.ArrowClosed, color: c, width: 10, height: 10 },
  };
}

export function createReactFlowNodes(
  workflowPreview: WorkflowPreviewStep[] | null,
  _layout: WorkflowLayout = 'vertical',
): Node[] {
  const steps = workflowPreview || [];
  const nodes: Node[] = [linearNode('start', 'start', 'Start', 'Campaign begins', 0)];
  steps.forEach((s, i) => {
    nodes.push(linearNode(s.id, s.type, s.title, s.description || '', i + 1));
  });
  nodes.push(linearNode('end', 'end', 'End', 'Campaign ends', steps.length + 1));
  return nodes;
}

export function createReactFlowEdges(
  workflowPreview: WorkflowPreviewStep[] | null,
  _layout: WorkflowLayout = 'vertical',
): Edge[] {
  const steps = workflowPreview || [];
  // Node ids in spine order: start → each step id → end.
  const spine = ['start', ...steps.map((s) => s.id), 'end'];
  const edges: Edge[] = [];
  for (let i = 0; i < spine.length - 1; i++) {
    edges.push(makeEdge(spine[i], spine[i + 1]));
  }
  return edges;
}
