# LLM Adapters

link-express puts different LLM providers behind a single `generate()` function. You pick the provider with an environment variable, and you can add your own adapters or extend the existing ones.

## Quick start

```bash
PLATFORM_LLM=openrouter/openai/gpt-4o-mini
OPENROUTER_API_KEY=sk-or-...
```

```ts
import { generate } from "@canmingir/link-express/llm";

const result = await generate({
  content: "Say hello",
  json_format: "{ message: <MESSAGE> }",
});

result.message;
```

`generate()` returns the model's answer as a parsed JSON object.

## Choosing a provider

`PLATFORM_LLM` uses the format `<provider>/<model>`. If you leave out the model, the adapter's default model is used. If `PLATFORM_LLM` is not set, `local` is used.

To send a single call to a different provider, pass `provider`:

```ts
await generate({ provider: "bedrock", content, json_format });
```

## `generate()` parameters

| Parameter | Description |
|---|---|
| `content` | The user message (required). |
| `json_format` | The shape of the expected answer (required). |
| `provider`, `model` | Override the provider and model for this call. |
| `policy`, `dataset` | System messages added at the start. |
| `context` | Conversation history. |
| `temperature`, `max_tokens` | `temperature` defaults to `0`. |
| `meta` | Extra information for logs (`teamId`, `agentId`, etc.). |

## Built-in adapters

| Name | Environment variables |
|---|---|
| `openai` | `OPENAI_API_KEY` |
| `openrouter` | `OPENROUTER_API_KEY` |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `bedrock` | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| `local` | `PLATFORM_LLM_URL` (defaults to Ollama: `http://localhost:11434/v1`) |
| `mock` | – (returns fixed answers) |

## Adding an adapter

Register adapters when your app starts, before the first `generate()` call.

For OpenAI-compatible APIs (Groq, Together, vLLM, etc.):

```ts
import {
  registerAdapter,
  createOpenAICompatibleAdapter,
} from "@canmingir/link-express/llm";

registerAdapter(
  "groq",
  createOpenAICompatibleAdapter({
    providerLabel: "groq",
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
  }),
);
```

You can now use it with `PLATFORM_LLM=groq/llama-3.3-70b-versatile`.

For any other API, an object with a `generate` function is enough:

```ts
registerAdapter("internal", {
  async generate({ model, messages, responseFormat }) {
    const res = await fetch("https://llm.internal/chat", {
      method: "POST",
      body: JSON.stringify({ model, messages, format: responseFormat }),
    });
    return res.json();
  },
});
```

If you register under the name of a built-in adapter (for example `openai`), yours is used instead.

## Extending an adapter

`extendAdapter` wraps an existing adapter without replacing it. Your function receives the current adapter (`base`), which still does the actual work.

```ts
import { extendAdapter, getAdapter } from "@canmingir/link-express/llm";

extendAdapter("openrouter", (base) => ({
  async generate(params) {
    try {
      return await base.generate(params);
    } catch {
      const bedrock = await getAdapter("bedrock");
      return bedrock.generate({ ...params, model: "us.meta.llama3-3-70b-instruct-v1:0" });
    }
  },
}));
```

This example sends the same request to Bedrock when OpenRouter fails. The same pattern works for measuring duration, adding a system message, or post-processing the answer.

## Logging

link-express does not store LLM calls anywhere itself. After each call it calls the function you provide:

```ts
import { setLogger } from "@canmingir/link-express/llm";

setLogger((entry) => {
  LLMLog.create({ ...entry, ...entry.meta }).catch(console.error);
});
```

`entry` contains `provider`, `model`, `messages`, `response`, token counts, `cost`, `durationMs` and `meta`.
