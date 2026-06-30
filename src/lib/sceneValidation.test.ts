import { describe, expect, it } from "vitest";
import { isExcalidrawScene } from "./sceneValidation";

describe("isExcalidrawScene", () => {
  it("accepts a minimal Excalidraw scene", () => {
    expect(
      isExcalidrawScene({
        type: "excalidraw",
        elements: [],
        appState: {},
        files: {},
      }),
    ).toBe(true);
  });

  it("rejects invalid scene data", () => {
    expect(isExcalidrawScene({ type: "other", elements: [] })).toBe(false);
    expect(isExcalidrawScene(null)).toBe(false);
  });
});
