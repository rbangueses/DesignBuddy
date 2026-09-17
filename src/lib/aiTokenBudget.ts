import type { AiQuality } from "./aiSettings";

export type AiOutputBudget = "standard" | "extended" | "maximum" | "custom";
export type AiOutputKind = "excalidraw" | "mermaid";
export type CompletionRisk = "Low" | "Medium" | "High";

export const AI_OUTPUT_BUDGET_OPTIONS = [
  {
    id: "standard",
    label: "Standard",
    description: "Best default for most diagrams",
  },
  {
    id: "extended",
    label: "Extended",
    description: "More room for larger Excalidraw diagrams",
  },
  {
    id: "maximum",
    label: "Maximum",
    description: "Highest app-supported Excalidraw budget",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Set a specific output token limit",
  },
] as const;

const EXCALIDRAW_STANDARD_OUTPUT_TOKENS: Record<AiQuality, number> = {
  draft: 12_000,
  balanced: 28_000,
  high: 40_000,
};

const EXCALIDRAW_BUDGET_OUTPUT_TOKENS: Record<
  Exclude<AiOutputBudget, "custom">,
  number
> = {
  standard: 0,
  extended: 60_000,
  maximum: 80_000,
};

const MERMAID_OUTPUT_TOKENS: Record<AiQuality, number> = {
  draft: 4_000,
  balanced: 8_000,
  high: 12_000,
};

export function getExcalidrawMaxOutputTokens(
  quality: AiQuality,
  outputBudget: AiOutputBudget = "standard",
  customMaxOutputTokens?: number,
) {
  if (outputBudget === "custom") {
    return customMaxOutputTokens ?? EXCALIDRAW_STANDARD_OUTPUT_TOKENS[quality];
  }

  if (outputBudget === "standard") {
    return EXCALIDRAW_STANDARD_OUTPUT_TOKENS[quality];
  }

  return EXCALIDRAW_BUDGET_OUTPUT_TOKENS[outputBudget];
}

export function getMermaidMaxOutputTokens(quality: AiQuality) {
  return MERMAID_OUTPUT_TOKENS[quality];
}

export function formatTokenBudget(tokens: number) {
  return `Up to ${tokens.toLocaleString("en-US")} tokens`;
}

export function estimateCompletionRisk({
  kind,
  quality,
  outputBudget = "standard",
  isModify = false,
  promptLength = 0,
}: {
  kind: AiOutputKind;
  quality: AiQuality;
  outputBudget?: AiOutputBudget;
  isModify?: boolean;
  promptLength?: number;
}): CompletionRisk {
  if (kind === "mermaid") {
    return promptLength > 700 ? "Medium" : "Low";
  }

  if (outputBudget !== "standard") {
    return "Medium";
  }

  if (isModify || quality === "high" || promptLength > 700) {
    return "High";
  }

  if (quality === "balanced" || promptLength > 350) {
    return "Medium";
  }

  return "Low";
}
