import { describe, it, expect } from "vitest";
import {
  parseGs1ElementString,
  parseGs1DigitalLink,
  parseScan,
  buildGs1DigitalLink,
  buildGs1ElementStringHuman,
  yymmddToIso,
  isoToYymmdd,
  gtinValid,
} from "../src/gs1";

const GS = "\x1d";
const GTIN = "00810099110042";

describe("GS1 element string parsing", () => {
  it("parses bracketed form", () => {
    const d = parseGs1ElementString(`(01)${GTIN}(10)NFP-SHRED-26164-07(17)260628`);
    expect(d.gtin).toBe(GTIN);
    expect(d.lot).toBe("NFP-SHRED-26164-07");
    expect(d.expiry).toBe("2026-06-28");
  });

  it("parses raw concatenated form with FNC1 separator", () => {
    // 01 + gtin(14) + 10 + lot + GS + 17 + yymmdd
    const raw = `01${GTIN}10NFP-SHRED-26164-07${GS}17260628`;
    const d = parseGs1ElementString(raw);
    expect(d.gtin).toBe(GTIN);
    expect(d.lot).toBe("NFP-SHRED-26164-07");
    expect(d.expiry).toBe("2026-06-28");
  });

  it("parses raw form where lot is last (no trailing GS)", () => {
    const raw = `01${GTIN}17260628` + `10SVG-ICE-26171-B`;
    const d = parseGs1ElementString(raw);
    expect(d.gtin).toBe(GTIN);
    expect(d.expiry).toBe("2026-06-28");
    expect(d.lot).toBe("SVG-ICE-26171-B");
  });
});

describe("GS1 Digital Link parsing", () => {
  it("parses path form", () => {
    const d = parseGs1DigitalLink(
      `https://id.recalllens.demo/01/${GTIN}/10/NFP-SHRED-26164-07/17/260628`,
    );
    expect(d.gtin).toBe(GTIN);
    expect(d.lot).toBe("NFP-SHRED-26164-07");
    expect(d.expiry).toBe("2026-06-28");
  });

  it("tolerates a trailing slash and a bare path", () => {
    const d = parseGs1DigitalLink(`/01/${GTIN}/10/LOT9/`);
    expect(d.gtin).toBe(GTIN);
    expect(d.lot).toBe("LOT9");
  });

  it("reads AIs from query params", () => {
    const d = parseGs1DigitalLink(
      `https://id.recalllens.demo/01/${GTIN}?10=LOTQ&17=270101`,
    );
    expect(d.lot).toBe("LOTQ");
    expect(d.expiry).toBe("2027-01-01");
  });

  it("decodes URI-encoded lot", () => {
    const d = parseGs1DigitalLink(
      `https://id.recalllens.demo/01/${GTIN}/10/LOT%2F1`,
    );
    expect(d.lot).toBe("LOT/1");
  });
});

describe("round-trip build ↔ parse", () => {
  it("digital link round-trips", () => {
    const data = { gtin: GTIN, lot: "NFP-SHRED-26164-07", expiry: "2026-06-28" };
    const link = buildGs1DigitalLink("https://id.recalllens.demo", data);
    expect(parseGs1DigitalLink(link)).toEqual(data);
  });
  it("element string round-trips", () => {
    const data = { gtin: GTIN, lot: "SVG-ICE-26171-B", expiry: "2026-07-05" };
    const el = buildGs1ElementStringHuman(data);
    expect(parseGs1ElementString(el)).toEqual(data);
  });
});

describe("validation + conversions", () => {
  it("rejects an invalid GTIN", () => {
    expect(() => parseGs1ElementString("(01)123(10)X")).toThrow();
    expect(gtinValid("00810099110042")).toBe(true);
    expect(gtinValid("123")).toBe(false);
  });
  it("converts YYMMDD ↔ ISO", () => {
    expect(yymmddToIso("260628")).toBe("2026-06-28");
    expect(isoToYymmdd("2026-06-28")).toBe("260628");
  });
});

describe("parseScan dispatch", () => {
  it("dispatches a digital link", () => {
    const r = parseScan(`https://id.recalllens.demo/01/${GTIN}/10/L`);
    expect(r.format).toBe("digital-link");
    expect(r.data.gtin).toBe(GTIN);
  });
  it("dispatches an element string", () => {
    const r = parseScan(`(01)${GTIN}(10)L(17)260628`);
    expect(r.format).toBe("element-string");
    expect(r.data.expiry).toBe("2026-06-28");
  });
});
