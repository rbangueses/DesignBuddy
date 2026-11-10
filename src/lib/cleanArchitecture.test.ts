import { describe, expect, it } from "vitest";
import { isExcalidrawScene } from "./sceneValidation";
import {
  cleanArchitectureSpecToExcalidrawScene,
  normalizeCleanArchitectureSpec,
  parseCleanArchitectureSpec,
} from "./cleanArchitecture";

describe("clean architecture rendering", () => {
  it("uses roles to keep associations and returns distinct from primary flows", () => {
    const spec = parseCleanArchitectureSpec(JSON.stringify({
      nodes: [
        { id: "user", label: "User", role: "external" },
        { id: "twilio", label: "Twilio", role: "channel", componentId: "twilio" },
        { id: "voice", label: "Prog. Voice", role: "channel", componentId: "voice" },
        { id: "flex", label: "Flex", role: "context", componentId: "flex", subtitle: "Salesforce SCV" },
        { id: "messaging", label: "Prog. Messaging", role: "channel", componentId: "messaging", subtitle: "API" },
        { id: "webhook", label: "Webhook/backend", role: "integration" },
        { id: "agent", label: "Agent infrastructure", role: "agent" },
        { id: "llm", label: "LLM", role: "support" },
      ],
      edges: [
        { from: "user", to: "voice", role: "primary" },
        { from: "twilio", to: "voice", role: "association" },
        { from: "voice", to: "agent", label: "Conversation Relay", role: "primary" },
        { from: "agent", to: "voice", label: "updateCall", role: "return" },
        { from: "voice", to: "flex", role: "primary" },
        { from: "messaging", to: "webhook", role: "primary" },
        { from: "webhook", to: "agent", role: "primary" },
        { from: "agent", to: "messaging", role: "return" },
        { from: "messaging", to: "user", role: "return" },
        { from: "agent", to: "llm", role: "dependency" },
      ],
    }));
    const scene = cleanArchitectureSpecToExcalidrawScene(spec);
    const elements = scene.elements as Array<Record<string, unknown>>;
    const association = elements.find((element) => element.id === "clean-edge-001");
    const returnArrow = elements.find((element) => element.id === "clean-edge-003");

    expect(isExcalidrawScene(scene)).toBe(true);
    expect(association).toMatchObject({ type: "line", strokeStyle: "dashed", endArrowhead: null });
    expect(returnArrow).toMatchObject({ type: "arrow", endArrowhead: "arrow" });
    expect(JSON.stringify(elements)).toContain("Salesforce SCV");
  });

  it("uses compact dedicated rails for voice and messaging responses", () => {
    const spec = parseCleanArchitectureSpec(JSON.stringify({
      nodes: [
        { id: "user", label: "User", role: "external" },
        { id: "voice", label: "Prog. Voice", role: "channel", componentId: "voice" },
        { id: "messaging", label: "Prog. Messaging", role: "channel", componentId: "messaging" },
        { id: "agent", label: "Agent infrastructure", role: "agent" },
      ],
      edges: [
        { from: "user", to: "voice", role: "primary" },
        { from: "voice", to: "agent", role: "primary" },
        { from: "agent", to: "voice", role: "return" },
        { from: "agent", to: "messaging", role: "return" },
        { from: "messaging", to: "user", role: "return" },
      ],
    }));
    const scene = cleanArchitectureSpecToExcalidrawScene(spec);
    const arrows = (scene.elements as Array<Record<string, unknown>>).filter(
      (element) => element.type === "arrow",
    );

    expect(arrows).toHaveLength(5);
    arrows.filter((arrow) => arrow.id !== "clean-edge-003").slice(2).forEach((arrow) => {
      expect(Array.isArray(arrow.points)).toBe(true);
      expect((arrow.points as unknown[]).length).toBe(4);
    });
    expect((arrows.find((arrow) => arrow.id === "clean-edge-003")?.points as unknown[]).length).toBe(2);
  });

  it("leaves a visible routing corridor before the channel column", () => {
    const spec = parseCleanArchitectureSpec(JSON.stringify({
      nodes: [
        { id: "user", label: "User", role: "external" },
        { id: "messaging", label: "Prog. Messaging", role: "channel", componentId: "messaging" },
      ],
      edges: [{ from: "user", to: "messaging", role: "primary" }],
    }));
    const scene = cleanArchitectureSpecToExcalidrawScene(spec);
    const inboundArrow = (scene.elements as Array<Record<string, unknown>>).find(
      (element) => element.id === "clean-edge-000",
    );

    expect(Number(inboundArrow?.width)).toBe(180);
  });

  it("uses a compact external actor node and wraps long generic labels", () => {
    const spec = parseCleanArchitectureSpec(JSON.stringify({
      nodes: [
        { id: "user", label: "User", role: "external" },
        { id: "backend", label: "Messaging Webhook / Backend", role: "integration" },
      ],
      edges: [{ from: "user", to: "backend", role: "primary" }],
    }));
    const scene = cleanArchitectureSpecToExcalidrawScene(spec);
    const elements = scene.elements as Array<Record<string, unknown>>;
    const userShape = elements.find((element) => element.id === "clean-node-000");

    expect(userShape).toMatchObject({ type: "ellipse", width: 140 });
    expect(JSON.stringify(elements)).toContain("Messaging Webhook\\nBackend");
  });

  it("converts component labels with qualifiers into library components", () => {
    const spec = parseCleanArchitectureSpec(JSON.stringify({
      nodes: [
        { id: "flex", label: "Flex / Salesforce SCV", role: "context" },
        { id: "user", label: "User", role: "external" },
      ],
      edges: [{ from: "user", to: "flex", role: "primary" }],
    }));

    expect(spec.nodes[0]).toMatchObject({
      label: "Flex / Salesforce SCV",
      componentId: "flex",
      subtitle: "Salesforce SCV",
    });
  });

  it("recognizes expanded names for abbreviated library components", () => {
    const spec = parseCleanArchitectureSpec(JSON.stringify({
      nodes: [
        { id: "messaging", label: "Programmable Messaging", role: "channel" },
        { id: "voice", label: "Programmable Voice API", role: "channel" },
        { id: "messaging-api", label: "Prog. Messaging API", role: "channel" },
      ],
      edges: [{ from: "messaging", to: "voice", role: "primary" }],
    }));

    expect(spec.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "messaging", componentId: "messaging" }),
      expect.objectContaining({ id: "voice", componentId: "voice" }),
      expect.objectContaining({ id: "messaging-api", componentId: "messaging" }),
    ]));
  });

  it("renders reciprocal User and Messaging flows as one two-headed arrow", () => {
    const spec = parseCleanArchitectureSpec(JSON.stringify({
      nodes: [
        { id: "user", label: "User", role: "external" },
        { id: "messaging", label: "Prog. Messaging", role: "channel", componentId: "messaging" },
      ],
      edges: [
        { from: "user", to: "messaging", role: "primary" },
        { from: "messaging", to: "user", role: "return" },
      ],
    }));
    const elements = cleanArchitectureSpecToExcalidrawScene(spec).elements as Array<Record<string, unknown>>;
    const arrows = elements.filter((element) => element.type === "arrow");

    expect(arrows).toHaveLength(1);
    expect(arrows[0]).toMatchObject({ startArrowhead: "arrow", endArrowhead: "arrow" });
    expect((arrows[0].points as unknown[])).toHaveLength(2);
  });

  it("keeps only the nearest Twilio association when several channels share it", () => {
    const spec = parseCleanArchitectureSpec(JSON.stringify({
      nodes: [
        { id: "user", label: "User", role: "external" },
        { id: "twilio", label: "Twilio", role: "channel", componentId: "twilio" },
        { id: "voice", label: "Prog. Voice", role: "channel", componentId: "voice" },
        { id: "messaging", label: "Prog. Messaging", role: "channel", componentId: "messaging" },
        { id: "agent", label: "Agent infrastructure", role: "agent" },
      ],
      edges: [
        { from: "user", to: "voice", role: "primary" },
        { from: "twilio", to: "voice", role: "association" },
        { from: "twilio", to: "messaging", role: "association" },
        { from: "voice", to: "agent", role: "primary" },
      ],
    }));
    const scene = cleanArchitectureSpecToExcalidrawScene(spec);
    const associationLines = (scene.elements as Array<Record<string, unknown>>).filter(
      (element) => element.type === "line" && element.strokeStyle === "dashed",
    );

    expect(associationLines).toHaveLength(1);
  });

  it("normalizes the recognized messaging transport path without changing voice or support flows", () => {
    const spec = parseCleanArchitectureSpec(JSON.stringify({
      nodes: [
        { id: "user", label: "User", role: "external" },
        { id: "voice", label: "Prog. Voice", role: "channel", componentId: "voice" },
        { id: "messaging", label: "Prog. Messaging", role: "channel", componentId: "messaging" },
        { id: "webhook", label: "Webhook/backend", role: "integration" },
        { id: "agent", label: "Agent infrastructure", role: "agent" },
        { id: "llm", label: "LLM", role: "support" },
      ],
      edges: [
        { from: "user", to: "voice", role: "primary" },
        { from: "voice", to: "agent", role: "primary" },
        { from: "agent", to: "voice", role: "return" },
        { from: "user", to: "messaging", label: "incoming message", role: "primary" },
        { from: "messaging", to: "webhook", label: "webhook", role: "primary" },
        { from: "webhook", to: "agent", role: "primary" },
        { from: "agent", to: "webhook", label: "response", role: "return" },
        { from: "messaging", to: "user", role: "return" },
        { from: "agent", to: "llm", role: "dependency" },
      ],
    }));

    const normalized = normalizeCleanArchitectureSpec(spec);
    expect(normalized.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "webhook", label: "Messaging backend", subtitle: undefined }),
      expect.objectContaining({ id: "messaging", subtitle: undefined }),
    ]));
    expect(normalized.edges).toEqual(expect.arrayContaining([
      { from: "user", to: "voice", role: "primary" },
      { from: "voice", to: "agent", role: "primary" },
      { from: "agent", to: "voice", role: "return" },
      { from: "agent", to: "llm", role: "dependency" },
      { from: "user", to: "messaging", label: "incoming message", role: "primary" },
      { from: "messaging", to: "webhook", label: "inbound webhook", role: "primary" },
      { from: "webhook", to: "agent", label: "invoke agent", role: "primary" },
      { from: "agent", to: "webhook", label: "agent response", role: "return" },
      { from: "webhook", to: "messaging", label: "send message", role: "return" },
      { from: "messaging", to: "user", role: "return" },
    ]));
    expect(normalized.edges).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ from: "agent", to: "messaging" }),
    ]));
  });

  it("makes agent support services parallel dependencies rather than a chain", () => {
    const spec = parseCleanArchitectureSpec(JSON.stringify({
      nodes: [
        { id: "agent", label: "Agent infrastructure", role: "agent" },
        { id: "llm", label: "LLM", role: "support" },
        { id: "logic", label: "Business logic", role: "support" },
        { id: "tools", label: "Tools", role: "support" },
      ],
      edges: [
        { from: "agent", to: "llm", role: "dependency" },
        { from: "llm", to: "logic", role: "dependency" },
        { from: "logic", to: "tools", role: "dependency" },
      ],
    }));

    const normalized = normalizeCleanArchitectureSpec(spec);
    expect(normalized.edges).toEqual([
      { from: "agent", to: "llm", label: undefined, role: "dependency" },
      { from: "agent", to: "logic", label: undefined, role: "dependency" },
      { from: "agent", to: "tools", label: undefined, role: "dependency" },
    ]);
  });

  it("expands common agent support shorthand into separate dependency nodes", () => {
    const spec = parseCleanArchitectureSpec(JSON.stringify({
      nodes: [
        { id: "agent", label: "Agent infrastructure", role: "agent", subtitle: "LLM · Business logic · Tools" },
        { id: "user", label: "User", role: "external" },
      ],
      edges: [{ from: "user", to: "agent", role: "primary" }],
    }));

    const normalized = normalizeCleanArchitectureSpec(spec);
    expect(normalized.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "LLM", role: "support" }),
      expect.objectContaining({ label: "Business logic", role: "support" }),
      expect.objectContaining({ label: "Tools", role: "support" }),
      expect.objectContaining({ id: "agent", subtitle: undefined }),
    ]));
    expect(normalized.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: "agent", to: "agent-support-llm", role: "dependency" }),
      expect.objectContaining({ from: "agent", to: "agent-support-business-logic", role: "dependency" }),
      expect.objectContaining({ from: "agent", to: "agent-support-tools", role: "dependency" }),
    ]));
  });

  it("rejects unsupported node and edge roles", () => {
    expect(() => parseCleanArchitectureSpec(JSON.stringify({
      nodes: [{ id: "a", label: "A", role: "unknown" }],
      edges: [],
    }))).toThrow("too large or incomplete");
  });

  it("rejects traffic flows that incorrectly use the Twilio ownership badge", () => {
    expect(() => parseCleanArchitectureSpec(JSON.stringify({
      nodes: [
        { id: "user", label: "User", role: "external" },
        { id: "twilio", label: "Twilio", role: "channel", componentId: "twilio" },
      ],
      edges: [{ from: "user", to: "twilio", role: "primary" }],
    }))).toThrow("Twilio badge can only use association edges");
  });
});
