import type { GenerateParams, LLMAdapter } from "./types";

function extractLastUserContent(messages: GenerateParams["messages"]): string {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  return (lastUserMessage?.content ?? "").toLowerCase();
}

async function generate({
  messages = [],
  responseFormat = "",
}: GenerateParams) {
  const jsonFormat = responseFormat.toLowerCase();
  const userContent = extractLastUserContent(messages);
  const isHelloMessage = userContent.includes("hello");

  if (isHelloMessage) {
    await new Promise((resolve) => setTimeout(resolve, 400));

    if (jsonFormat.includes("decision")) {
      return {
        decision: "UNREVELANT",
      };
    }

    if (jsonFormat.includes("evaluation")) {
      return {
        evaluation: {
          is_answer_known: true,
        },
      };
    }

    if (jsonFormat.includes("answer")) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      return {
        answer: "Hello",
        confidence: 1,
      };
    }

    return {
      message: "Hello",
      result: "Hello",
    };
  }

  if (jsonFormat.includes("evaluation")) {
    return {
      evaluation: {
        is_answer_known: false,
      },
    };
  }

  if (jsonFormat.includes("answer")) {
    return {
      answer: "mock-llm: say 'hello'",
      confidence: 1,
    };
  }

  if (jsonFormat.includes("decision")) {
    return {
      decision: "UNREVELANT",
    };
  }

  return {
    message: "mock-llm: say 'hello'",
    result: "mock-llm: say 'hello'",
  };
}

export default { generate } satisfies LLMAdapter;
