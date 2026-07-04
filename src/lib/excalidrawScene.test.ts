import { describe, expect, it } from "vitest";
import { prepareSceneForExcalidraw, prepareSceneForStorage } from "./excalidrawScene";

describe("Excalidraw scene normalization", () => {
  it("removes runtime-only appState before storage", () => {
    const scene = prepareSceneForStorage({
      type: "excalidraw",
      elements: [{ id: "rect" }],
      appState: {
        collaborators: new Map(),
        selectedElementIds: { rect: true },
        viewBackgroundColor: "#ffffff",
        zoom: { value: 1 },
      },
      files: {},
    });

    expect(scene.appState).toEqual({
      viewBackgroundColor: "#ffffff",
      zoom: { value: 1 },
    });
  });

  it("normalizes reopened scenes that already contain JSON-serialized runtime state", () => {
    const scene = prepareSceneForExcalidraw({
      type: "excalidraw",
      elements: [],
      appState: {
        collaborators: {},
        editingTextElement: null,
        viewBackgroundColor: "#f8f9fa",
      },
      files: {},
    });

    expect(scene.appState).toEqual({ viewBackgroundColor: "#f8f9fa" });
  });

  it("expands narrow text elements before opening generated scenes", () => {
    const scene = prepareSceneForExcalidraw({
      type: "excalidraw",
      elements: [
        {
          id: "text",
          type: "text",
          text: "Conversation Intelligence",
          originalText: "Conversation Intelligence",
          width: 80,
          height: 24,
        },
      ],
      appState: {},
      files: {},
    });

    expect(Number((scene.elements[0] as Record<string, unknown>).width)).toBeGreaterThan(
      200,
    );
  });

  it("removes AI-provided element indices so Excalidraw can assign safe ordering", () => {
    const scene = prepareSceneForExcalidraw({
      type: "excalidraw",
      elements: [
        {
          id: "generated-text",
          type: "text",
          index: "c10",
          text: "Generated label",
          originalText: "Generated label",
          width: 180,
          height: 24,
        },
      ],
      appState: {},
      files: {},
    });

    expect(scene.elements[0]).not.toHaveProperty("index");
  });
});
