#!/usr/bin/env node
/**
 * RecallLens health check — verifies the pieces the demo depends on.
 * Exits non-zero if a required service is down. Read-only.
 */
const checks = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, ok: true, detail });
  } catch (e) {
    checks.push({ name, ok: false, detail: e?.message ?? String(e) });
  }
}

async function httpOk(url, opts = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(3000), ...opts });
  return `HTTP ${res.status}`;
}

await check("midnight-node :9944", () => httpOk("http://127.0.0.1:9944/health"));
await check("proof-server :6300", () => httpOk("http://127.0.0.1:6300/health"));
await check("indexer :8088", async () => {
  const res = await fetch("http://127.0.0.1:8088/api/v4/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "{ __typename }" }),
    signal: AbortSignal.timeout(3000),
  });
  return `HTTP ${res.status}`;
});
await check("public-data-api :8787", () =>
  httpOk("http://127.0.0.1:8787/api/health"),
);

let allOk = true;
for (const c of checks) {
  if (!c.ok) allOk = false;
  console.log(`${c.ok ? "✓" : "✗"} ${c.name.padEnd(28)} ${c.detail}`);
}
console.log(allOk ? "\nAll checks passed." : "\nSome checks failed.");
process.exit(allOk ? 0 : 1);
