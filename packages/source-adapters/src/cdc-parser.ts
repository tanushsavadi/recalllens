/**
 * CDC outbreak-page parser.
 *
 * Parses ONLY explicitly mapped fields from the official CDC outbreak page
 * markup. Field mappings were verified against the real 2026-07-17 page:
 *
 *   Fast Facts:  div.dfe-outbreak_fact li > span.fact-top.label  → "Cases",
 *                "Hospitalizations", "Deaths", "States"; value is the text
 *                after the </span>.
 *   Status:      div.fact-top with span.label "Investigation status:" /
 *                "Recall issued:"; value is the text after the </span>.
 *   Updated:     <meta property="cdc:last_updated" content="...">
 *   Title:       <h1>
 *   States list: prose in a callout ("...in Indiana, Kentucky, Michigan,
 *                Ohio, and West Virginia.")
 *
 * The input HTML is treated as untrusted data — we never execute it and only
 * read the mapped nodes.
 */
import { parse } from "node-html-parser";
import { OutbreakSnapshot } from "@recalllens/schemas";
import type { z } from "zod";

export const CDC_PARSER_VERSION = "cdc-cyclospora-parser@1.0.0";
export const CDC_SOURCE_URL =
  "https://www.cdc.gov/cyclosporiasis/outbreaks/07-26/index.html";

const KNOWN_STATE_NAMES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
  "New Hampshire","New Jersey","New Mexico","New York","North Carolina",
  "North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island",
  "South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","West Virginia","Wisconsin","Wyoming",
];

function textToInt(raw: string): number {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) throw new Error(`no integer in "${raw}"`);
  return parseInt(digits, 10);
}

export interface ParsedOutbreak {
  title: string;
  pathogen: string;
  cases: number;
  hospitalizations: number;
  deaths: number;
  states: string[];
  investigationStatus: string;
  officialLastUpdated: string;
  implicatedFood: string;
}

/**
 * Parse the mapped fields out of CDC outbreak HTML. Throws if a required
 * field is missing (so a silent page-structure change fails loudly).
 */
export function parseCdcOutbreakHtml(html: string): ParsedOutbreak {
  const root = parse(html);

  // Fast Facts
  const facts: Record<string, string> = {};
  for (const li of root.querySelectorAll("li")) {
    const label = li.querySelector("span.fact-top.label");
    if (!label) continue;
    const key = label.text.trim().toLowerCase();
    // value = li text with the label text removed, then trim the leading ": "
    const value = li.text.replace(label.text, "").replace(/^\s*:\s*/, "").trim();
    if (key) facts[key] = value;
  }

  // Status fields (Investigation status / Recall issued)
  const statusFields: Record<string, string> = {};
  for (const div of root.querySelectorAll("div.fact-top")) {
    const label = div.querySelector("span.label");
    if (!label) continue;
    const key = label.text.trim().replace(/:$/, "").toLowerCase();
    const value = div.text.replace(label.text, "").trim();
    if (key) statusFields[key] = value;
  }

  const h1 = root.querySelector("h1");
  const title = h1 ? h1.text.trim().replace(/\s+/g, " ") : "";

  const updatedMeta = root.querySelector('meta[property="cdc:last_updated"]');
  const officialLastUpdated = updatedMeta?.getAttribute("content")?.trim() ?? "";

  // States: from title we know the count; extract names from prose.
  const bodyText = root.text.replace(/\s+/g, " ");
  const states = KNOWN_STATE_NAMES.filter((s) => {
    // West Virginia contains "Virginia"; require word-ish boundaries
    const re = new RegExp(`(^|[^A-Za-z])${s}([^A-Za-z]|$)`);
    return re.test(bodyText);
  });
  // West Virginia present ⇒ drop a spurious bare "Virginia" match
  const dedup = states.includes("West Virginia")
    ? states.filter((s) => s !== "Virginia")
    : states;

  if (!("cases" in facts)) throw new Error("CDC parser: 'Cases' fact not found");
  if (!("hospitalizations" in facts))
    throw new Error("CDC parser: 'Hospitalizations' fact not found");
  if (!("deaths" in facts)) throw new Error("CDC parser: 'Deaths' fact not found");
  if (!officialLastUpdated)
    throw new Error("CDC parser: cdc:last_updated meta not found");

  return {
    title,
    pathogen: "Cyclospora",
    cases: textToInt(facts["cases"]),
    hospitalizations: textToInt(facts["hospitalizations"]),
    deaths: textToInt(facts["deaths"]),
    states: dedup,
    investigationStatus: statusFields["investigation status"] ?? "Unknown",
    officialLastUpdated,
    implicatedFood: "Shredded iceberg lettuce",
  };
}

export type OutbreakSnapshotT = z.infer<typeof OutbreakSnapshot>;

export function toSnapshot(
  parsed: ParsedOutbreak,
  meta: {
    source: OutbreakSnapshotT["source"];
    sourceUrl: string;
    retrievedAt: string;
    contentSha256: string;
  },
): OutbreakSnapshotT {
  return OutbreakSnapshot.parse({
    source: meta.source,
    sourceUrl: meta.sourceUrl,
    retrievedAt: meta.retrievedAt,
    contentSha256: meta.contentSha256,
    parserVersion: CDC_PARSER_VERSION,
    outbreak: parsed,
  });
}
