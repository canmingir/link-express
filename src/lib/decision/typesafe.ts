import { TypeSafeClient } from "@typesafe-ai/sdk";

import { createSystemOneAdapter } from "./systemOne";
import type { DecisionAdapter } from "./types";

export default createSystemOneAdapter({
  providerLabel: "typesafe",
  createClient: () =>
    new TypeSafeClient({
      timeout: Number(process.env.TYPESAFE_TIMEOUT_MS) || 30000,
    }),
}) satisfies DecisionAdapter;
