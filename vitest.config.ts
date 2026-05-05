import path from "node:path";
import {
  defineWorkersConfig,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(
    path.resolve(__dirname, "src/db/migrations")
  );

  return {
    resolve: {
      alias: {
        tslib: path.resolve(__dirname, "node_modules/tslib/tslib.es6.mjs"),
      },
    },
    test: {
      globals: true,
      include: ["test/**/*.test.ts"],
      hookTimeout: 30000,
      // vitest-pool-workers' isolated-storage feature flakes occasionally
      // with "Network connection lost" on heavy D1 workloads (gdpr-cascade
      // is the most common victim). --max-workers=1 --no-isolate flags in
      // package.json reduce the rate substantially but don't eliminate it.
      // Auto-retry covers the residual flake without papering over real
      // failures: a genuinely-broken test fails all 3 attempts.
      retry: 2,
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            kvNamespaces: ["SC_BRIDGE_CACHE", "LOCALIZATION_KV"],
            bindings: {
              TEST_MIGRATIONS: migrations,
              ENVIRONMENT: "test",
              ENCRYPTION_KEY: "dGVzdC1lbmNyeXB0aW9uLWtleS1mb3Itdml0ZXN0IXQ=",
              BETTER_AUTH_SECRET: "test-secret-value-for-testing-xx",
              BETTER_AUTH_URL: "http://localhost:8787",
            },
          },
        },
      },
    },
  };
});
