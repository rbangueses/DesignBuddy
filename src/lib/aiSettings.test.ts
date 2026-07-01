import { beforeEach, describe, expect, it } from "vitest";
import {
  AI_MODEL_OPTIONS,
  DEFAULT_AI_SETTINGS,
  loadAiSettings,
  resolveAiModel,
  saveAiSettings,
} from "./aiSettings";

describe("aiSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads defaults when no AI settings have been saved", () => {
    expect(loadAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
  });

  it("persists the API key, selected model, custom model, quality, and Mermaid setting", () => {
    saveAiSettings({
      apiKey: "sk-test",
      selectedModel: "custom",
      customModel: "gpt-custom-diagrams",
      quality: "high",
      enableMermaid: false,
    });

    expect(loadAiSettings()).toEqual({
      apiKey: "sk-test",
      selectedModel: "custom",
      customModel: "gpt-custom-diagrams",
      quality: "high",
      enableMermaid: false,
    });
  });

  it("falls back to the default model when stored settings are invalid", () => {
    localStorage.setItem(
      "banguesesdraw.aiSettings",
      JSON.stringify({ selectedModel: "missing", quality: "expensive" }),
    );

    expect(loadAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
  });

  it("resolves custom models only when a custom model id is present", () => {
    expect(
      resolveAiModel({
        ...DEFAULT_AI_SETTINGS,
        selectedModel: "custom",
        customModel: "gpt-custom-diagrams",
      }),
    ).toBe("gpt-custom-diagrams");

    expect(resolveAiModel({ ...DEFAULT_AI_SETTINGS, selectedModel: "custom" })).toBe(
      AI_MODEL_OPTIONS[0].id,
    );
  });
});
