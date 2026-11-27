import { describe, expect, it } from "vitest";
import { normalizeAiScene, type TextMeasurer } from "./aiSceneLayout";
import { prepareSceneForStorage } from "./excalidrawScene";
import type { ExcalidrawScene } from "../types/excalidraw";

type Element = Record<string, unknown>;
const measure: TextMeasurer = (text, size) => Array.from(text).reduce((width, char) =>
  width + size * (char === "W" ? 0.9 : char === "i" ? 0.2 : 0.6), 0);
const shape = (id: string, x: number, y: number, width = 240, height = 52): Element => ({
  id, type: "rectangle", x, y, width, height, boundElements: [], locked: true,
});
const text = (id: string, label: string, x: number, y: number, width = 220): Element => ({
  id, type: "text", text: label, originalText: label, x, y, width, height: 26,
  fontSize: 16, fontFamily: 3, lineHeight: 1.25, textAlign: "center", containerId: null, locked: true,
});
const scene = (elements: Element[]): ExcalidrawScene => ({ type: "excalidraw", elements, appState: {}, files: {} });
const elementsOf = (value: ExcalidrawScene) => new Map((value.elements as Element[]).map((element) => [element.id, element]));

describe("AI scene layout", () => {
  it("wraps and binds a long label with padding, without shrinking the font", () => {
    const input = scene([
      shape("box", 690, 124, 285, 54),
      text("label", "Support UI + provider selector", 692, 137, 281),
    ]);
    const result = normalizeAiScene(input, measure);
    const elements = elementsOf(result);
    const box = elements.get("box")!;
    const label = elements.get("label")!;

    expect(label.fontSize).toBe(18);
    expect(label.text).toContain("\n");
    expect(label.originalText).toBe("Support UI + provider selector");
    expect(label.containerId).toBe("box");
    expect(box.boundElements).toContainEqual({ id: "label", type: "text" });
    expect(Number(label.x)).toBeGreaterThanOrEqual(Number(box.x) + 12);
    expect(Number(label.x) + Number(label.width)).toBeLessThanOrEqual(Number(box.x) + Number(box.width) - 12);
    expect(Number(label.y) + Number(label.height)).toBeLessThanOrEqual(Number(box.y) + Number(box.height) - 12);
    expect(input.elements[0]).toMatchObject({ height: 54, locked: true });
    expect(prepareSceneForStorage(result).elements).toEqual(result.elements);
  });

  it("uses font measurements rather than character counts and preserves alignment", () => {
    const result = elementsOf(normalizeAiScene(scene([
      text("wide", "WWWW", 100, 100, 200),
      text("narrow", "iiii", 100, 160, 200),
    ]), measure));
    const wide = result.get("wide")!;
    const narrow = result.get("narrow")!;

    expect(Number(wide.width)).toBeGreaterThan(Number(narrow.width) * 3);
    expect(Number(wide.x) + Number(wide.width) / 2).toBe(200);
    expect(Number(narrow.x) + Number(narrow.width) / 2).toBe(200);
    expect(wide.height).toBe(20);
  });

  it("unlocks all new content including background regions and headings", () => {
    const result = normalizeAiScene(scene([
      shape("region", 0, 0, 600, 640),
      text("heading", "CUSTOMER-OWNED", 20, 20),
      shape("box", 40, 100),
      text("label", "Support UI", 50, 110),
    ]), measure);

    expect(result.elements.every((element) => !(element as Element).locked)).toBe(true);
    expect(elementsOf(result).get("heading")?.containerId).toBeNull();
  });

  it("preserves existing user locks and untouched layout when modifying a scene", () => {
    const original = scene([
      shape("locked", 0, 0),
      text("locked-label", "Existing label", 10, 10),
      { ...shape("editable", 0, 100), locked: false },
    ]);
    const generated = scene([
      { ...original.elements[0] as Element, locked: false },
      { ...original.elements[1] as Element, locked: false },
      { ...original.elements[2] as Element, locked: true },
      shape("new", 0, 200),
    ]);
    const result = elementsOf(normalizeAiScene(generated, measure, original));

    expect(result.get("locked")).toMatchObject({ locked: true, x: 0, y: 0 });
    expect(result.get("locked-label")).toEqual(original.elements[1]);
    expect(result.get("editable")?.locked).toBe(false);
    expect(result.get("new")?.locked).toBe(false);
  });

  it("separates overlapping sibling nodes, grows their region, and moves connector endpoints", () => {
    const input = scene([
      shape("region", 600, 100, 560, 530),
      shape("systems", 875, 562, 245, 52),
      text("systems-label", "Client systems / cases", 883, 575, 229),
      shape("integration", 650, 590, 300, 52),
      text("integration-label", "Custom agent integration", 660, 603, 280),
      {
        id: "arrow", type: "arrow", x: 900, y: 400, width: 50, height: 190,
        points: [[0, 0], [-50, 190]], endBinding: { elementId: "integration", focus: 0, gap: 0 },
      },
    ]);
    const elements = elementsOf(normalizeAiScene(input, measure));
    const systems = elements.get("systems")!;
    const integration = elements.get("integration")!;
    const region = elements.get("region")!;
    const arrow = elements.get("arrow")!;
    const points = arrow.points as number[][];

    expect(Number(integration.y)).toBeGreaterThanOrEqual(Number(systems.y) + Number(systems.height) + 24);
    expect(Number(region.y) + Number(region.height)).toBeGreaterThanOrEqual(Number(integration.y) + Number(integration.height) + 24);
    expect(Number(arrow.y) + points[points.length - 1][1]).toBe(integration.y);
    expect(elements.get("integration-label")?.containerId).toBe("integration");
  });

  it("keeps annotations separate when a box contains multiple labels", () => {
    const result = elementsOf(normalizeAiScene(scene([
      shape("box", 0, 0, 300, 100),
      text("title", "Title", 10, 10),
      text("subtitle", "Subtitle", 10, 50),
    ]), measure));
    expect(result.get("title")?.containerId).toBeNull();
    expect(result.get("subtitle")?.containerId).toBeNull();
  });

  it("keeps connectors attached when an AI label edit needs a taller box", () => {
    const original = scene([
      shape("box", 0, 0, 160, 52),
      { ...text("label", "UI", 10, 10, 140), containerId: "box" },
      {
        id: "arrow", type: "arrow", x: 80, y: 52, points: [[0, 0], [0, 100]],
        startBinding: { elementId: "box", focus: 0, gap: 0 },
      },
    ]);
    const generated = scene(original.elements.map((el) => (el as Element).id === "label"
      ? { ...el as Element, text: "Support UI + provider selector" } : { ...el as Element }));
    const result = elementsOf(normalizeAiScene(generated, measure, original));
    const box = result.get("box")!;
    const arrow = result.get("arrow")!;
    expect(Number(box.height)).toBeGreaterThan(52);
    expect(arrow.y).toBe(box.height);
    expect(Number(arrow.y) + (arrow.points as number[][])[1][1]).toBe(152);
    expect(result.get("label")?.originalText).toBe("Support UI + provider selector");
    expect(box.y).toBe(0);
  });

  it("retargets arrows attached to a node's text to its newly bound box", () => {
    const result = elementsOf(normalizeAiScene(scene([
      shape("box", 0, 0),
      { ...text("label", "Support UI", 10, 10), boundElements: [{ id: "arrow", type: "arrow" }] },
      { id: "arrow", type: "arrow", x: 240, y: 26, points: [[0, 0], [100, 0]], startBinding: { elementId: "label", focus: 0, gap: 0 } },
    ]), measure));
    expect(result.get("arrow")?.startBinding).toMatchObject({ elementId: "box" });
    expect(result.get("box")?.boundElements).toContainEqual({ id: "arrow", type: "arrow" });
    expect(result.get("label")?.boundElements).toBeNull();
  });
});
