import * as promClient from "prom-client";

export const mochaHooks = {
  beforeEach() {
    promClient.register.clear();
  },
};
