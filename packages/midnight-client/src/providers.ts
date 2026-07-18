/**
 * Midnight.js providers for RecallLens, adapted from the official
 * create-mn-app scaffold (wallet-sdk 1.2.0 / midnight-js 4.1.1).
 */
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as fs from "node:fs";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import type { NetworkConfig } from "./network";
import type { WalletContext } from "./wallet";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Path to the compiled contract's managed assets (contract + zkir + keys). */
export function zkConfigPath(): string {
  // packages/midnight-client/src → packages/contract/src/managed/recalllens
  return path.resolve(
    __dirname,
    "..",
    "..",
    "contract",
    "src",
    "managed",
    "recalllens",
  );
}

export async function loadCompiledContract(witnesses: any) {
  const cfg = zkConfigPath();
  const contractPath = path.join(cfg, "contract", "index.js");
  if (!fs.existsSync(contractPath)) {
    throw new Error(
      `Compiled contract missing at ${contractPath}. Run: npm run compile:contract`,
    );
  }
  const mod = await import(pathToFileURL(contractPath).href);
  // make(tag, ctor) takes the Contract CLASS (constructor), then witnesses are
  // attached via withWitnesses, then the compiled ZK assets path. The compiled
  // module is imported dynamically (untyped); the effect combinators are
  // strongly typed against the phantom context type, so we thread through `any`
  // here. The runtime shape is validated by the on-chain e2e run.
  const make = CompiledContract.make as any;
  const withWitnesses = CompiledContract.withWitnesses as any;
  const withCompiledFileAssets = CompiledContract.withCompiledFileAssets as any;
  const base = make("recalllens", mod.Contract);
  return base.pipe(withWitnesses(witnesses), withCompiledFileAssets(cfg));
}

export function createProviders(
  walletCtx: WalletContext,
  networkConfig: NetworkConfig,
) {
  const privateStatePassword =
    process.env.PRIVATE_STATE_PASSWORD?.trim() ||
    "Local-Devnet-Development-Placeholder-1";

  const walletProvider = {
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        {
          shieldedSecretKeys: walletCtx.shieldedSecretKeys,
          dustSecretKey: walletCtx.dustSecretKey,
        },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath());
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: "recalllens-state",
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(
      networkConfig.indexer,
      networkConfig.indexerWS,
    ),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(
      networkConfig.proofServer,
      zkConfigProvider,
    ),
    walletProvider,
    midnightProvider: walletProvider,
  };
}
