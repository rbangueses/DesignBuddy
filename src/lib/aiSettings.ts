export const AI_SETTINGS_STORAGE_KEY = "banguesesdraw.aiSettings";
export const DEFAULT_AI_API_BASE_URL = "https://api.openai.com/v1";

export const AI_MODEL_OPTIONS = [
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    description: "Recommended",
  },
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    description: "Higher quality",
  },
  {
    id: "gpt-5.5",
    label: "GPT-5.5",
    description: "Best quality",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Use any compatible model id",
  },
] as const;

export const AI_QUALITY_OPTIONS = [
  { id: "draft", label: "Draft" },
  { id: "balanced", label: "Balanced" },
  { id: "high", label: "High quality" },
] as const;

export type AiModelId = (typeof AI_MODEL_OPTIONS)[number]["id"];
export type AiQuality = (typeof AI_QUALITY_OPTIONS)[number]["id"];

export type AiSettings = {
  apiKey: string;
  apiBaseUrl: string;
  selectedModel: AiModelId;
  customModel: string;
  quality: AiQuality;
  enableMermaid: boolean;
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  apiKey: "",
  apiBaseUrl: DEFAULT_AI_API_BASE_URL,
  selectedModel: "gpt-5.4-mini",
  customModel: "",
  quality: "balanced",
  enableMermaid: true,
};

function isAiModelId(value: unknown): value is AiModelId {
  return AI_MODEL_OPTIONS.some((option) => option.id === value);
}

function isAiQuality(value: unknown): value is AiQuality {
  return AI_QUALITY_OPTIONS.some((option) => option.id === value);
}

function sanitizeAiSettings(value: unknown): AiSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_AI_SETTINGS;
  }

  const candidate = value as Partial<Record<keyof AiSettings, unknown>>;
  const selectedModel = isAiModelId(candidate.selectedModel)
    ? candidate.selectedModel
    : DEFAULT_AI_SETTINGS.selectedModel;
  const quality = isAiQuality(candidate.quality)
    ? candidate.quality
    : DEFAULT_AI_SETTINGS.quality;

  return {
    apiKey:
      typeof candidate.apiKey === "string"
        ? candidate.apiKey
        : DEFAULT_AI_SETTINGS.apiKey,
    apiBaseUrl:
      typeof candidate.apiBaseUrl === "string" && candidate.apiBaseUrl.trim()
        ? candidate.apiBaseUrl.trim()
        : DEFAULT_AI_SETTINGS.apiBaseUrl,
    selectedModel,
    customModel:
      typeof candidate.customModel === "string"
        ? candidate.customModel
        : DEFAULT_AI_SETTINGS.customModel,
    quality,
    enableMermaid:
      typeof candidate.enableMermaid === "boolean"
        ? candidate.enableMermaid
        : DEFAULT_AI_SETTINGS.enableMermaid,
  };
}

export function loadAiSettings(): AiSettings {
  try {
    const serializedSettings = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);

    if (!serializedSettings) {
      return DEFAULT_AI_SETTINGS;
    }

    return sanitizeAiSettings(JSON.parse(serializedSettings));
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAiSettings(settings: AiSettings) {
  localStorage.setItem(
    AI_SETTINGS_STORAGE_KEY,
    JSON.stringify(sanitizeAiSettings(settings)),
  );
}

export function resolveAiModel(settings: AiSettings) {
  if (settings.selectedModel === "custom") {
    return settings.customModel.trim() || DEFAULT_AI_SETTINGS.selectedModel;
  }

  return settings.selectedModel;
}

export function getAiResponsesUrl(apiBaseUrl: string) {
  const normalizedBaseUrl = apiBaseUrl.trim() || DEFAULT_AI_API_BASE_URL;
  const url = new URL(normalizedBaseUrl);
  let path = url.pathname.replace(/\/+$/, "");

  if (path.endsWith("/responses")) {
    path = path.slice(0, -"/responses".length);
  }

  if (!path.endsWith("/v1")) {
    path = `${path}/v1`;
  }

  url.pathname = `${path}/responses`;
  return url.toString();
}

export function validateAiApiBaseUrl(apiBaseUrl: string) {
  try {
    const url = new URL(apiBaseUrl.trim() || DEFAULT_AI_API_BASE_URL);

    if (url.protocol !== "https:") {
      return "AI API base URL must use HTTPS.";
    }

    return null;
  } catch {
    return "Enter a valid AI API base URL.";
  }
}
