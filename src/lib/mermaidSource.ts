import type { MermaidDesignContent } from "../types/designs";

const SUPPORTED_MERMAID_ERROR =
  "Mermaid source must start with flowchart LR or flowchart TD.";

export function validateMermaidSource(source: string) {
  const trimmed = source.trimStart();

  if (!trimmed.startsWith("flowchart LR") && !trimmed.startsWith("flowchart TD")) {
    return SUPPORTED_MERMAID_ERROR;
  }

  return null;
}

export function normaliseMermaidContent(content: unknown): MermaidDesignContent {
  if (
    typeof content === "object" &&
    content !== null &&
    "source" in content &&
    typeof content.source === "string"
  ) {
    return { source: content.source };
  }

  throw new Error("Invalid Mermaid source.");
}
