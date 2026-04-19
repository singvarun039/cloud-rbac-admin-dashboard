type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object";
}

function readTextValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (!isRecord(value)) return null;

  const nestedValue = value.value;
  if (typeof nestedValue === "string" && nestedValue.trim()) {
    return nestedValue.trim();
  }

  const nestedText = value.text;
  if (typeof nestedText === "string" && nestedText.trim()) {
    return nestedText.trim();
  }

  return null;
}

function collectMessageContentTexts(content: unknown): string[] {
  if (!Array.isArray(content)) return [];

  const texts: string[] = [];
  for (const item of content) {
    if (!isRecord(item)) continue;

    const type = typeof item.type === "string" ? item.type : "";
    if (type !== "output_text" && type !== "text" && type !== "refusal") {
      continue;
    }

    const directText = readTextValue(item.text);
    if (directText) {
      texts.push(directText);
      continue;
    }

    const fallbackText = readTextValue(item);
    if (fallbackText) {
      texts.push(fallbackText);
    }
  }

  return texts;
}

function collectOutputTexts(output: unknown): string[] {
  if (!Array.isArray(output)) return [];

  const texts: string[] = [];
  for (const item of output) {
    if (!isRecord(item)) continue;

    const itemType = typeof item.type === "string" ? item.type : "";
    if (itemType === "message") {
      texts.push(...collectMessageContentTexts(item.content));
      continue;
    }

    if (itemType === "refusal") {
      const refusal = readTextValue(item.refusal) ?? readTextValue(item);
      if (refusal) texts.push(refusal);
    }
  }

  return texts;
}

function dedupeNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return false;
    seen.add(trimmed);
    return true;
  });
}

// Extracts readable assistant text from the OpenAI Responses API payload.
export function extractOpenAiResponseText(payload: unknown): string {
  if (!isRecord(payload)) return "";

  const fromTopLevel = readTextValue(payload.output_text);
  if (fromTopLevel) return fromTopLevel;

  const outputTexts = collectOutputTexts(payload.output);
  if (outputTexts.length) {
    return dedupeNonEmpty(outputTexts).join("\n\n").trim();
  }

  const contentTexts = collectMessageContentTexts(payload.content);
  if (contentTexts.length) {
    return dedupeNonEmpty(contentTexts).join("\n\n").trim();
  }

  const refusal = readTextValue(payload.refusal);
  if (refusal) return refusal;

  return "";
}

// Produces a compact debug string when upstream returned no visible text.
export function summarizeOpenAiPayload(payload: unknown): string {
  try {
    const text = JSON.stringify(payload);
    if (!text) return "empty-json";
    return text.length > 1500 ? `${text.slice(0, 1500)}...` : text;
  } catch {
    return "unserializable-payload";
  }
}
