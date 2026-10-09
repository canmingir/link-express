function stripMarkdownFence(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json|JSON)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

function parseJsonContent(content: string, providerLabel: string): unknown {
  const cleaned = stripMarkdownFence(content);

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Failed to parse ${providerLabel} response as JSON: ` +
        (err instanceof Error ? err.message : String(err)) +
        "\nResponse content:\n" +
        cleaned,
    );
  }
}

function repairUnbalancedJSON(content: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const ch of content) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" && stack[stack.length - 1] === "{") stack.pop();
    else if (ch === "]" && stack[stack.length - 1] === "[") stack.pop();
  }

  if (stack.length === 0 && !inString) return null;

  let repaired = content;
  if (inString) repaired += '"';
  for (let i = stack.length - 1; i >= 0; i--) {
    repaired += stack[i] === "{" ? "}" : "]";
  }
  return repaired;
}

function quoteUnquotedKeys(content: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  let i = 0;

  while (i < content.length) {
    const ch = content[i];
    if (inString) {
      result += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      result += ch;
      i++;
      continue;
    }
    const keyMatch = /^([A-Za-z_$][\w$]*)(\s*:)/.exec(content.slice(i));
    if (keyMatch) {
      result += `"${keyMatch[1]}"${keyMatch[2]}`;
      i += keyMatch[0].length;
      continue;
    }
    result += ch;
    i++;
  }

  return result;
}

function parseWithBraceRepair(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const repaired = repairUnbalancedJSON(content);
    if (repaired) {
      try {
        return JSON.parse(repaired);
      } catch {}
    }
  }
  return undefined;
}

function unwrapSchemaValues(obj: unknown): unknown {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const o = obj as Record<string, unknown>;
    if ("type" in o && "value" in o) {
      return unwrapSchemaValues(o.value);
    }
    return Object.fromEntries(
      Object.entries(o).map(([k, v]) => [k, unwrapSchemaValues(v)]),
    );
  }
  if (typeof obj === "string") {
    const trimmed = obj.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return unwrapSchemaValues(JSON.parse(trimmed));
      } catch {
      }
    }
  }
  return obj;
}

const CONTROL_CHAR_ESCAPES: Record<string, string> = {
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\b": "\\b",
  "\f": "\\f",
};

function escapeControlCharsInStrings(content: string): string | null {
  let result = "";
  let inString = false;
  let escaped = false;
  let changed = false;

  for (const ch of content) {
    if (inString && !escaped && ch < " ") {
      result += CONTROL_CHAR_ESCAPES[ch] ?? "";
      changed = true;
      continue;
    }

    result += ch;

    if (escaped) escaped = false;
    else if (inString && ch === "\\") escaped = true;
    else if (ch === '"') inString = !inString;
  }

  return changed ? result : null;
}

function parseJsonWithRepair(content: string, providerLabel: string): unknown {
  try {
    return parseJsonContent(content, providerLabel);
  } catch {}

  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }

  const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {}

    const quoted = quoteUnquotedKeys(jsonMatch[1]);
    try {
      return JSON.parse(quoted);
    } catch {}

    const quotedRepaired = repairUnbalancedJSON(quoted);
    if (quotedRepaired) {
      try {
        return JSON.parse(quotedRepaired);
      } catch {}
    }
  }

  const repaired = repairUnbalancedJSON(content);
  if (repaired) {
    try {
      return JSON.parse(repaired);
    } catch {}
  }

  const escapedControls = escapeControlCharsInStrings(stripMarkdownFence(content));
  if (escapedControls) {
    try {
      return JSON.parse(escapedControls);
    } catch {}

    const escapedRepaired = repairUnbalancedJSON(escapedControls);
    if (escapedRepaired) {
      try {
        return JSON.parse(escapedRepaired);
      } catch {}
    }
  }
  throw new SyntaxError(
    `Failed to parse ${providerLabel} response as JSON. Content starts with: ${content.substring(
      0,
      100,
    )}`,
  );
}

export {
  stripMarkdownFence,
  parseJsonContent,
  parseJsonWithRepair,
  parseWithBraceRepair,
  unwrapSchemaValues,
  repairUnbalancedJSON,
  quoteUnquotedKeys,
};
