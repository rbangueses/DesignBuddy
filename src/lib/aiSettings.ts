export const AI_SETTINGS_STORAGE_KEY = "banguesesdraw.aiSettings";

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
  selectedModel: AiModelId;
  customModel: string;
  quality: AiQuality;
  enableMermaid: boolean;
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  apiKey: "",
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
