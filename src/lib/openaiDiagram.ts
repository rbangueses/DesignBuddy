import { prepareSceneForStorage } from "./excalidrawScene";
import { validateMermaidSource } from "./mermaidSource";
import { isExcalidrawScene } from "./sceneValidation";
import type { AiQuality } from "./aiSettings";
import type { ExcalidrawScene } from "../types/excalidraw";

type GenerateExcalidrawSceneInput = {
  apiKey: string;
  model: string;
  quality: AiQuality;
  prompt: string;
  systemPrompt?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

type ModifyExcalidrawSceneInput = {
  apiKey: string;
  model: string;
  quality: AiQuality;
  instruction: string;
  scene: ExcalidrawScene;
  signal?: AbortSignal;
  timeoutMs?: number;
};

type GenerateMermaidFlowchartInput = {
  apiKey: string;
  model: string;
  quality: AiQuality;
  description: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

type ModifyMermaidFlowchartInput = {
  apiKey: string;
  model: string;
  quality: AiQuality;
  source: string;
  instruction: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 90_000;

const QUALITY_TO_REASONING_EFFORT: Record<AiQuality, string> = {
  draft: "low",
  balanced: "medium",
  high: "high",
};

const QUALITY_TO_MAX_OUTPUT_TOKENS: Record<AiQuality, number> = {
  draft: 12_000,
  balanced: 28_000,
  high: 40_000,
};

const SYSTEM_PROMPT = [
  "You generate Excalidraw scene JSON for BanguesesDraw.",
  "Return only one valid JSON object. Do not wrap it in Markdown.",
  'The root object must have type "excalidraw", an elements array, appState object, and files object.',
  "Generate compact JSON with no unused fields and no explanatory prose.",
  "If the requested diagram is large, simplify the diagram instead of returning incomplete JSON.",
  "Prefer clear readable diagrams with labeled boxes, arrows, and spatial separation.",
  "Keep element counts modest unless the user explicitly asks for a large diagram.",
].join("\n");

const MODIFY_SYSTEM_PROMPT = [
  "You modify existing Excalidraw scene JSON for BanguesesDraw.",
  "Return only one complete valid JSON object. Do not wrap it in Markdown.",
  'The root object must have type "excalidraw", an elements array, appState object, and files object.',
  "Preserve the user's existing diagram intent and style unless the instruction asks otherwise.",
  "Keep existing labels, colors, and layout where possible.",
  "If the requested change is large, simplify the update instead of returning incomplete JSON.",
].join("\n");

const MERMAID_SYSTEM_PROMPT = [
  "You generate Mermaid flowchart source only.",
  "Return only Mermaid text with no Markdown fence.",
  "Use only flowchart LR or flowchart TD.",
  "Use simple node labels and simple arrows.",
  "Allowed shapes: A[Label], A(Label), A{Decision}, A[(Database)].",
  "Keep the diagram compact: 8 to 12 nodes maximum, 20 lines maximum.",
  "Merge related details into concise labels instead of creating many tiny nodes.",
  "Prefer labeled arrows over extra explanatory nodes.",
].join("\n");

const MERMAID_MODIFY_SYSTEM_PROMPT = [
  "You modify Mermaid flowchart source for BanguesesDraw.",
  "Return only the full updated Mermaid text with no Markdown fence.",
  "Use only flowchart LR or flowchart TD.",
  "Preserve existing labels and structure unless the instruction asks otherwise.",
  "Keep the diagram compact and valid.",
].join("\n");

const QUALITY_TO_MERMAID_MAX_OUTPUT_TOKENS: Record<AiQuality, number> = {
  draft: 4_000,
  balanced: 8_000,
  high: 12_000,
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function extractResponseText(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") {
    return "";
  }

  const body = responseBody as Record<string, unknown>;

  if (typeof body.output_text === "string") {
    return body.output_text;
  }

  if (Array.isArray(body.output)) {
    return body.output
      .flatMap((outputItem) => {
        if (!outputItem || typeof outputItem !== "object") {
          return [];
        }

        const content = (outputItem as Record<string, unknown>).content;

        if (!Array.isArray(content)) {
          return [];
        }

        return content.flatMap((contentItem) => {
          if (!contentItem || typeof contentItem !== "object") {
            return [];
          }

          const text = (contentItem as Record<string, unknown>).text;
          return typeof text === "string" ? [text] : [];
        });
      })
      .join("\n");
  }

  return "";
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const startIndex = trimmed.indexOf("{");
  const endIndex = trimmed.lastIndexOf("}");

  if (startIndex !== -1 && endIndex === -1) {
    throw new Error("OpenAI returned incomplete or invalid JSON.");
  }

  if (startIndex === -1 || endIndex <= startIndex) {
    throw new Error("OpenAI did not return JSON.");
  }

  return trimmed.slice(startIndex, endIndex + 1);
}

function cleanMermaidSource(text: string) {
  return text
    .trim()
    .replace(/^```mermaid\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

async function readApiError(response: Response) {
  try {
    const body = (await response.json()) as unknown;

    if (body && typeof body === "object") {
      const error = (body as Record<string, unknown>).error;

      if (error && typeof error === "object") {
        const message = (error as Record<string, unknown>).message;

        if (typeof message === "string" && message.trim()) {
          return message;
        }
      }
    }
  } catch {
    // Fall through to the generic status message.
  }

  return `OpenAI request failed with status ${response.status}.`;
}

function readIncompleteReason(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") {
    return null;
  }

  const body = responseBody as Record<string, unknown>;

  if (body.status !== "incomplete") {
    return null;
  }

  const details = body.incomplete_details;

  if (!details || typeof details !== "object") {
    return "unknown";
  }

  const reason = (details as Record<string, unknown>).reason;
  return typeof reason === "string" ? reason : "unknown";
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function linkAbortSignals(
  controller: AbortController,
  externalSignal: AbortSignal | undefined,
  onAbort: () => void,
) {
  if (!externalSignal) {
    return () => undefined;
  }

  if (externalSignal.aborted) {
    onAbort();
    controller.abort();
    return () => undefined;
  }

  const abort = () => {
    onAbort();
    controller.abort();
  };

  externalSignal.addEventListener("abort", abort, { once: true });
  return () => externalSignal.removeEventListener("abort", abort);
}

export async function generateExcalidrawScene({
  apiKey,
  model,
  quality,
  prompt,
  systemPrompt = SYSTEM_PROMPT,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: GenerateExcalidrawSceneInput): Promise<ExcalidrawScene> {
  const controller = new AbortController();
  let abortReason: "cancelled" | "timeout" | null = null;
  const unlinkAbortSignals = linkAbortSignals(controller, signal, () => {
    abortReason = "cancelled";
  });
  const timeoutId = window.setTimeout(() => {
    abortReason = "timeout";
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_output_tokens: QUALITY_TO_MAX_OUTPUT_TOKENS[quality],
        reasoning: {
          effort: QUALITY_TO_REASONING_EFFORT[quality],
        },
        text: {
          verbosity: "low",
        },
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    let responseBody: unknown;

    try {
      responseBody = await response.json();
    } catch (error) {
      throw new Error(`OpenAI returned unreadable JSON: ${getErrorMessage(error)}`);
    }

    const incompleteReason = readIncompleteReason(responseBody);

    if (incompleteReason === "max_output_tokens") {
      throw new Error(
        "OpenAI ran out of output space while generating this diagram. Try Draft quality or ask for a smaller diagram.",
      );
    }

    if (incompleteReason) {
      throw new Error(
        `OpenAI stopped before finishing the diagram (${incompleteReason}). Try again with a smaller prompt.`,
      );
    }

    const responseText = extractResponseText(responseBody);
    const jsonText = extractJsonObject(responseText);
    let scene: unknown;

    try {
      scene = JSON.parse(jsonText) as unknown;
    } catch (error) {
      throw new Error(
        `OpenAI returned incomplete or invalid JSON: ${getErrorMessage(error)}. Try Draft quality or ask for a smaller diagram.`,
      );
    }

    if (!isExcalidrawScene(scene)) {
      throw new Error("OpenAI did not return a valid Excalidraw scene.");
    }

    return prepareSceneForStorage(scene);
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(
        abortReason === "timeout"
          ? "OpenAI generation timed out. Try Draft quality or a smaller diagram."
          : "Generation cancelled.",
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    unlinkAbortSignals();
  }
}

export function modifyExcalidrawScene({
  apiKey,
  model,
  quality,
  instruction,
  scene,
  signal,
  timeoutMs,
}: ModifyExcalidrawSceneInput): Promise<ExcalidrawScene> {
  return generateExcalidrawScene({
    apiKey,
    model,
    quality,
    signal,
    timeoutMs,
    systemPrompt: MODIFY_SYSTEM_PROMPT,
    prompt: [
      "Modify the existing scene using this instruction:",
      instruction,
      "",
      "Existing Excalidraw scene JSON:",
      JSON.stringify(prepareSceneForStorage(scene)),
    ].join("\n"),
  });
}

async function callOpenAiForText({
  apiKey,
  model,
  quality,
  systemPrompt,
  prompt,
  maxOutputTokens,
  reasoningEffort = QUALITY_TO_REASONING_EFFORT[quality],
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  apiKey: string;
  model: string;
  quality: AiQuality;
  systemPrompt: string;
  prompt: string;
  maxOutputTokens: number;
  reasoningEffort?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}) {
  const controller = new AbortController();
  let abortReason: "cancelled" | "timeout" | null = null;
  const unlinkAbortSignals = linkAbortSignals(controller, signal, () => {
    abortReason = "cancelled";
  });
  const timeoutId = window.setTimeout(() => {
    abortReason = "timeout";
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_output_tokens: maxOutputTokens,
        reasoning: {
          effort: reasoningEffort,
        },
        text: {
          verbosity: "low",
        },
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    let responseBody: unknown;

    try {
      responseBody = await response.json();
    } catch (error) {
      throw new Error(`OpenAI returned unreadable JSON: ${getErrorMessage(error)}`);
    }

    const incompleteReason = readIncompleteReason(responseBody);

    if (incompleteReason === "max_output_tokens") {
      throw new Error(
        "OpenAI ran out of output space while generating this diagram. Try Draft quality or ask for a smaller diagram.",
      );
    }

    if (incompleteReason) {
      throw new Error(
        `OpenAI stopped before finishing the diagram (${incompleteReason}). Try again with a smaller prompt.`,
      );
    }

    const responseText = extractResponseText(responseBody);

    if (!responseText.trim()) {
      throw new Error("OpenAI did not return text.");
    }

    return responseText;
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(
        abortReason === "timeout"
          ? "OpenAI generation timed out. Try Draft quality or a smaller diagram."
          : "Generation cancelled.",
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    unlinkAbortSignals();
  }
}

export async function generateMermaidFlowchart({
  apiKey,
  model,
  quality,
  description,
  signal,
  timeoutMs,
}: GenerateMermaidFlowchartInput) {
  const responseText = await callOpenAiForText({
    apiKey,
    model,
    quality,
    signal,
    timeoutMs,
    systemPrompt: MERMAID_SYSTEM_PROMPT,
    prompt: description,
    maxOutputTokens: QUALITY_TO_MERMAID_MAX_OUTPUT_TOKENS[quality],
    reasoningEffort: "low",
  });
  const source = cleanMermaidSource(responseText);
  const validationError = validateMermaidSource(source);

  if (validationError) {
    throw new Error(validationError);
  }

  return `${source}\n`;
}

export async function modifyMermaidFlowchart({
  apiKey,
  model,
  quality,
  source,
  instruction,
  signal,
  timeoutMs,
}: ModifyMermaidFlowchartInput) {
  const responseText = await callOpenAiForText({
    apiKey,
    model,
    quality,
    signal,
    timeoutMs,
    systemPrompt: MERMAID_MODIFY_SYSTEM_PROMPT,
    prompt: [
      "Modify the existing Mermaid flowchart using this instruction:",
      instruction,
      "",
      "Existing Mermaid source:",
      source,
    ].join("\n"),
    maxOutputTokens: QUALITY_TO_MERMAID_MAX_OUTPUT_TOKENS[quality],
    reasoningEffort: "low",
  });
  const nextSource = cleanMermaidSource(responseText);
  const validationError = validateMermaidSource(nextSource);

  if (validationError) {
    throw new Error(validationError);
  }

  return `${nextSource}\n`;
}
