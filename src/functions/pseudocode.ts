import { LLMMeta, generate } from "../lib/llm";

import train from "../dataset/pseudocode.json";

type PseudocodeProperties = {
  instructions?: string;
  pseudocode?: string;
  pseudocodeEnabled?: boolean;
  [key: string]: unknown;
};

type PseudocodeNode = {
  properties?: PseudocodeProperties;
  [key: string]: unknown;
};

const dataset = {
  role: "system" as const,
  content: JSON.stringify({ train: train.data }),
};

async function generatePseudocode({
  instructions,
  meta,
}: {
  instructions: string;
  meta?: LLMMeta;
}): Promise<string> {
  const content = instructions?.trim();

  if (!content) {
    return "";
  }

  const response = await generate({
    dataset,
    content,
    json_format: "{ pseudocode: <PSEUDO> }",
    meta: { source: "pseudocode.generate", ...meta },
  });

  return (response.pseudocode as string) ?? "";
}

function sanitize<T extends PseudocodeNode>(nodes?: T[]): T[] | undefined {
  if (!nodes?.length) {
    return nodes;
  }

  return nodes.map((node) => {
    const properties = node.properties;

    if (!properties) {
      return node;
    }

    const enabled =
      properties.pseudocodeEnabled === true &&
      Boolean(properties.instructions?.trim());

    const dropped = enabled
      ? properties.pseudocode?.trim()
        ? null
        : ["pseudocode"]
      : ["pseudocode", "pseudocodeEnabled"];

    if (!dropped) {
      return node;
    }

    return {
      ...node,
      properties: Object.fromEntries(
        Object.entries(properties).filter(([key]) => !dropped.includes(key)),
      ),
    };
  });
}

function or<F>(node: PseudocodeNode | null | undefined, fallback: F): string | F {
  return (
    (node?.properties?.pseudocodeEnabled && node.properties.pseudocode) ||
    fallback
  );
}

export { generatePseudocode as generate, sanitize, or };
export type { PseudocodeNode, PseudocodeProperties };
