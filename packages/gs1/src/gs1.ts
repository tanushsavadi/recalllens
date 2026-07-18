/**
 * Minimal GS1 parser for RecallLens physical demo labels.
 *
 * Supports the three Application Identifiers we use:
 *   AI 01 = GTIN (14 digits)
 *   AI 10 = batch/lot (variable length, FNC1-terminated)
 *   AI 17 = expiration date (YYMMDD)
 *
 * Handles three input shapes:
 *   - bracketed human element string: "(01)00810099110042(10)LOT(17)261231"
 *   - raw concatenated element string with FNC1 (GS, \x1d) separators
 *   - GS1 Digital Link URI: ".../01/00810099110042/10/LOT/17/261231"
 *
 * All input is treated as untrusted DATA — parsed, never executed.
 */

export interface Gs1Data {
  gtin: string;
  lot?: string;
  /** ISO date "YYYY-MM-DD" */
  expiry?: string;
}

const GS = "\x1d"; // FNC1 group separator
/** AI 17 is fixed-length (6). AI 01 is fixed-length (14). AI 10 is variable. */
const FIXED_LEN: Record<string, number> = { "01": 14, "17": 6 };

export function gtinValid(gtin: string): boolean {
  return /^\d{14}$/.test(gtin);
}

/** YYMMDD → ISO "YYYY-MM-DD" (20YY assumed, matching GS1 date-window rules). */
export function yymmddToIso(yymmdd: string): string {
  if (!/^\d{6}$/.test(yymmdd)) throw new Error(`invalid YYMMDD: ${yymmdd}`);
  const yy = Number(yymmdd.slice(0, 2));
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  // GS1: day "00" means end-of-month; we keep it literal for the demo.
  const year = 2000 + yy;
  return `${year}-${mm}-${dd}`;
}

export function isoToYymmdd(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`invalid ISO date: ${iso}`);
  return `${m[1].slice(2)}${m[2]}${m[3]}`;
}

function finalize(d: Partial<Gs1Data>): Gs1Data {
  if (!d.gtin || !gtinValid(d.gtin)) {
    throw new Error(`GS1: missing or invalid GTIN (AI 01): ${d.gtin ?? "—"}`);
  }
  return { gtin: d.gtin, lot: d.lot, expiry: d.expiry };
}

/** Parse a bracketed OR raw (FNC1) element string. */
export function parseGs1ElementString(input: string): Gs1Data {
  const s = input.trim();
  const out: Partial<Gs1Data> = {};

  // Bracketed form: (01)...(10)...(17)...
  if (s.includes("(")) {
    const re = /\((\d{2,4})\)([^(]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      applyAi(out, m[1], m[2]);
    }
    return finalize(out);
  }

  // Raw concatenated form with FNC1 separators for variable-length fields.
  let i = 0;
  while (i < s.length) {
    const ai = s.slice(i, i + 2);
    i += 2;
    if (FIXED_LEN[ai] !== undefined) {
      const len = FIXED_LEN[ai];
      applyAi(out, ai, s.slice(i, i + len));
      i += len;
    } else {
      // variable length → up to next GS or end of string
      const gsIdx = s.indexOf(GS, i);
      const end = gsIdx === -1 ? s.length : gsIdx;
      applyAi(out, ai, s.slice(i, end));
      i = gsIdx === -1 ? s.length : gsIdx + 1;
    }
  }
  return finalize(out);
}

function applyAi(out: Partial<Gs1Data>, ai: string, value: string) {
  const v = value.replace(new RegExp(GS, "g"), "").trim();
  if (ai === "01") out.gtin = v;
  else if (ai === "10") out.lot = v;
  else if (ai === "17") out.expiry = yymmddToIso(v);
  // other AIs ignored for this demo
}

/** Parse a GS1 Digital Link URI. */
export function parseGs1DigitalLink(url: string): Gs1Data {
  let path: string;
  let search = "";
  try {
    const u = new URL(url);
    path = u.pathname;
    search = u.search;
  } catch {
    // not a full URL — treat as a bare path
    const q = url.indexOf("?");
    path = q === -1 ? url : url.slice(0, q);
    search = q === -1 ? "" : url.slice(q);
  }

  const segs = path.split("/").filter(Boolean);
  const out: Partial<Gs1Data> = {};
  for (let i = 0; i + 1 < segs.length; i += 2) {
    applyAi(out, segs[i], decodeURIComponent(segs[i + 1]));
  }
  // AIs may also arrive as query params (?17=261231)
  if (search) {
    const params = new URLSearchParams(search);
    for (const [k, val] of params) applyAi(out, k, decodeURIComponent(val));
  }
  return finalize(out);
}

export interface ScanParseResult {
  data: Gs1Data;
  format: "digital-link" | "element-string";
}

/** Dispatch on a raw scanned payload (URL vs element string). */
export function parseScan(raw: string): ScanParseResult {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s) || (s.includes("/01/") && !s.includes("(") && !s.includes(GS))) {
    return { data: parseGs1DigitalLink(s), format: "digital-link" };
  }
  return { data: parseGs1ElementString(s), format: "element-string" };
}

/** Build a canonical GS1 Digital Link path form under a base URL. */
export function buildGs1DigitalLink(base: string, d: Gs1Data): string {
  if (!gtinValid(d.gtin)) throw new Error(`invalid GTIN: ${d.gtin}`);
  const root = base.replace(/\/+$/, "");
  let out = `${root}/01/${d.gtin}`;
  if (d.lot) out += `/10/${encodeURIComponent(d.lot)}`;
  if (d.expiry) out += `/17/${isoToYymmdd(d.expiry)}`;
  return out;
}

/** Build a bracketed human-readable element string. */
export function buildGs1ElementStringHuman(d: Gs1Data): string {
  if (!gtinValid(d.gtin)) throw new Error(`invalid GTIN: ${d.gtin}`);
  let out = `(01)${d.gtin}`;
  if (d.lot) out += `(10)${d.lot}`;
  if (d.expiry) out += `(17)${isoToYymmdd(d.expiry)}`;
  return out;
}
