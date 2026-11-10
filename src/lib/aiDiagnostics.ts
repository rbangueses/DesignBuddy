import { loadAiSettings } from "./aiSettings";

const STORAGE_KEY = "banguesesdraw.aiDiagnostics";
const MAX_ENTRIES = 20;
const MAX_RAW_RESPONSE_LENGTH = 30_000;

export type AiDiagnosticOperation =
  | "analyze-prompt"
  | "generate-excalidraw"
  | "generate-mermaid"
  | "generate-clean-architecture"
  | "modify-excalidraw"
  | "modify-mermaid";

export type AiDiagnosticEntry = {
  id: string;
  timestamp: string;
  operation: AiDiagnosticOperation;
  status: "success" | "error";
  model: string;
  quality: string;
  timeoutMs: number;
  durationMs: number;
  promptLength: number;
  referenceImage?: { name: string; mimeType: string; size: number };
  responseLength?: number;
  sceneSummary?: {
    elementCount: number;
    arrowCount: number;
    componentIds: string[];
  };
  rawResponse?: string;
  error?: string;
};

function readEntries(): AiDiagnosticEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is AiDiagnosticEntry => Boolean(entry && typeof entry === "object")) : [];
  } catch {
    return [];
  }
}

export function recordAiDiagnostic(entry: Omit<AiDiagnosticEntry, "id" | "timestamp">) {
  const settings = loadAiSettings();
  if (!settings.enableDiagnostics) return;

  const rawResponse = settings.includeDiagnosticRawResponses && entry.rawResponse
    ? entry.rawResponse.slice(0, MAX_RAW_RESPONSE_LENGTH)
    : undefined;
  const nextEntry: AiDiagnosticEntry = {
    ...entry,
    rawResponse,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([nextEntry, ...readEntries()].slice(0, MAX_ENTRIES)));
}

export function clearAiDiagnostics() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getAiDiagnosticCount() {
  return readEntries().length;
}

export function downloadAiDiagnostics() {
  const diagnostics = JSON.stringify({
    exportedAt: new Date().toISOString(),
    entries: readEntries(),
  }, null, 2);
  const url = URL.createObjectURL(new Blob([diagnostics], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "designbuddy-ai-diagnostics.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
