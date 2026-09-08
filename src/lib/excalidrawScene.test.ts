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

  it("keeps centered unbound text visually centered when expanding its width", () => {
    const scene = prepareSceneForStorage({
      type: "excalidraw",
      elements: [
        {
          id: "label",
          type: "text",
          text: "Twilio Phone Number\nTwilio Voice",
          originalText: "Twilio Phone Number\nTwilio Voice",
          x: 420,
          y: 300,
          width: 80,
          height: 54,
          textAlign: "center",
          containerId: null,
        },
      ],
      appState: {},
      files: {},
    });

    const label = scene.elements[0] as Record<string, unknown>;

    expect(label.width).toBeGreaterThan(80);
    expect(
      Number(label.x) + Number(label.width) / 2,
    ).toBeCloseTo(460);
  });

  it("does not resize text bound to a container when saving or reopening", () => {
    const scene = prepareSceneForStorage({
      type: "excalidraw",
      elements: [
        {
          id: "container",
          type: "ellipse",
          x: 10,
          y: 20,
          width: 180,
          height: 120,
          boundElements: [{ id: "label", type: "text" }],
        },
        {
          id: "label",
          type: "text",
          text: "Twilio WhatsApp",
          originalText: "Twilio WhatsApp",
          containerId: "container",
          x: 56,
          y: 68,
          width: 64,
          height: 48,
        },
      ],
      appState: {},
      files: {},
    });

    expect(scene.elements[1]).toMatchObject({
      id: "label",
      containerId: "container",
      width: 64,
      height: 48,
    });
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
