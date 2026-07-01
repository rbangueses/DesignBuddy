import { describe, expect, it } from "vitest";
import { isExcalidrawScene } from "./sceneValidation";
import { mermaidToExcalidrawScene } from "./mermaidToExcalidraw";

describe("mermaidToExcalidrawScene", () => {
  it("creates a valid Excalidraw scene from a simple flowchart", () => {
    const scene = mermaidToExcalidrawScene(
      "flowchart LR\n  A[Start] -->|go| B[Done]\n",
    );

    expect(isExcalidrawScene(scene)).toBe(true);
    expect(
      scene.elements.some(
        (element) =>
          typeof element === "object" &&
          element !== null &&
          "type" in element &&
          element.type === "rectangle",
      ),
    ).toBe(true);
    expect(
      scene.elements.some(
        (element) =>
          typeof element === "object" &&
          element !== null &&
          "type" in element &&
          element.type === "arrow",
      ),
    ).toBe(true);
    expect(JSON.stringify(scene.elements)).toContain("Start");
    expect(JSON.stringify(scene.elements)).toContain("Done");
    expect(JSON.stringify(scene.elements)).toContain("go");
  });
});
