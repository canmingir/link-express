import type { LLMAdapter } from "./types";

function credentialFor(provider: string): string | undefined {
  const env = process.env;

  switch (provider) {
    case "openai":
      return env.OPENAI_API_KEY;
    case "anthropic":
      return env.ANTHROPIC_API_KEY;
    case "openrouter":
      return env.OPENROUTER_API_KEY;
    case "bedrock":
      return env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? `${env.AWS_ACCESS_KEY_ID}:${env.AWS_SECRET_ACCESS_KEY}`
        : undefined;
    default:
      return undefined;
  }
}

async function createAdapter(
  provider: string,
  credential: string,
  { region }: { region?: string } = {}
): Promise<LLMAdapter> {
  switch (provider) {
    case "openai":
      return (await import("./openai")).createOpenAIAdapter({
        apiKey: credential,
      });
    case "anthropic":
      return (await import("./anthropic")).createAnthropicAdapter({
        apiKey: credential,
      });
    case "openrouter":
      return (await import("./openrouter")).createOpenRouterAdapter({
        apiKey: credential,
      });
    case "bedrock": {
      const separator = credential.indexOf(":");

      if (separator === -1) {
        throw new Error(
          "Bedrock credentials must be <AWS_ACCESS_KEY_ID>:<AWS_SECRET_ACCESS_KEY>"
        );
      }

      return (await import("./bedrock")).createBedrockAdapter({
        accessKeyId: credential.slice(0, separator),
        secretAccessKey: credential.slice(separator + 1),
        region,
      });
    }
    case "mock":
      return (await import("./mock")).default;
    default:
      throw new Error(`Unknown LLM provider "${provider}"`);
  }
}

export { createAdapter, credentialFor };
