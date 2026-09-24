"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { WorkflowStatus, WorkflowStatusCategory, WorkflowTransition } from "@/types";
import { prettifyStatusName } from "@/lib/workflowDisplay";
import {
  GitBranch,
  ArrowRight,
  Plus,
  Trash2,
  Check,
  X,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
  Maximize2,
  CheckCircle2,
  Clock,
  CircleDot,
  Layers,
  ChevronRight,
} from "lucide-react";

interface WorkflowGraphViewProps {
  projectId: string;
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
  canManage: boolean;
  onToggleTransition: (fromId: string, toId: string, allowed: boolean) => Promise<void>;
  onAllowAllIncoming?: (toId: string) => Promise<void>;
  onClearTransitions?: (
    statusId: string,
    direction?: "incoming" | "outgoing" | "both"
  ) => Promise<void>;
  onAddStatusClick?: () => void;
}

interface NodePosition {
  x: number;
  y: number;
}

/** Theme colours for the graph, set through style so they follow the theme. */
const C = {
  accent: "rgb(var(--color-accent))",
  accentSoft: "rgb(var(--color-accent-soft))",
  border: "rgb(var(--color-border))",
  strong: "rgb(var(--color-border-strong))",
  muted: "rgb(var(--color-muted))",
  ink: "rgb(var(--color-ink))",
  ink2: "rgb(var(--color-ink-2))",
  danger: "rgb(var(--color-danger))",
  success: "rgb(var(--color-success))",
  surface: "rgb(var(--color-surface))",
  sunk: "rgb(var(--color-surface-sunk))",
};

const NODE_WIDTH = 210;
const NODE_HEIGHT = 86;
const COL_WIDTH = 340;
const ROW_GAP = 120;
const START_X = 100;
const START_Y = 60;

const CATEGORY_STYLES: Record<
  WorkflowStatusCategory,
  {
    headerBg: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    label: string;
    accent: string;
  }
> = {
  TODO: {
    headerBg: "bg-surface-sunk",
    border: "border-subtle hover:border-strong",
    badgeBg: "bg-surface-sunk",
    badgeText: "text-ink-2",
    label: "To Do",
    accent: C.muted,
  },
  IN_PROGRESS: {
    headerBg: "bg-accent-soft/60",
    border: "border-accent/40 hover:border-accent",
    badgeBg: "bg-accent-soft",
    badgeText: "text-accent",
    label: "In Progress",
    accent: C.accent,
  },
  DONE: {
    headerBg: "bg-success-soft/60",
    border: "border-success/40 hover:border-success",
    badgeBg: "bg-success-soft",
    badgeText: "text-success",
    label: "Done",
    accent: C.success,
  },
};

/**
 * Check if a status can be transitioned into from any node in the workflow.
 * Holds true when there are at least 2 other statuses and every other status
 * has an active transition pointing to this status.
 */
export function isTransitionFromAnyNode(
  statusId: string,
  statuses: WorkflowStatus[],
  transitionKeys: Set<string>
): boolean {
  const otherStatuses = statuses.filter((s) => s.id !== statusId);
  return (
    otherStatuses.length >= 2 &&
    otherStatuses.every((other) => transitionKeys.has(`${other.id}:${statusId}`))
  );
}

/** Compute default auto-arranged positions grouped by category columns */
export function computeAutoLayout(
  statuses: WorkflowStatus[],
  transitions?: WorkflowTransition[] | Set<string>
): Record<string, NodePosition> {
  const result: Record<string, NodePosition> = {};
  const categories: WorkflowStatusCategory[] = ["TODO", "IN_PROGRESS", "DONE"];

  const transitionKeys =
    transitions instanceof Set
      ? transitions
      : new Set((transitions || []).map((t) => `${t.fromId}:${t.toId}`));

  const grouped: Record<WorkflowStatusCategory, WorkflowStatus[]> = {
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
  };

  for (const s of statuses) {
    if (grouped[s.category]) {
      grouped[s.category].push(s);
    } else {
      grouped.TODO.push(s);
    }
  }

  // Order each group by status.order
  for (const cat of categories) {
    const list = grouped[cat];
    list.sort((a, b) => a.order - b.order);

    const colIdx = cat === "TODO" ? 0 : cat === "IN_PROGRESS" ? 1 : 2;
    const colX = START_X + colIdx * COL_WIDTH;

    // Separate standard statuses from any-node transition target statuses
    const standard = list.filter((s) => !isTransitionFromAnyNode(s.id, statuses, transitionKeys));
    const allIncoming = list.filter((s) => isTransitionFromAnyNode(s.id, statuses, transitionKeys));

    let currentY = START_Y;

    // Standard statuses placed first
    standard.forEach((status) => {
      result[status.id] = {
        x: colX,
        y: currentY,
      };
      currentY += ROW_GAP;
    });

    // If there were standard statuses and there are all-incoming statuses,
    // separate them with an extra gap so the general start status is clearly detached!
    if (standard.length > 0 && allIncoming.length > 0) {
      currentY += 40;
    }

    // All-incoming statuses placed with separation
    allIncoming.forEach((status) => {
      result[status.id] = {
        x: colX,
        y: currentY,
      };
      currentY += ROW_GAP;
    });
  }

  return result;
}

/** Calculate cubic Bézier curve between two nodes with bidirectional pair separation */
export function calculateEdgePath(
  fromPos: NodePosition,
  toPos: NodePosition,
  isBidirectional: boolean,
  isReverse: boolean
): { path: string; midX: number; midY: number } {
  // Input and output ports
  const startX = fromPos.x + NODE_WIDTH;
  const startY = fromPos.y + NODE_HEIGHT / 2;
  const endX = toPos.x;
  const endY = toPos.y + NODE_HEIGHT / 2;

  const colDx = toPos.x - fromPos.x;
  const dx = endX - startX;
  const dy = endY - startY;

  // Forward connection (left to right, toPos is in a subsequent column)
  if (colDx > 30) {
    let curvatureY = 0;
    if (isBidirectional) {
      // Offset bidirectional arrows so they don't overlap
      curvatureY = isReverse ? 38 : -38;
    }

    const cp1x = startX + dx * 0.45;
    const cp1y = startY + curvatureY;
    const cp2x = endX - dx * 0.45;
    const cp2y = endY + curvatureY;

    const path = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2 + curvatureY * 0.75;
    return { path, midX, midY };
  }

  // Backward connection (right to left, toPos is in a preceding column)
  if (colDx < -30) {
    // Loop around top or bottom
    const loopAbove = startY <= toPos.y + NODE_HEIGHT / 2;
    const loopOffset = loopAbove ? -60 : 60;

    const fromTop = fromPos.y + (loopAbove ? 0 : NODE_HEIGHT);
    const toTop = toPos.y + (loopAbove ? 0 : NODE_HEIGHT);

    const fromAnchorX = fromPos.x + NODE_WIDTH * 0.5;
    const toAnchorX = toPos.x + NODE_WIDTH * 0.5;

    const controlY = Math.min(fromTop, toTop) + loopOffset;
    const path = `M ${fromAnchorX} ${fromTop} C ${fromAnchorX} ${controlY}, ${toAnchorX} ${controlY}, ${toAnchorX} ${toTop}`;
    // Precise apex of cubic Bezier at t=0.5 where P0=fromTop, P1=P2=controlY, P3=toTop
    const midY = 0.125 * (fromTop + toTop) + 0.75 * controlY;
    return { path, midX: (fromAnchorX + toAnchorX) / 2, midY };
  }

  // Same column / vertical connection
  const curveOut = 65;
  const rightX = fromPos.x + NODE_WIDTH;
  const targetRightX = toPos.x + NODE_WIDTH;
  const cp1x = rightX + curveOut;
  const cp1y = startY;
  const cp2x = targetRightX + curveOut;
  const cp2y = endY;

  const path = `M ${rightX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetRightX} ${endY}`;
  return { path, midX: (rightX + targetRightX) / 2 + curveOut * 0.75, midY: (startY + endY) / 2 };
}

export default function WorkflowGraphView({
  projectId,
  statuses,
  transitions,
  canManage,
  onToggleTransition,
  onAllowAllIncoming,
  onClearTransitions,
  onAddStatusClick,
}: WorkflowGraphViewProps) {
  // Set of transition keys: "fromId:toId"
  const transitionKeys = useMemo(
    () => new Set(transitions.map((t) => `${t.fromId}:${t.toId}`)),
    [transitions]
  );

  // Status IDs that can be transitioned into from any node
  const globalTransitionStatusIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of statuses) {
      if (isTransitionFromAnyNode(s.id, statuses, transitionKeys)) {
        set.add(s.id);
      }
    }
    return set;
  }, [statuses, transitionKeys]);

  // Positions of nodes on canvas
  const [positions, setPositions] = useState<Record<string, NodePosition>>(() =>
    computeAutoLayout(statuses, transitions)
  );

  // Selected status for inspector panel
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);

  // Connection mode state
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Hovered edge for delete button with grace period to prevent flickering/escaping
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleEdgeMouseEnter = useCallback((key: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredEdgeKey(key);
  }, []);

  const handleEdgeMouseLeave = useCallback((key: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredEdgeKey((curr) => (curr === key ? null : curr));
    }, 200);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Canvas zoom and pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging node state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  // Sync positions when status count changes or new statuses added
  useEffect(() => {
    setPositions((prev) => {
      const auto = computeAutoLayout(statuses, transitions);
      const next = { ...prev };
      let updated = false;
      for (const s of statuses) {
        if (!next[s.id]) {
          next[s.id] = auto[s.id] || { x: START_X, y: START_Y };
          updated = true;
        }
      }
      return updated ? next : prev;
    });
  }, [statuses, transitions]);

  // Map of statuses for fast lookup
  const statusMap = useMemo(() => {
    const map = new Map<string, WorkflowStatus>();
    for (const s of statuses) map.set(s.id, s);
    return map;
  }, [statuses]);

  // Calculate canvas bounding size to allow scrolling/panning
  const canvasBounds = useMemo(() => {
    let maxX = 900;
    let maxY = 550;
    for (const pos of Object.values(positions)) {
      maxX = Math.max(maxX, pos.x + NODE_WIDTH + 140);
      maxY = Math.max(maxY, pos.y + NODE_HEIGHT + 140);
    }
    return { width: maxX, height: maxY };
  }, [positions]);

  // Handle auto-arrange layout
  const handleAutoArrange = () => {
    setPositions(computeAutoLayout(statuses, transitions));
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(1.8, +(z + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)));
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Pan handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === "svg") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  // Dragging a status card
  const handleNodeMouseDown = (e: React.MouseEvent, statusId: string) => {
    e.stopPropagation();
    if (!canManage) return;
    const pos = positions[statusId] || { x: 0, y: 0 };
    setDraggingNodeId(statusId);
    setDragOffset({
      x: e.clientX / zoom - pos.x,
      y: e.clientY / zoom - pos.y,
    });
  };

  // Start connect from handle
  const handleStartConnect = (e: React.MouseEvent, statusId: string) => {
    e.stopPropagation();
    if (!canManage) return;
    setConnectingFromId(statusId);
    setSelectedStatusId(statusId);
  };

  // Complete connect to target
  const handleTargetNodeClick = (e: React.MouseEvent, targetId: string) => {
    e.stopPropagation();
    if (connectingFromId && connectingFromId !== targetId) {
      onToggleTransition(connectingFromId, targetId, true);
      setConnectingFromId(null);
    } else {
      setSelectedStatusId(targetId);
    }
  };

  // Global mouse move & mouse up listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      } else if (draggingNodeId) {
        const isAllIncoming = globalTransitionStatusIds.has(draggingNodeId);
        const minX = isAllIncoming ? 80 : 20;
        const newX = Math.max(minX, Math.round(e.clientX / zoom - dragOffset.x));
        const newY = Math.max(20, Math.round(e.clientY / zoom - dragOffset.y));
        setPositions((prev) => ({
          ...prev,
          [draggingNodeId]: { x: newX, y: newY },
        }));
      }

      if (connectingFromId && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setMousePos({
          x: (e.clientX - rect.left - pan.x) / zoom,
          y: (e.clientY - rect.top - pan.y) / zoom,
        });
      }
    };

    const handleMouseUp = () => {
      setIsPanning(false);
      setDraggingNodeId(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConnectingFromId(null);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPanning, draggingNodeId, dragOffset, connectingFromId, pan, zoom, panStart, globalTransitionStatusIds]);

  // Selected status details for inspector
  const selectedStatus = selectedStatusId ? statusMap.get(selectedStatusId) : null;

  return (
    <div className="flex flex-col h-full w-full bg-slate-50/50 rounded-lg border border-subtle overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="h-11 px-4 border-b border-subtle bg-white flex items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-ink-2">
            <GitBranch className="w-3.5 h-3.5 text-accent" />
            <span className="font-bold text-ink">Workflow Graph</span>
            <span className="text-[11px] text-muted">
              ({statuses.length} statuses, {transitions.length} transitions)
            </span>
          </div>

          {connectingFromId && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent-soft border border-accent/40 text-accent text-xs font-semibold animate-pulse">
              <span>Connect to destination status...</span>
              <button
                type="button"
                onClick={() => setConnectingFromId(null)}
                className="p-0.5 hover:bg-accent/20 rounded"
                title="Cancel (Esc)"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center border border-subtle rounded bg-white overflow-hidden text-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-surface-sunk text-ink-2 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              className="px-2 py-1 hover:bg-surface-sunk text-ink-2 font-semibold border-x border-subtle text-[11px]"
              title="Reset Zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-surface-sunk text-ink-2 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Auto Arrange */}
          <button
            type="button"
            onClick={handleAutoArrange}
            className="px-2.5 py-1 text-xs font-semibold text-ink-2 bg-white border border-subtle hover:bg-surface-sunk rounded flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Auto-arrange status cards into columns"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Auto-Arrange</span>
          </button>

          {onAddStatusClick && canManage && (
            <button
              type="button"
              onClick={onAddStatusClick}
              className="px-2.5 py-1 text-xs font-semibold text-accent-fg bg-accent hover:bg-accent-hover rounded flex items-center gap-1 transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Status</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        className={`relative flex-1 w-full h-[520px] overflow-hidden ${
          isPanning ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {/* Transformable Canvas Layer */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: `${canvasBounds.width}px`,
            height: `${canvasBounds.height}px`,
          }}
          className="relative transition-transform duration-75"
        >
          {/* Category Column Background Guides */}
          <div className="absolute inset-0 pointer-events-none flex" style={{ gap: `${COL_WIDTH - NODE_WIDTH}px`, paddingLeft: `${START_X}px`, paddingTop: "20px" }}>
            {(["TODO", "IN_PROGRESS", "DONE"] as WorkflowStatusCategory[]).map((cat, idx) => (
              <div
                key={cat}
                style={{ width: `${NODE_WIDTH}px` }}
                className="h-full border-t-2 border-dashed border-subtle/90 pt-1"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  {cat === "TODO" ? "1. To Do" : cat === "IN_PROGRESS" ? "2. In Progress" : "3. Done"}
                </span>
              </div>
            ))}
          </div>

          {/* SVG Layer for Edges and Markers */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10"
            style={{ width: `${canvasBounds.width}px`, height: `${canvasBounds.height}px` }}
          >
            <defs>
              {/* Dotted Canvas Background Grid */}
              <pattern id="workflow-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle style={{ fill: C.border }} cx="2" cy="2" r="1" />
              </pattern>

              {/* Standard Arrow Marker */}
              <marker
                id="workflow-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path style={{ fill: C.muted }} d="M 0 1 L 10 5 L 0 9 z" />
              </marker>

              {/* Active / Hovered Arrow Marker */}
              <marker
                id="workflow-arrow-active"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path style={{ fill: C.accent }} d="M 0 1 L 10 5 L 0 9 z" />
              </marker>

              {/* General Start Arrow Marker */}
              <marker
                id="workflow-arrow-general-start"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path style={{ fill: C.ink }} d="M 0 1 L 10 5 L 0 9 z" />
              </marker>
            </defs>

            {/* Grid Pattern Background Rect */}
            <rect width="100%" height="100%" fill="url(#workflow-grid)" />

            {/* Render Transitions as Directed Edges (omitting incoming edges to any-node targets) */}
            {transitions.map((t) => {
              // If the target node can be transitioned into from any node,
              // do NOT connect incoming edges to it. Instead it has a general start.
              if (globalTransitionStatusIds.has(t.toId)) {
                return null;
              }

              const fromPos = positions[t.fromId];
              const toPos = positions[t.toId];
              if (!fromPos || !toPos) return null;

              const edgeKey = `${t.fromId}:${t.toId}`;
              const reverseKey = `${t.toId}:${t.fromId}`;
              const isBidirectional = transitionKeys.has(reverseKey);
              const isReverse = t.fromId > t.toId;

              const isHovered = hoveredEdgeKey === edgeKey;
              const isSelectedFrom = selectedStatusId === t.fromId;
              const isSelectedTo = selectedStatusId === t.toId;
              const isHighlighted = isSelectedFrom || isSelectedTo || isHovered;

              const { path, midX, midY } = calculateEdgePath(fromPos, toPos, isBidirectional, isReverse);

              return (
                <g
                  key={edgeKey}
                  data-edge-key={edgeKey}
                  className="group pointer-events-auto cursor-pointer"
                  onMouseEnter={() => handleEdgeMouseEnter(edgeKey)}
                  onMouseLeave={() => handleEdgeMouseLeave(edgeKey)}
                >
                  {/* Invisible thick path for easy, reliable hovering */}
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="28"
                    strokeLinecap="round"
                    className="pointer-events-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdgeMouseEnter(edgeKey);
                    }}
                  />

                  {/* Visible Directed Bézier Path */}
                  <path style={{ stroke: isHighlighted ? C.accent : C.strong }}
                    d={path}
                    fill="none"
                   
                    strokeWidth={isHighlighted ? 2.5 : 1.75}
                    markerEnd={`url(#workflow-arrow${isHighlighted ? "-active" : ""})`}
                    className="transition-colors duration-150"
                  />

                  {/* Delete Transition Badge on Hover or Selection */}
                  {(isHovered || isHighlighted) && canManage && (
                    <g
                      transform={`translate(${midX}, ${midY})`}
                      className="pointer-events-auto cursor-pointer transition-transform hover:scale-110"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHoveredEdgeKey(null);
                        onToggleTransition(t.fromId, t.toId, false);
                      }}
                      onMouseEnter={() => handleEdgeMouseEnter(edgeKey)}
                    >
                      <title>Delete transition</title>
                      {/* Generous invisible hit circle so mouse never slips off */}
                      <circle r="16" fill="transparent" />
                      <circle style={{ fill: C.danger }} r="9" className="shadow-sm" />
                      <line style={{ stroke: C.surface }} x1="-3" y1="-3" x2="3" y2="3" strokeWidth="1.5" strokeLinecap="round" />
                      <line style={{ stroke: C.surface }} x1="3" y1="-3" x2="-3" y2="3" strokeWidth="1.5" strokeLinecap="round" />
                    </g>
                  )}
                </g>
              );
            })}

            {/* General Start Indicators for Nodes Transitionable from Any Node */}
            {Array.from(globalTransitionStatusIds).map((statusId) => {
              const pos = positions[statusId];
              if (!pos) return null;

              const edgeKey = `general-start:${statusId}`;
              const isHovered = hoveredEdgeKey === edgeKey;
              const isSelected = selectedStatusId === statusId;
              const isHighlighted = isHovered || isSelected;

              const targetX = pos.x;
              const targetY = pos.y + NODE_HEIGHT / 2;
              const startCircleX = targetX - 66;
              const lineStartX = targetX - 52;
              const badgeCenterX = targetX - 32;

              return (
                <g
                  key={edgeKey}
                  data-edge-key={edgeKey}
                  className="group general-start-group pointer-events-auto cursor-pointer"
                  onMouseEnter={() => handleEdgeMouseEnter(edgeKey)}
                  onMouseLeave={() => handleEdgeMouseLeave(edgeKey)}
                >
                  {/* Invisible hit area for hover */}
                  <rect
                    x={startCircleX - 16}
                    y={targetY - 22}
                    width={targetX - startCircleX + 16}
                    height={44}
                    fill="transparent"
                    className="pointer-events-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStatusId(statusId);
                      handleEdgeMouseEnter(edgeKey);
                    }}
                  />

                  {/* Directed Arrow Line from General Start to Node */}
                  <line style={{ stroke: isHighlighted ? C.accent : C.ink }}
                    x1={lineStartX}
                    y1={targetY}
                    x2={targetX}
                    y2={targetY}
                   
                    strokeWidth={isHighlighted ? 2.5 : 2}
                    markerEnd={`url(#workflow-arrow${isHighlighted ? "-active" : "-general-start"})`}
                    className="transition-colors duration-150"
                  />

                  {/* General Start Symbol (Initial State Circle with White Center) */}
                  <g
                    className="pointer-events-auto cursor-pointer transition-transform group-hover:scale-110"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStatusId(statusId);
                      handleEdgeMouseEnter(edgeKey);
                    }}
                  >
                    <circle style={{ fill: isHighlighted ? C.accent : C.ink, stroke: isHighlighted ? C.accent : C.ink2 }}
                      cx={startCircleX}
                      cy={targetY}
                      r="13"
                     
                     
                      strokeWidth="1.5"
                      className="shadow-sm transition-colors duration-150"
                    />
                    <circle style={{ fill: C.surface }}
                      cx={startCircleX}
                      cy={targetY}
                      r="4.5"
                     
                    />
                  </g>

                  {/* Badge above arrow: "ALL" */}
                  {!isHovered && (
                    <g className="pointer-events-none transition-opacity">
                      <rect style={{ fill: isHighlighted ? C.accentSoft : C.sunk, stroke: isHighlighted ? C.accent : C.strong }}
                        x={badgeCenterX - 15}
                        y={targetY - 24}
                        width="30"
                        height="15"
                        rx="7.5"
                       
                       
                        strokeWidth="1"
                      />
                      <text style={{ fill: isHighlighted ? C.accent : C.ink2 }}
                        x={badgeCenterX}
                        y={targetY - 13}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="700"
                       
                        letterSpacing="0.05em"
                      >
                        ALL
                      </text>
                    </g>
                  )}

                  {/* Delete Transition Badge on Hover */}
                  {isHovered && canManage && (
                    <g
                      transform={`translate(${badgeCenterX}, ${targetY})`}
                      className="pointer-events-auto cursor-pointer transition-transform hover:scale-110"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHoveredEdgeKey(null);
                        if (onClearTransitions) {
                          onClearTransitions(statusId, "incoming");
                        }
                      }}
                      onMouseEnter={() => handleEdgeMouseEnter(edgeKey)}
                    >
                      <title>Clear all incoming transitions</title>
                      {/* Generous invisible hit circle */}
                      <circle r="16" fill="transparent" />
                      <circle style={{ fill: C.danger }} r="9" className="shadow-sm" />
                      <line style={{ stroke: C.surface }} x1="-3" y1="-3" x2="3" y2="3" strokeWidth="1.5" strokeLinecap="round" />
                      <line style={{ stroke: C.surface }} x1="3" y1="-3" x2="-3" y2="3" strokeWidth="1.5" strokeLinecap="round" />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Live Rubber-Band Arrow while user is connecting */}
            {connectingFromId && mousePos && positions[connectingFromId] && (
              <line style={{ stroke: C.accent }}
                x1={positions[connectingFromId].x + NODE_WIDTH}
                y1={positions[connectingFromId].y + NODE_HEIGHT / 2}
                x2={mousePos.x}
                y2={mousePos.y}
               
                strokeWidth="2.5"
                strokeDasharray="4,4"
                markerEnd="url(#workflow-arrow-active)"
              />
            )}
          </svg>

          {/* HTML Status Nodes Layer */}
          {statuses.map((status) => {
            const pos = positions[status.id] || { x: 0, y: 0 };
            const style = CATEGORY_STYLES[status.category] || CATEGORY_STYLES.TODO;
            const isSelected = selectedStatusId === status.id;
            const isConnectSource = connectingFromId === status.id;
            const isDragging = draggingNodeId === status.id;
            const isAllIncoming = globalTransitionStatusIds.has(status.id);

            // Incoming / Outgoing counts
            const outgoingCount = transitions.filter((t) => t.fromId === status.id).length;
            const incomingCount = transitions.filter((t) => t.toId === status.id).length;

            return (
              <div
                key={status.id}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  width: `${NODE_WIDTH}px`,
                  height: `${NODE_HEIGHT}px`,
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, status.id)}
                onClick={(e) => handleTargetNodeClick(e, status.id)}
                className={`absolute rounded-lg border-2 bg-white shadow-xs transition-shadow cursor-move z-20 select-none ${
                  style.border
                } ${
                  isSelected ? "ring-2 ring-accent ring-offset-2 border-accent shadow-md" : ""
                } ${
                  isConnectSource ? "ring-2 ring-accent bg-blue-50/50" : ""
                } ${
                  isDragging ? "opacity-90 shadow-xl" : ""
                } ${
                  isAllIncoming ? "ring-1 ring-accent/30" : ""
                }`}
              >
                {/* Node Card Header */}
                <div
                  className={`h-7 px-2.5 rounded-t-md flex items-center justify-between border-b border-subtle ${style.headerBg}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                      style={{ backgroundColor: status.color || style.accent }}
                    />
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-px rounded-full ${style.badgeBg} ${style.badgeText}`}
                    >
                      {style.label}
                    </span>
                  </div>

                  {isAllIncoming ? (
                    <span
                      className="text-[9px] font-bold text-accent bg-blue-100/90 border border-accent/30 px-1.5 py-px rounded flex items-center gap-0.5 shrink-0"
                      title="Issues in any status can transition directly to this status (General Start)"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-accent" />
                      <span>General Start</span>
                    </span>
                  ) : status.isBacklog ? (
                    <span className="text-[9px] font-semibold text-muted bg-subtle/80 px-1.5 py-px rounded">
                      Backlog
                    </span>
                  ) : null}
                </div>

                {/* Node Card Body */}
                <div className="p-2 flex flex-col justify-between h-[52px]">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-bold text-ink truncate" title={status.name}>
                      {prettifyStatusName(status.name)}
                    </h4>
                    {status.wipLimit !== null && (
                      <span className="text-[10px] font-semibold text-muted bg-surface-sunk px-1 rounded">
                        WIP: {status.wipLimit}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted pt-0.5">
                    <span className="flex items-center gap-1">
                      {isAllIncoming ? (
                        <span className="font-bold text-accent" title="Can be transitioned into from any status">
                          ALL in
                        </span>
                      ) : (
                        <>
                          <span className="font-semibold text-ink">{incomingCount}</span> in
                        </>
                      )}
                      &bull; <span className="font-semibold text-ink">{outgoingCount}</span> out
                    </span>

                    {/* Quick Connect Action */}
                    {canManage && (
                      <button
                        type="button"
                        onClick={(e) => handleStartConnect(e, status.id)}
                        className="text-accent hover:text-accent-hover hover:underline font-semibold flex items-center gap-0.5"
                        title="Connect transition from this status"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>Connect</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Output Connector Port (Click/Drag Handle) */}
                {canManage && (
                  <div
                    onMouseDown={(e) => handleStartConnect(e, status.id)}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface border-2 border-accent hover:bg-accent text-accent hover:text-accent-fg flex items-center justify-center cursor-crosshair shadow-sm transition-colors z-30 group"
                    title="Drag or click to connect to another status"
                  >
                    <Plus className="w-3 h-3 transition-transform group-hover:scale-125" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Status Inspector Drawer / Panel */}
      {selectedStatus && (
        <div className="border-t border-subtle bg-white p-4 shrink-0 z-30 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-subtle">
            <div className="flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                style={{ backgroundColor: selectedStatus.color || C.muted }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-ink">
                    {prettifyStatusName(selectedStatus.name)}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-sunk text-ink-2 uppercase">
                    {selectedStatus.category}
                  </span>
                  {globalTransitionStatusIds.has(selectedStatus.id) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-accent border border-accent/30 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-accent" />
                      General Start
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted">
                  {globalTransitionStatusIds.has(selectedStatus.id)
                    ? `Issues in any status can transition directly to "${selectedStatus.name}". A general start indicator points to this node on the graph.`
                    : `Configure which statuses an issue in "${selectedStatus.name}" can transition to or from.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onAllowAllIncoming && canManage && (
                <button
                  type="button"
                  onClick={() => onAllowAllIncoming(selectedStatus.id)}
                  disabled={globalTransitionStatusIds.has(selectedStatus.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded border flex items-center gap-1.5 transition-colors ${
                    globalTransitionStatusIds.has(selectedStatus.id)
                      ? "text-emerald-700 bg-emerald-50 border-emerald-300 cursor-default opacity-90"
                      : "text-accent bg-accent/10 hover:bg-accent/20 border-accent/30 cursor-pointer"
                  }`}
                  title={
                    globalTransitionStatusIds.has(selectedStatus.id)
                      ? "All other statuses can already transition to this status"
                      : "Allow all other statuses to transition to this status"
                  }
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {globalTransitionStatusIds.has(selectedStatus.id)
                      ? "All can transition here (Active)"
                      : "Allow all to transition here"}
                  </span>
                </button>
              )}

              {onClearTransitions && canManage && (
                <button
                  type="button"
                  onClick={() => onClearTransitions(selectedStatus.id)}
                  className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded border border-rose-200 transition-colors"
                  title="Remove all transitions for this status"
                >
                  Clear Transitions
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedStatusId(null)}
                className="p-1 text-muted hover:text-ink rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Transition Toggles Grid */}
          <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Outgoing Transitions */}
            <div>
              <div className="text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-2 flex items-center gap-1">
                <ArrowRight className="w-3 h-3 text-accent" />
                Can transition TO:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {statuses
                  .filter((s) => s.id !== selectedStatus.id)
                  .map((target) => {
                    const isAllowed = transitionKeys.has(`${selectedStatus.id}:${target.id}`);
                    return (
                      <button
                        key={target.id}
                        type="button"
                        disabled={!canManage}
                        onClick={() => onToggleTransition(selectedStatus.id, target.id, !isAllowed)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                          isAllowed
                            ? "bg-accent text-accent-fg border-accent font-semibold shadow-2xs"
                            : "bg-white text-ink-2 border-subtle hover:border-accent hover:text-accent"
                        } disabled:opacity-50`}
                      >
                        {isAllowed && <Check className="w-3 h-3" />}
                        <span>{prettifyStatusName(target.name)}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Incoming Transitions */}
            <div>
              <div className="text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-2 flex items-center gap-1">
                <ArrowRight className="w-3 h-3 text-emerald-600 rotate-180" />
                Can transition FROM:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {statuses
                  .filter((s) => s.id !== selectedStatus.id)
                  .map((source) => {
                    const isAllowed = transitionKeys.has(`${source.id}:${selectedStatus.id}`);
                    return (
                      <button
                        key={source.id}
                        type="button"
                        disabled={!canManage}
                        onClick={() => onToggleTransition(source.id, selectedStatus.id, !isAllowed)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                          isAllowed
                            ? "bg-emerald-600 text-white border-emerald-600 font-semibold shadow-2xs"
                            : "bg-white text-ink-2 border-subtle hover:border-emerald-600 hover:text-emerald-700"
                        } disabled:opacity-50`}
                      >
                        {isAllowed && <Check className="w-3 h-3" />}
                        <span>{prettifyStatusName(source.name)}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Canvas Footer Legend */}
      <div className="px-4 py-2 bg-slate-50 border-t border-subtle flex flex-wrap items-center justify-between text-[11px] text-muted gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            To Do
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent" />
            In Progress
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Done
          </span>
          <span className="text-muted">|</span>
          <span className="flex items-center gap-1.5 font-medium text-ink">
            <span className="w-3.5 h-3.5 rounded-full bg-slate-900 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
            </span>
            General Start (from any status)
          </span>
          <span className="text-muted">|</span>
          <span>
            Click <strong>+</strong> or drag connector to create arrow &bull; Click arrow <strong>✕</strong> to delete
          </span>
        </div>
        <span className="text-muted hidden sm:inline">Drag cards to arrange &bull; Click card to inspect</span>
      </div>
    </div>
  );
}
