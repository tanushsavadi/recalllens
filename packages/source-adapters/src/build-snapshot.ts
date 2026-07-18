/**
 * Build the checked-in cached CDC snapshot from the raw archived HTML.
 *
 * Run: npm run snapshot -w @recalllens/source-adapters
 *
 * Produces fixtures/cdc-cyclospora-07-26.snapshot.json — a validated,
 * timestamped OutbreakSnapshot the app falls back to when the live CDC page
 * is unreachable (it blocks datacenter scraping via Akamai; see
 * docs/SOURCE_PROVENANCE.md).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCdcOutbreakHtml, toSnapshot, CDC_SOURCE_URL } from "./cdc-parser";
import { sha256Hex } from "./sha256";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "..", "fixtures");
const rawPath = path.join(fixturesDir, "cdc-cyclospora-07-26.raw.html");
const outPath = path.join(fixturesDir, "cdc-cyclospora-07-26.snapshot.json");

// The raw HTML was archived from the official CDC page via the Internet
// Archive at this instant (see docs/SOURCE_PROVENANCE.md). We record that as
// the retrieval time of the cached content.
const ARCHIVE_RETRIEVED_AT = "2026-07-18T03:34:30Z";

function main() {
  const html = fs.readFileSync(rawPath, "utf-8");
  const parsed = parseCdcOutbreakHtml(html);
  const snapshot = toSnapshot(parsed, {
    source: "cached-snapshot",
    sourceUrl: CDC_SOURCE_URL,
    retrievedAt: ARCHIVE_RETRIEVED_AT,
    contentSha256: sha256Hex(html),
  });
  fs.writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log("Wrote", outPath);
  console.log(JSON.stringify(snapshot.outbreak, null, 2));
}

main();
