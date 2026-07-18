/**
 * FDA outbreak-advisory page parser.
 *
 * Parses ONLY explicitly mapped fields from FDA investigation pages. Mappings
 * verified against the real 2026-07-18 markup of both pages:
 *   - Product/Status/Stores blocks:  <h2>Product:</h2><p>…</p> siblings inside
 *     div.inset-column
 *   - Case counts:  <h2>Case Counts</h2><p>Total Illnesses: N<br>…</p>
 *   - Last updated: <li class="node-current-date"> <time datetime="…">
 *
 * Input HTML is untrusted data — parsed, never executed.
 */
import { parse } from "node-html-parser";

export const FDA_PARSER_VERSION = "fda-advisory-parser@1.0.0";

export const FDA_LETTUCE_URL =
  "https://www.fda.gov/food/outbreaks-foodborne-illness/investigation-5-state-outbreak-cyclospora-illnesses-iceberg-lettuce-july-2026";
export const FDA_BLUEBERRIES_URL =
  "https://www.fda.gov/food/outbreaks-foodborne-illness/outbreak-investigation-e-coli-frozen-blueberries-july-2026";

export interface FdaAdvisory {
  title: string;
  productDescription: string;
  status: string;
  storesAffected: string;
  totalIllnesses: number | null;
  hospitalizations: number | null;
  deaths: number | null;
  lastUpdated: string; // ISO date from <time datetime>
  /** structured recall identifiers when the page prints them */
  recall: {
    brand: string | null;
    packageSize: string | null;
    lotCode: string | null;
    bestByDate: string | null; // as printed, e.g. "February 9, 2028"
    recallingFirm: string | null;
    distributionStates: string[];
  };
}

function sectionText(root: ReturnType<typeof parse>, heading: string): string {
  for (const h2 of root.querySelectorAll("h2")) {
    if (h2.text.trim().replace(/\s+/g, " ").startsWith(heading)) {
      const p = h2.nextElementSibling;
      if (p) return p.text.replace(/\s+/g, " ").trim();
    }
  }
  return "";
}

function countFrom(caseCounts: string, label: string): number | null {
  const m = caseCounts.match(new RegExp(`${label}:\\s*([\\d,]+)`));
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : null;
}

const STATE_NAMES: Record<string, string> = {
  Alabama: "AL", Florida: "FL", Georgia: "GA", Kentucky: "KY",
  "North Carolina": "NC", "South Carolina": "SC", Tennessee: "TN",
  Virginia: "VA", Indiana: "IN", Michigan: "MI", Ohio: "OH",
  "West Virginia": "WV",
};

export function parseFdaAdvisoryHtml(html: string): FdaAdvisory {
  const root = parse(html);

  const title =
    root.querySelector("h1.content-title")?.text.replace(/\s+/g, " ").trim() ??
    root.querySelector("h1")?.text.replace(/\s+/g, " ").trim() ??
    "";

  const productDescription = sectionText(root, "Product:");
  const status = sectionText(root, "Status:");
  const storesAffected = sectionText(root, "Stores affected:");

  // Case Counts block
  let caseCountsText = "";
  for (const h2 of root.querySelectorAll("h2")) {
    if (h2.text.trim().startsWith("Case Counts")) {
      caseCountsText = h2.nextElementSibling?.text ?? "";
      break;
    }
  }

  const timeEl = root.querySelector("li.node-current-date time");
  const lastUpdated = timeEl?.getAttribute("datetime") ?? "";

  if (!productDescription) {
    throw new Error("FDA parser: 'Product:' section not found");
  }
  if (!lastUpdated) {
    throw new Error("FDA parser: node-current-date <time> not found");
  }

  // Structured recall identifiers (present on the blueberries page).
  const lotMatch = productDescription.match(/lot code of\s+(\w+)/i);
  const bestByMatch = productDescription.match(
    /Best by Date of\s+([A-Z][a-z]+ \d{1,2},? \d{4})/i,
  );
  const sizeMatch = productDescription.match(/([\d.]+-?\s?oz)\b/i);
  const brandMatch = productDescription.match(
    /frozen\s+([A-Za-z-]+)-brand\s+organic\s+blueberries/i,
  );
  const bodyText = root.text.replace(/\s+/g, " ");
  const firmMatch = bodyText.match(
    /(Frutas y Hortalizas del Sur S\.?A\.?|Taylor Farms de Mexico)/,
  );

  const distributionStates = Object.entries(STATE_NAMES)
    .filter(([name]) => storesAffected.includes(name))
    .map(([, code]) => code);

  return {
    title,
    productDescription,
    status,
    storesAffected,
    totalIllnesses: countFrom(caseCountsText, "Total Illnesses"),
    hospitalizations: countFrom(caseCountsText, "Hospitalizations"),
    deaths: countFrom(caseCountsText, "Deaths"),
    lastUpdated,
    recall: {
      brand: brandMatch ? brandMatch[1] : null,
      packageSize: sizeMatch ? sizeMatch[1].replace(/\s/g, "").replace("-", " ") : null,
      lotCode: lotMatch ? lotMatch[1] : null,
      bestByDate: bestByMatch ? bestByMatch[1].replace(/,?\s/, (s) => s) : null,
      recallingFirm: firmMatch ? firmMatch[1] : null,
      distributionStates,
    },
  };
}
