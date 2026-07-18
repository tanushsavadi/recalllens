/**
 * Deterministic physical-demo label definitions.
 *
 * Each label encodes ONLY public lookup keys (GTIN + lot + expiry) as a GS1
 * Digital Link. No lineage token, secret, seed, or org secret is ever on the
 * label — the private lineage token lives only in the partner vault and is
 * resolved from GTIN+lot at scan time.
 */
import { buildGs1DigitalLink, type Gs1Data } from "@recalllens/gs1";

export const LABEL_BASE = "https://id.recalllens.demo";

export interface DemoLabel {
  id: "affected" | "control";
  title: string;
  subtitle: string;
  data: Gs1Data;
  synthetic: true;
}

/** Affected retail lot — Northstar's processed lot (maps to the affected lineage). */
export const LABEL_AFFECTED: DemoLabel = {
  id: "affected",
  title: "Affected demonstration label",
  subtitle: "Scanning this triggers the live convergence proof",
  data: {
    gtin: "00810099110042",
    lot: "NFP-SHRED-26164-07",
    expiry: "2026-06-28",
  },
  synthetic: true,
};

/** Control lot — the clean Sierra Verde lot (no intersection). */
export const LABEL_CONTROL: DemoLabel = {
  id: "control",
  title: "Control (unaffected) demonstration label",
  subtitle: "Scanning this returns no verified intersection",
  data: {
    gtin: "00810099110042",
    lot: "SVG-ICE-26171-B",
    expiry: "2026-07-05",
  },
  synthetic: true,
};

export const DEMO_LABELS: DemoLabel[] = [LABEL_AFFECTED, LABEL_CONTROL];

export function labelDigitalLink(label: DemoLabel): string {
  return buildGs1DigitalLink(LABEL_BASE, label.data);
}
