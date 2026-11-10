import { prepareSceneForStorage } from "./excalidrawScene";
import { validateMermaidSource } from "./mermaidSource";
import { isExcalidrawScene } from "./sceneValidation";
import { getAiResponsesUrl, type AiQuality } from "./aiSettings";
import {
  getExcalidrawMaxOutputTokens,
  getMermaidMaxOutputTokens,
  type AiOutputBudget,
  type AiOutputKind,
  type CompletionRisk,
} from "./aiTokenBudget";
import type { ExcalidrawScene } from "../types/excalidraw";
import type { AiReferenceImage } from "./aiReferenceImage";
import { applyTwilioComponentTemplates, TWILIO_COMPONENTS } from "./twilioComponents";
import { recordAiDiagnostic, type AiDiagnosticOperation } from "./aiDiagnostics";
import {
  cleanArchitectureSpecToExcalidrawScene,
  normalizeCleanArchitectureSpec,
  parseCleanArchitectureSpec,
} from "./cleanArchitecture";

type GenerateExcalidrawSceneInput = {
  apiKey: string;
  apiBaseUrl?: string;
  model: string;
  quality: AiQuality;
  outputBudget?: AiOutputBudget;
  customMaxOutputTokens?: number;
  referenceImage?: AiReferenceImage | null;
  diagnosticOperation?: AiDiagnosticOperation;
  prompt: string;
  systemPrompt?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

type AnalyzeDiagramPromptInput = {
  apiKey: string;
  apiBaseUrl?: string;
  model: string;
  description: string;
  preferredKind?: AiOutputKind;
  referenceImage?: AiReferenceImage | null;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type DiagramPromptAnalysis = {
  recommendedKind: AiOutputKind;
  recommendedQuality: AiQuality;
  recommendedBudget: AiOutputBudget;
  expectedOutputTokenRange: string;
  completionRisk: CompletionRisk;
  reason: string;
  optimizedPrompt: string;
};

type ModifyExcalidrawSceneInput = {
  apiKey: string;
  apiBaseUrl?: string;
  model: string;
  quality: AiQuality;
  outputBudget?: AiOutputBudget;
  customMaxOutputTokens?: number;
  instruction: string;
  scene: ExcalidrawScene;
  signal?: AbortSignal;
  timeoutMs?: number;
};

type GenerateMermaidFlowchartInput = {
  apiKey: string;
  apiBaseUrl?: string;
  model: string;
  quality: AiQuality;
  description: string;
  referenceImage?: AiReferenceImage | null;
  signal?: AbortSignal;
  timeoutMs?: number;
};

type GenerateCleanArchitectureInput = GenerateMermaidFlowchartInput;

type ModifyMermaidFlowchartInput = {
  apiKey: string;
  apiBaseUrl?: string;
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

const SYSTEM_PROMPT = [
  "You generate Excalidraw scene JSON for DesignBuddy.",
  "Return only one valid JSON object. Do not wrap it in Markdown.",
  'The root object must have type "excalidraw", an elements array, appState object, and files object.',
  "Generate compact JSON with no unused fields and no explanatory prose.",
  "If the requested diagram is large, simplify the diagram instead of returning incomplete JSON.",
  "Prefer clear readable diagrams with labeled boxes, arrows, and spatial separation.",
  "When a reference image is attached, recreate its useful structure as editable elements; do not embed the image itself.",
  "Treat readable labels in a reference image as source-of-truth text: preserve them verbatim where possible. Never leave a visible box, ellipse, or node unlabeled; use a concise label from the user's request when text is unclear.",
  "Do not redraw, imitate, or invent company logos. Unless an actual logo asset is supplied, use a clean neutral brand badge with the company name instead.",
  `Only when a node is an exact match for one of these DesignBuddy components, use a rectangle or ellipse placeholder with customData.designbuddyComponentId set to its ID and do not add a separate label: ${TWILIO_COMPONENTS.map(({ id, label }) => `${id} (${label})`).join(", ")}. Never tag or replace generic systems, external services, users, backends, agents, LLMs, business logic, tools, datastores, or grouped containers.`,
  "Keep element counts modest unless the user explicitly asks for a large diagram.",
].join("\n");

const PROMPT_ANALYSIS_SYSTEM_PROMPT = [
  "You analyze diagram requests for DesignBuddy before generation.",
  "Return only one valid JSON object. Do not wrap it in Markdown.",
  "The JSON object must contain these exact keys:",
  'recommendedKind: "mermaid" or "excalidraw".',
  'recommendedQuality: "draft", "balanced", or "high".',
  'recommendedBudget: "standard", "extended", or "maximum".',
  'expectedOutputTokenRange: a rough 5k or 10k band such as "5k-10k", "10k-20k", "40k-60k", or "60k-80k".',
  'completionRisk: "low", "medium", or "high".',
  "reason: one concise sentence.",
  "optimizedPrompt: a clear editable execution brief for the final diagram generation.",
  "Prefer Mermaid for broad catalogues, many components, or dense relationship maps.",
  "Prefer Excalidraw when spatial grouping, visual architecture blocks, or presentation polish matters more than completeness.",
  "Optimize prompts by limiting node count, grouping related ideas, keeping labels short, and preserving the user's intent.",
  "When a reference image is attached, account for its structure and labels in the optimized prompt.",
  "For a reference image, organize optimizedPrompt under these exact headings: Mode, Preserve, Change, Required flows, Constraints.",
  "Mode must say whether the request recreates, extends, or modifies the reference. Preserve must name existing nodes, labels, relationships, and layout to keep. Change must list only the requested delta. Required flows must state every source-to-destination path, including return paths. Constraints must prevent unrelated routes from being repurposed and identify any uncertain or unreadable label as an assumption.",
].join("\n");

const MODIFY_SYSTEM_PROMPT = [
  "You modify existing Excalidraw scene JSON for DesignBuddy.",
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

const CLEAN_ARCHITECTURE_SYSTEM_PROMPT = [
  "You generate a compact JSON architecture specification for DesignBuddy's Clean architecture mode.",
  "Return only one valid JSON object. Do not wrap it in Markdown.",
  'Use exactly this shape: {"nodes":[{"id":"...","label":"...","role":"...","componentId":"...","subtitle":"..."}],"edges":[{"from":"...","to":"...","label":"...","role":"..."}]}.',
  "Nodes: 6 to 12. Edges: 14 maximum. Use one node per system or product; never create invisible grouping or label-only nodes.",
  'Node roles: "external" for users/callers; "channel" for Twilio communication products; "integration" for webhook/backend hops; "agent" for agent infrastructure; "support" for LLM, business logic, and tools; "context" for Flex or data/context systems; "service" for other systems.',
  'Edge roles: "primary" for the forward request path; "return" for the response/backward path; "association" for a visual ownership/association with no arrowhead; "dependency" for internal supporting relationships.',
  "Twilio is a visual ownership badge, not a traffic hop. Twilio may only use an association edge to a channel product; never use Twilio as the source or destination of a primary, return, or dependency edge.",
  "For messaging, use this semantic sequence when applicable: User -> Prog. Messaging; Prog. Messaging -> webhook/backend; webhook/backend -> Agent infrastructure; Agent infrastructure -> Prog. Messaging as a return; Prog. Messaging -> User as a return. Do not send a response only to the webhook/backend.",
  "For voice, keep the main path Prog. Voice -> Agent infrastructure as primary, the updateCall path Agent infrastructure -> Prog. Voice as return, and Prog. Voice -> Flex as primary/context.",
  "Use componentId only with exact DesignBuddy component labels. Supported components: Twilio, Prog. Voice, Prog. Messaging, SMS, WhatsApp, Email API, Recording, Flex, Conversation Relay, Twilio Agent Connect, Conversation Intelligence, Twilio Orchestrator, Memory, Functions, Assets, Studio, TaskRouter, Verify, Lookup, Segment CDP, Connections, Profiles, Engage, Knowledge, Event Streams, Sync, Interconnect, Proxy, 3rd Party API.",
  "If a library component needs a qualifier, keep its exact component label and put the qualifier in subtitle; for example label Flex, componentId flex, subtitle Salesforce SCV.",
  "Keep generic systems (backends, agents, LLMs, business logic, tools, datastores) as ordinary labeled nodes.",
  "For a reference image, preserve meaningful systems and flows, but prioritize a clean readable architecture rather than copying coordinates or decorative details.",
].join("\n");

const MERMAID_MODIFY_SYSTEM_PROMPT = [
  "You modify Mermaid flowchart source for DesignBuddy.",
  "Return only the full updated Mermaid text with no Markdown fence.",
  "Use only flowchart LR or flowchart TD.",
  "Preserve existing labels and structure unless the instruction asks otherwise.",
  "Keep the diagram compact and valid.",
].join("\n");

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function userContent(text: string, referenceImage?: AiReferenceImage | null) {
  return [
    { type: "input_text", text },
    ...(referenceImage
      ? [{ type: "input_image", image_url: referenceImage.dataUrl, detail: "high" }]
      : []),
  ];
}

function logAiRequest({
  operation,
  status,
  model,
  quality,
  timeoutMs,
  startedAt,
  prompt,
  referenceImage,
  responseText,
  sceneSummary,
  error,
}: {
  operation: AiDiagnosticOperation;
  status: "success" | "error";
  model: string;
  quality: AiQuality;
  timeoutMs: number;
  startedAt: number;
  prompt: string;
  referenceImage?: AiReferenceImage | null;
  responseText?: string;
  sceneSummary?: { elementCount: number; arrowCount: number; componentIds: string[] };
  error?: unknown;
}) {
  recordAiDiagnostic({
    operation,
    status,
    model,
    quality,
    timeoutMs,
    durationMs: Date.now() - startedAt,
    promptLength: prompt.length,
    referenceImage: referenceImage
      ? { name: referenceImage.name, mimeType: referenceImage.mimeType, size: referenceImage.size }
      : undefined,
    responseLength: responseText?.length,
    sceneSummary,
    rawResponse: responseText,
    error: error ? getErrorMessage(error).slice(0, 500) : undefined,
  });
}

function formatRequestError(error: unknown, apiBaseUrl?: string) {
  if (!(error instanceof TypeError)) {
    return error;
  }

  try {
    const endpoint = getAiResponsesUrl(apiBaseUrl ?? "");
    return new Error(
      `Could not connect to ${new URL(endpoint).origin}. Check the AI API base URL and your network connection.`,
    );
  } catch {
    return new Error("Could not connect to the configured AI API endpoint.");
  }
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

function normalizeDiagramKind(value: unknown): AiOutputKind | null {
  return value === "mermaid" || value === "excalidraw" ? value : null;
}

function normalizeQuality(value: unknown): AiQuality | null {
  return value === "draft" || value === "balanced" || value === "high"
    ? value
    : null;
}

function normalizeBudget(value: unknown): AiOutputBudget | null {
  return value === "standard" || value === "extended" || value === "maximum"
    ? value
    : null;
}

function normalizeCompletionRisk(value: unknown): CompletionRisk | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.toLowerCase();

  if (normalized === "low") {
    return "Low";
  }

  if (normalized === "medium") {
    return "Medium";
  }

  if (normalized === "high") {
    return "High";
  }

  return null;
}

function parsePromptAnalysis(text: string): DiagramPromptAnalysis {
  let parsed: unknown;

  try {
    parsed = JSON.parse(extractJsonObject(text)) as unknown;
  } catch (error) {
    throw new Error(
      `OpenAI returned an unreadable prompt analysis: ${getErrorMessage(error)}`,
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("OpenAI did not return a valid prompt analysis.");
  }

  const record = parsed as Record<string, unknown>;
  const recommendedKind = normalizeDiagramKind(record.recommendedKind);
  const recommendedQuality = normalizeQuality(record.recommendedQuality);
  const recommendedBudget = normalizeBudget(record.recommendedBudget);
  const completionRisk = normalizeCompletionRisk(record.completionRisk);
  const expectedOutputTokenRange = record.expectedOutputTokenRange;
  const reason = record.reason;
  const optimizedPrompt = record.optimizedPrompt;

  if (
    !recommendedKind ||
    !recommendedQuality ||
    !recommendedBudget ||
    !completionRisk ||
    typeof expectedOutputTokenRange !== "string" ||
    !expectedOutputTokenRange.trim() ||
    typeof reason !== "string" ||
    !reason.trim() ||
    typeof optimizedPrompt !== "string" ||
    !optimizedPrompt.trim()
  ) {
    throw new Error("OpenAI did not return a valid prompt analysis.");
  }

  return {
    recommendedKind,
    recommendedQuality,
    recommendedBudget,
    expectedOutputTokenRange: expectedOutputTokenRange.trim(),
    completionRisk,
    reason: reason.trim(),
    optimizedPrompt: optimizedPrompt.trim(),
  };
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
  apiBaseUrl,
  model,
  quality,
  outputBudget,
  customMaxOutputTokens,
  referenceImage,
  diagnosticOperation = "generate-excalidraw",
  prompt,
  systemPrompt = SYSTEM_PROMPT,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: GenerateExcalidrawSceneInput): Promise<ExcalidrawScene> {
  const startedAt = Date.now();
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
    const response = await fetch(getAiResponsesUrl(apiBaseUrl ?? ""), {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_output_tokens: getExcalidrawMaxOutputTokens(
          quality,
          outputBudget,
          customMaxOutputTokens,
        ),
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
            content: userContent(prompt, referenceImage),
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

    const preparedScene = prepareSceneForStorage({
      ...scene,
      elements: applyTwilioComponentTemplates(scene.elements),
    });
    const componentIds = preparedScene.elements.flatMap((element) => {
      if (!element || typeof element !== "object") return [];
      const customData = (element as Record<string, unknown>).customData;
      const id = customData && typeof customData === "object"
        ? (customData as Record<string, unknown>).designbuddyComponentId
        : undefined;
      return typeof id === "string" ? [id] : [];
    });
    logAiRequest({
      operation: diagnosticOperation, status: "success", model, quality,
      timeoutMs, startedAt, prompt, referenceImage, responseText,
      sceneSummary: {
        elementCount: preparedScene.elements.length,
        arrowCount: preparedScene.elements.filter((element) => element && typeof element === "object" && (element as Record<string, unknown>).type === "arrow").length,
        componentIds: [...new Set(componentIds)],
      },
    });
    return preparedScene;
  } catch (error) {
    logAiRequest({
      operation: diagnosticOperation, status: "error", model, quality,
      timeoutMs, startedAt, prompt, referenceImage, error,
    });
    if (isAbortError(error)) {
      throw new Error(
        abortReason === "timeout"
          ? "OpenAI generation timed out. Try Draft quality or a smaller diagram."
          : "Generation cancelled.",
      );
    }

    throw formatRequestError(error, apiBaseUrl);
  } finally {
    window.clearTimeout(timeoutId);
    unlinkAbortSignals();
  }
}

export function modifyExcalidrawScene({
  apiKey,
  apiBaseUrl,
  model,
  quality,
  outputBudget,
  customMaxOutputTokens,
  instruction,
  scene,
  signal,
  timeoutMs,
}: ModifyExcalidrawSceneInput): Promise<ExcalidrawScene> {
  return generateExcalidrawScene({
    apiKey,
    apiBaseUrl,
    model,
    quality,
    outputBudget,
    customMaxOutputTokens,
    signal,
    timeoutMs,
    systemPrompt: MODIFY_SYSTEM_PROMPT,
    diagnosticOperation: "modify-excalidraw",
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
  apiBaseUrl,
  model,
  quality,
  systemPrompt,
  prompt,
  maxOutputTokens,
  reasoningEffort = QUALITY_TO_REASONING_EFFORT[quality],
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  referenceImage,
  diagnosticOperation,
}: {
  apiKey: string;
  apiBaseUrl?: string;
  model: string;
  quality: AiQuality;
  systemPrompt: string;
  prompt: string;
  maxOutputTokens: number;
  reasoningEffort?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  referenceImage?: AiReferenceImage | null;
  diagnosticOperation?: AiDiagnosticOperation;
}) {
  const startedAt = Date.now();
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
    const response = await fetch(getAiResponsesUrl(apiBaseUrl ?? ""), {
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
            content: userContent(prompt, referenceImage),
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

    if (diagnosticOperation) {
      logAiRequest({
        operation: diagnosticOperation, status: "success", model, quality,
        timeoutMs, startedAt, prompt, referenceImage, responseText,
      });
    }
    return responseText;
  } catch (error) {
    if (diagnosticOperation) {
      logAiRequest({
        operation: diagnosticOperation, status: "error", model, quality,
        timeoutMs, startedAt, prompt, referenceImage, error,
      });
    }
    if (isAbortError(error)) {
      throw new Error(
        abortReason === "timeout"
          ? "OpenAI generation timed out. Try Draft quality or a smaller diagram."
          : "Generation cancelled.",
      );
    }

    throw formatRequestError(error, apiBaseUrl);
  } finally {
    window.clearTimeout(timeoutId);
    unlinkAbortSignals();
  }
}

export async function analyzeDiagramPrompt({
  apiKey,
  apiBaseUrl,
  model,
  description,
  preferredKind,
  referenceImage,
  signal,
  timeoutMs,
}: AnalyzeDiagramPromptInput): Promise<DiagramPromptAnalysis> {
  const prompt = preferredKind
    ? [
        `The user selected ${preferredKind} as the desired output type.`,
        "Analyze and optimize for that selected type unless the prompt is clearly impossible for it.",
        "",
        description,
      ].join("\n")
    : description;

  const responseText = await callOpenAiForText({
    apiKey,
    apiBaseUrl,
    model,
    quality: referenceImage ? "balanced" : "draft",
    signal,
    timeoutMs,
    systemPrompt: PROMPT_ANALYSIS_SYSTEM_PROMPT,
    prompt,
    maxOutputTokens: referenceImage ? 3_000 : 1_500,
    reasoningEffort: referenceImage ? "medium" : "low",
    referenceImage,
    diagnosticOperation: "analyze-prompt",
  });

  return parsePromptAnalysis(responseText);
}

export async function generateMermaidFlowchart({
  apiKey,
  apiBaseUrl,
  model,
  quality,
  description,
  referenceImage,
  signal,
  timeoutMs,
}: GenerateMermaidFlowchartInput) {
  const responseText = await callOpenAiForText({
    apiKey,
    apiBaseUrl,
    model,
    quality,
    signal,
    timeoutMs,
    systemPrompt: MERMAID_SYSTEM_PROMPT,
    prompt: description,
    maxOutputTokens: getMermaidMaxOutputTokens(quality),
    reasoningEffort: "low",
    referenceImage,
    diagnosticOperation: "generate-mermaid",
  });
  const source = cleanMermaidSource(responseText);
  const validationError = validateMermaidSource(source);

  if (validationError) {
    throw new Error(validationError);
  }

  return `${source}\n`;
}

export async function generateCleanArchitectureScene({
  apiKey,
  apiBaseUrl,
  model,
  quality,
  description,
  referenceImage,
  signal,
  timeoutMs,
}: GenerateCleanArchitectureInput): Promise<ExcalidrawScene> {
  const responseText = await callOpenAiForText({
    apiKey,
    apiBaseUrl,
    model,
    quality,
    signal,
    timeoutMs,
    systemPrompt: CLEAN_ARCHITECTURE_SYSTEM_PROMPT,
    prompt: description,
    maxOutputTokens: getMermaidMaxOutputTokens(quality),
    reasoningEffort: "low",
    referenceImage,
    diagnosticOperation: "generate-clean-architecture",
  });
  return cleanArchitectureSpecToExcalidrawScene(
    normalizeCleanArchitectureSpec(parseCleanArchitectureSpec(extractJsonObject(responseText))),
  );
}

export async function modifyMermaidFlowchart({
  apiKey,
  apiBaseUrl,
  model,
  quality,
  source,
  instruction,
  signal,
  timeoutMs,
}: ModifyMermaidFlowchartInput) {
  const responseText = await callOpenAiForText({
    apiKey,
    apiBaseUrl,
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
    maxOutputTokens: getMermaidMaxOutputTokens(quality),
    reasoningEffort: "low",
    diagnosticOperation: "modify-mermaid",
  });
  const nextSource = cleanMermaidSource(responseText);
  const validationError = validateMermaidSource(nextSource);

  if (validationError) {
    throw new Error(validationError);
  }

  return `${nextSource}\n`;
}
