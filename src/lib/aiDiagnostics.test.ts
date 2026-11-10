import { beforeEach, describe, expect, it } from "vitest";
import { saveAiSettings, DEFAULT_AI_SETTINGS } from "./aiSettings";
import { clearAiDiagnostics, getAiDiagnosticCount, recordAiDiagnostic } from "./aiDiagnostics";

describe("aiDiagnostics", () => {
  beforeEach(() => {
    localStorage.clear();
    clearAiDiagnostics();
  });

  it("does not write anything until diagnostics are enabled", () => {
    recordAiDiagnostic({
      operation: "generate-excalidraw", status: "success", model: "test", quality: "balanced",
      timeoutMs: 90_000, durationMs: 10, promptLength: 20, rawResponse: "private output",
    });
    expect(getAiDiagnosticCount()).toBe(0);
  });

  it("records metadata but excludes raw responses by default", () => {
    saveAiSettings({ ...DEFAULT_AI_SETTINGS, enableDiagnostics: true });
    recordAiDiagnostic({
      operation: "generate-excalidraw", status: "success", model: "test", quality: "balanced",
      timeoutMs: 90_000, durationMs: 10, promptLength: 20, rawResponse: "private output",
      referenceImage: { name: "architecture.png", mimeType: "image/png", size: 1234 },
    });

    const entries = JSON.parse(localStorage.getItem("banguesesdraw.aiDiagnostics") ?? "[]") as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(1);
    expect(entries[0].rawResponse).toBeUndefined();
    expect(entries[0].referenceImage).toEqual({ name: "architecture.png", mimeType: "image/png", size: 1234 });
  });
});
