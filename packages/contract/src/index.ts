// @recalllens/contract — public barrel.
//
// Re-exports the compiled contract API and the TypeScript witness layer so that
// downstream packages (midnight-client, the API layer, the web app) import
// everything from "@recalllens/contract".
//
// Reachable from here:
//   - Contract, ledger, pureCircuits             (compiled contract runtime)
//   - Ledger, TraceEvent, CaseInfo, SafetySignal,
//     SentinelCaseInfo, Witnesses, ImpureCircuits,
//     PureCircuits, ...                           (generated types)
//   - witnesses, createRecallLensPrivateState,
//     RecallLensPrivateState                      (witness layer)
//
// CLIENT/CIRCUIT HASH PARITY: compute eventCommitment / orgCommitment / caseTag /
// orgNullifier — and the SENTINEL derivations signalCommitment / sentinelTag /
// signalNullifier — via the re-exported `pureCircuits` object only, never a bespoke
// JS hash, so off-chain values match the in-circuit derivations byte-for-byte.

export * from "./managed/recalllens/contract/index.js";
export * from "./witnesses.js";
