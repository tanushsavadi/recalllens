/**
 * Animated convergence graph.
 *
 * Three anonymized organization paths (farm → processor → distributor) each
 * lead to a shared "COMMON LINEAGE" node. Each path lights up green only when
 * that organization's private proof is CONFIRMED on-chain — the visual is
 * driven by real proof state, not a canned animation. When the third proof
 * confirms, the lineage node enters a restrained verified state.
 */
import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { OrgProof } from "@recalllens/schemas";

const STAGE_COLOR: Record<string, string> = {
  confirmed: "#1f9d63",
  proving: "#d98a04",
  "building-witness": "#d98a04",
  submitting: "#d98a04",
  queued: "#64748b",
  failed: "#c8352b",
};

function orgLabel(role: string) {
  // Anonymized labels — no real identities in the graph. Each node stands for
  // an organization plus its committed private trace event.
  const map: Record<string, string> = {
    farm: "Grower (anon.)",
    processor: "Processor (anon.)",
    distributor: "Distributor (anon.)",
    restaurant: "Restaurant (anon.)",
  };
  return map[role] ?? "Organization";
}

export function ConvergenceGraph({
  proofs,
  converged,
}: {
  proofs: OrgProof[];
  converged: boolean;
}) {
  const { nodes, edges } = useMemo(() => {
    // Use up to 3 org paths for the convergence visual.
    const paths = proofs.slice(0, 3);
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const yFor = (i: number) => 20 + i * 100;
    const NODE_W = 200;
    const NODE_H = 52;

    paths.forEach((p, i) => {
      const color = STAGE_COLOR[p.stage] ?? "#64748b";
      const confirmed = p.stage === "confirmed";
      const active = ["proving", "building-witness", "submitting"].includes(
        p.stage,
      );
      const orgId = `org-${i}`;

      // Two-column layout: anonymized org (with its committed event) → lineage.
      nodes.push({
        id: orgId,
        position: { x: 40, y: yFor(i) },
        width: NODE_W,
        height: NODE_H,
        data: {
          label: confirmed
            ? `${orgLabel(p.role)} ✓`
            : orgLabel(p.role),
        },
        sourcePosition: Position.Right,
        style: nodeStyle(color, confirmed),
      });

      edges.push(
        edge(`${orgId}-lineage`, orgId, "lineage", color, active || confirmed, confirmed),
      );
    });

    nodes.push({
      id: "lineage",
      position: { x: 420, y: yFor(1) },
      width: 200,
      height: 72,
      data: {
        label: converged ? "COMMON LINEAGE ✓ VERIFIED" : "COMMON LINEAGE",
      },
      targetPosition: Position.Left,
      style: lineageStyle(converged),
    });

    return { nodes, edges };
  }, [proofs, converged]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      defaultViewport={{ x: 70, y: 60, zoom: 0.92 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      preventScrolling={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#1f2a4d" gap={20} />
    </ReactFlow>
  );
}

function nodeStyle(color: string, confirmed: boolean): React.CSSProperties {
  return {
    background: confirmed ? "#0c5c38" : "#111830",
    color: "#e2e8f0",
    border: `2px solid ${color}`,
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    width: 200,
    height: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as const,
    padding: "6px 12px",
    boxShadow: confirmed ? `0 0 0 4px ${color}22` : "none",
  };
}

function lineageStyle(converged: boolean): React.CSSProperties {
  return {
    background: converged ? "#1f9d63" : "#161e3a",
    color: "#ffffff",
    border: `2px solid ${converged ? "#7fe3ac" : "#2b3a66"}`,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 800,
    width: 200,
    height: 72,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px",
    textAlign: "center" as const,
    boxShadow: converged ? "0 0 0 6px #1f9d6333" : "none",
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  color: string,
  animated: boolean,
  strong = false,
): Edge {
  return {
    id,
    source,
    target,
    animated,
    style: {
      stroke: color,
      strokeWidth: strong ? 3 : 1.5,
      opacity: animated ? 1 : 0.35,
    },
    markerEnd: { type: MarkerType.ArrowClosed, color },
  };
}
