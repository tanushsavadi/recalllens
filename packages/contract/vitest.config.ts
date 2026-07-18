import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // ZK-free simulator runs are fast, but give proof-less circuit execution room.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
