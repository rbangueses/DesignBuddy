import { describe, expect, it } from "vitest";
import { isExcalidrawScene } from "./sceneValidation";
import { mermaidToExcalidrawScene } from "./mermaidToExcalidraw";

function textPosition(scene: ReturnType<typeof mermaidToExcalidrawScene>, text: string) {
  const element = scene.elements.find(
    (candidate) =>
      typeof candidate === "object" &&
      candidate !== null &&
      "type" in candidate &&
      candidate.type === "text" &&
      "originalText" in candidate &&
      candidate.originalText === text,
  );

  if (!element || typeof element !== "object" || !("x" in element) || !("y" in element)) {
    throw new Error(`Missing text element: ${text}`);
  }

  return { x: Number(element.x), y: Number(element.y) };
}

function textElement(scene: ReturnType<typeof mermaidToExcalidrawScene>, text: string) {
  const element = scene.elements.find(
    (candidate) =>
      typeof candidate === "object" &&
      candidate !== null &&
      "type" in candidate &&
      candidate.type === "text" &&
      "originalText" in candidate &&
      candidate.originalText === text,
  );

  if (!element || typeof element !== "object") {
    throw new Error(`Missing text element: ${text}`);
  }

  return element as Record<string, unknown>;
}

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

  it("converts compact AI-generated Mermaid with chained arrows", () => {
    const scene = mermaidToExcalidrawScene(
      [
        "flowchart TD",
        "CI[Conversation Intelligence]",
        "MSG[Messaging Channels]",
        "VOICE[Voice]",
        "RELAY[Conversation Relay]",
        "ORCH[Twilio Orchestrator]",
        "MEM[(Memory)]",
        "TAC[Twilio Agent Connect]",
        "P3P[3rd Party Infra]",
        "SUM[Summaries / Observations]",
        "",
        "CI --> MEM",
        "MSG --> ORCH",
        "ORCH -->|trigger| MEM --> SUM",
        "ORCH -->|messaging| TAC",
        "TAC --> P3P",
        "VOICE --> RELAY --> TAC",
      ].join("\n"),
    );

    expect(isExcalidrawScene(scene)).toBe(true);
    expect(JSON.stringify(scene.elements)).toContain("Conversation Intelligence");
    expect(JSON.stringify(scene.elements)).toContain("Conversation Relay");
    expect(JSON.stringify(scene.elements)).toContain("trigger");
    expect(JSON.stringify(scene.elements)).toContain("messaging");
    expect(
      scene.elements.filter(
        (element) =>
          typeof element === "object" &&
          element !== null &&
          "type" in element &&
          element.type === "arrow",
      ),
    ).toHaveLength(8);
  });

  it("orders top-down rows by connected paths instead of parse order", () => {
    const scene = mermaidToExcalidrawScene(
      [
        "flowchart TD",
        "CI[Conversation Intelligence]",
        "MSG[Messaging Channels]",
        "VOICE[Voice]",
        "RELAY[Conversation Relay]",
        "ORCH[Twilio Orchestrator]",
        "MEM[(Memory)]",
        "TAC[Twilio Agent Connect]",
        "P3P[3rd Party Infra]",
        "SUM[Summaries / Observations]",
        "",
        "CI --> MEM",
        "MSG --> ORCH",
        "ORCH -->|trigger| MEM --> SUM",
        "ORCH -->|messaging| TAC",
        "TAC --> P3P",
        "VOICE --> RELAY --> TAC",
      ].join("\n"),
    );

    expect(textPosition(scene, "Twilio Orchestrator").x).toBeLessThan(
      textPosition(scene, "Conversation Relay").x,
    );
    expect(textPosition(scene, "Memory").x).toBeLessThan(
      textPosition(scene, "Twilio Agent Connect").x,
    );
    expect(textPosition(scene, "Summaries / Observations").x).toBeLessThan(
      textPosition(scene, "3rd Party Infra").x,
    );
  });

  it("gives node labels enough width to render without recalculation", () => {
    const scene = mermaidToExcalidrawScene(
      "flowchart TD\n  CI[Conversation Intelligence] --> SUM[Summaries / Observations]\n",
    );
    const conversationLabel = textElement(scene, "Conversation Intelligence");
    const summariesLabel = textElement(scene, "Summaries / Observations");

    expect(Number(conversationLabel.width)).toBeGreaterThanOrEqual(220);
    expect(Number(summariesLabel.width)).toBeGreaterThanOrEqual(220);
  });
});
