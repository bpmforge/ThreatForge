/**
 * Node-related actions for the canvas store.
 */
import { applyNodeChanges, type NodeChange } from "@xyflow/react";
import type {
  ComponentNodeData,
  BoundaryNodeData,
  LegendNodeData,
  SwimlaneNodeData,
  ComponentType,
} from "@/types/canvas";
import type { CanvasNode, NodeActions, SetState, GetState } from "../types";
import { generateId } from "../types";
import { DEFAULT_TRUST_LEVEL, getDefaultLabel } from "../constants";
import { getDescendantIds } from "../geometry";

const TIER_MAP: Partial<Record<ComponentType, number>> = {
  ACTOR: 0,
  EXTERNAL_ENTITY: 0,
  API_GATEWAY: 1,
  LOAD_BALANCER: 1,
  CDN: 1,
  FIREWALL: 1,
  WAF: 1,
  WEB_APP: 2,
  MOBILE_APP: 2,
  DESKTOP_APP: 2,
  API: 2,
  MICROSERVICE: 2,
  SERVERLESS: 2,
  AUTH_SERVICE: 2,
  IAM: 2,
  DATABASE: 3,
  FILE_SYSTEM: 3,
  OBJECT_STORAGE: 3,
  DATA_LAKE: 3,
  CACHE: 3,
  QUEUE: 3,
  MESSAGE_QUEUE: 3,
};

function getTier(type: ComponentType): number {
  return TIER_MAP[type] ?? 2;
}

export const createNodeSlice = (set: SetState, get: GetState): NodeActions => ({
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => {
    set(
      (state) => ({
        nodes: applyNodeChanges(changes, state.nodes),
        // Selecting is not editing: marking the model dirty on every
        // selection change wrote an "unsaved" backup on each reload and made
        // the Restore dialog nag on a fully saved model.
        isDirty: state.isDirty || changes.some((c) => c.type !== "select"),
      }),
      false,
      "onNodesChange",
    );
  },

  addComponent: (
    type: ComponentType,
    position: { x: number; y: number },
    label?: string,
  ) => {
    const id = generateId();
    const newNode: CanvasNode = {
      id,
      type: "component",
      position,
      data: {
        label: label || getDefaultLabel(type),
        type,
        trustLevel: DEFAULT_TRUST_LEVEL,
      } as ComponentNodeData,
    };

    set(
      (state) => ({
        nodes: [...state.nodes, newNode],
        isDirty: true,
      }),
      false,
      "addComponent",
    );

    return id;
  },

  addBoundary: (position: { x: number; y: number }, label?: string) => {
    const id = generateId();
    const newNode: CanvasNode = {
      id,
      type: "boundary",
      position,
      style: { width: 400, height: 300 },
      zIndex: -1000,
      data: {
        label: label || "Trust Boundary",
        trustLevel: DEFAULT_TRUST_LEVEL,
      } as BoundaryNodeData,
    };

    set(
      (state) => ({
        nodes: [...state.nodes, newNode],
        isDirty: true,
      }),
      false,
      "addBoundary",
    );

    return id;
  },

  updateNodeData: (
    nodeId: string,
    data: Partial<ComponentNodeData | BoundaryNodeData>,
  ) => {
    set(
      (state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...data } }
            : node,
        ),
        isDirty: true,
      }),
      false,
      "updateNodeData",
    );
  },

  addNodes: (newNodes: CanvasNode[]) => {
    set(
      (state) => ({
        nodes: [...state.nodes, ...newNodes],
        isDirty: true,
      }),
      false,
      "addNodes",
    );
  },

  addLegend: (position: { x: number; y: number }) => {
    const id = generateId();
    const newNode: CanvasNode = {
      id,
      type: "legend",
      position,
      style: { width: 220, height: 160 },
      data: { label: "Legend" } as LegendNodeData,
    };
    set(
      (state) => ({ nodes: [...state.nodes, newNode], isDirty: true }),
      false,
      "addLegend",
    );
    return id;
  },

  addSwimlane: (position: { x: number; y: number }, label?: string) => {
    const id = generateId();
    const newNode: CanvasNode = {
      id,
      type: "swimlane",
      position,
      style: { width: 600, height: 320 },
      zIndex: -500,
      data: {
        label: label || "Swimlane",
        lanes: [
          { id: generateId(), name: "Lane 1" },
          { id: generateId(), name: "Lane 2" },
          { id: generateId(), name: "Lane 3" },
        ],
      } as SwimlaneNodeData,
    };
    set(
      (state) => ({ nodes: [...state.nodes, newNode], isDirty: true }),
      false,
      "addSwimlane",
    );
    return id;
  },

  toggleNodeLock: (nodeId: string) => {
    set(
      (state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                draggable: !!n.data.locked,
                data: { ...n.data, locked: !n.data.locked },
              }
            : n,
        ),
        isDirty: true,
      }),
      false,
      "toggleNodeLock",
    );
  },

  autoLayout: () => {
    const { nodes } = get();
    const COL_W = 240;
    const ROW_H = 200;
    const MARGIN_X = 80;
    const MARGIN_Y = 80;

    // Only lay out top-level component nodes (not boundaries, legends, or children)
    const movable = nodes.filter((n) => n.type === "component" && !n.parentId);
    const fixed = nodes.filter((n) => n.type !== "component" || n.parentId);

    // Group by tier
    const tiers: Record<number, typeof movable> = {};
    for (const n of movable) {
      const tier = getTier((n.data as ComponentNodeData).type);
      (tiers[tier] ??= []).push(n);
    }

    const tierKeys = Object.keys(tiers)
      .map(Number)
      .sort((a, b) => a - b);
    const updated = movable.map((n) => {
      const tier = getTier((n.data as ComponentNodeData).type);
      const tierIdx = tierKeys.indexOf(tier);
      const col = tiers[tier].indexOf(n);
      return {
        ...n,
        position: {
          x: MARGIN_X + col * COL_W,
          y: MARGIN_Y + tierIdx * ROW_H,
        },
      };
    });

    set(
      () => ({ nodes: [...fixed, ...updated], isDirty: true }),
      false,
      "autoLayout",
    );
  },

  toggleBoundaryCollapse: (boundaryId: string) => {
    const { nodes } = get();
    const boundary = nodes.find((n) => n.id === boundaryId);
    if (!boundary) return;
    const nowCollapsed = !(boundary.data as { collapsed?: boolean }).collapsed;
    // Everything nested inside, not just direct children — a grandchild
    // left visible inside a collapsed zone floated over empty canvas.
    const family = getDescendantIds(boundaryId, nodes);
    family.delete(boundaryId);
    set(
      (state) => ({
        nodes: state.nodes.map((n) => {
          if (n.id === boundaryId) {
            return { ...n, data: { ...n.data, collapsed: nowCollapsed } };
          }
          if (family.has(n.id)) {
            return { ...n, hidden: nowCollapsed };
          }
          return n;
        }),
        isDirty: true,
      }),
      false,
      "toggleBoundaryCollapse",
    );
  },
});
