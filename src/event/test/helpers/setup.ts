import sinon from "sinon";
import * as promClient from "prom-client";

// Poison oracledb require cache immediately (at require-time, before any spec loads it)
// to prevent the native addon from being loaded in the test environment.
try {
  const oracledbPath = require.resolve("oracledb");
  if (!require.cache[oracledbPath]) {
    require.cache[oracledbPath] = {
      id: oracledbPath,
      filename: oracledbPath,
      loaded: true,
      parent: null,
      children: [],
      paths: [],
      exports: {
        getConnection: () => Promise.resolve({}),
        initOracleClient: () => {},
        DB_TYPE_JSON: "JSON",
        OUT_FORMAT_OBJECT: 4008,
        thin: true,
      },
    } as NodeModule;
  }
} catch {
  // oracledb not resolvable — no action needed
}

// Root Hooks (Mocha 8+ API) — available in --require files
export const mochaHooks = {
  beforeEach(this: Mocha.Context) {
    sinon.stub(console, "log");
    sinon.stub(console, "error");

    // Clear global prom-client registry to avoid metric name conflicts across tests
    promClient.register.clear();
  },

  afterEach(this: Mocha.Context) {
    sinon.restore();
  },
};
