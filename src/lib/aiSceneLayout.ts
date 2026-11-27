import type { ExcalidrawScene } from "../types/excalidraw";
import type { FontFamilyValues } from "@excalidraw/excalidraw/element/types";

type Element = Record<string, unknown> & { id: string; type: string };
type Box = Element & { x: number; y: number; width: number; height: number };
type Point = [number, number];
export type TextMeasurer = (text: string, fontSize: number, fontFamily: number) => number;

const PADDING = 12;
const NODE_GAP = 24;
const FONT_NAMES: Record<number, string> = {
  1: "Virgil", 2: "Helvetica", 3: "Cascadia", 5: "Excalifont",
  6: "Nunito", 7: "Lilita One", 8: "Comic Shanns",
};
const LAYOUT_KEYS = ["text", "originalText", "fontSize", "fontFamily", "lineHeight", "x", "y", "width", "height", "angle", "containerId"];

function isElement(value: unknown): value is Element {
  return Boolean(value && typeof value === "object" &&
    typeof (value as Element).id === "string" && typeof (value as Element).type === "string");
}

function isBox(element: Element): element is Box {
  return ["rectangle", "ellipse", "diamond"].includes(element.type) &&
    [element.x, element.y, element.width, element.height].every((n) => typeof n === "number" && Number.isFinite(n)) &&
    Number(element.width) > 0 && Number(element.height) > 0 && !element.angle;
}

function contains(outer: Box, inner: Box) {
  return outer.x <= inner.x && outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function wrapText(text: string, maxWidth: number, measure: (text: string) => number) {
  return text.split("\n").flatMap((paragraph) => {
    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      if (line && measure(`${line} ${word}`) <= maxWidth) {
        line += ` ${word}`;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const char of word) {
        if (line && measure(line + char) > maxWidth) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    lines.push(line);
    return lines;
  }).join("\n");
}

function labelFitsInside(label: Element, box: Box) {
  const x = Number(label.x);
  const y = Number(label.y);
  const width = Number(label.width);
  const height = Number(label.height);
  return x + width / 2 >= box.x && x + width / 2 <= box.x + box.width &&
    y >= box.y - 2 && y + height <= box.y + box.height + 2;
}

function addBinding(element: Element, id: string, type: "text" | "arrow") {
  const bindings = Array.isArray(element.boundElements) ? element.boundElements : [];
  element.boundElements = [...bindings.filter((entry) => entry?.id !== id), { id, type }];
}

function mapAxis(value: number, oldMin: number, oldSize: number, min: number, size: number) {
  if (value < oldMin) return min + value - oldMin;
  if (value > oldMin + oldSize) return min + size + value - oldMin - oldSize;
  return min + (value - oldMin) / oldSize * size;
}

function moveConnectorEnds(elements: Element[], before: Map<string, Box>, boxes: Box[]) {
  const findEndpointBox = (element: Element, key: string, point: Point) => {
    const binding = element[key] as { elementId?: string } | null;
    if (binding?.elementId && before.has(binding.elementId)) return before.get(binding.elementId);
    return [...before.values()].find((box) => {
      const [x, y] = point;
      return x >= box.x - 8 && x <= box.x + box.width + 8 &&
        y >= box.y - 8 && y <= box.y + box.height + 8 &&
        Math.min(Math.abs(x - box.x), Math.abs(x - box.x - box.width),
          Math.abs(y - box.y), Math.abs(y - box.y - box.height)) <= 8;
    });
  };
  const current = new Map(boxes.map((box) => [box.id, box]));
  for (const element of elements) {
    if (!["arrow", "line"].includes(element.type) || element.angle || !Array.isArray(element.points) || element.points.length < 2) continue;
    if (!element.points.every((point) => Array.isArray(point) && point.length === 2 && point.every((n) => typeof n === "number" && Number.isFinite(n)))) continue;
    const points = (element.points as Point[]).map(([x, y]): Point => [Number(element.x) + x, Number(element.y) + y]);
    const original = points.map((point) => [...point] as Point);
    for (const [index, key] of [[0, "startBinding"], [points.length - 1, "endBinding"]] as const) {
      const oldBox = findEndpointBox(element, key, original[index]);
      const box = oldBox && current.get(oldBox.id);
      if (!oldBox || !box) continue;
      points[index] = [
        mapAxis(original[index][0], oldBox.x, oldBox.width, box.x, box.width),
        mapAxis(original[index][1], oldBox.y, oldBox.height, box.y, box.height),
      ];
      // Preserve the direction of the first/last elbow segment.
      if (points.length > 2) {
        const neighbor = index === 0 ? 1 : index - 1;
        if (original[neighbor][0] === original[index][0]) points[neighbor][0] = points[index][0];
        if (original[neighbor][1] === original[index][1]) points[neighbor][1] = points[index][1];
      }
    }
    if (points.every((point, i) => point[0] === original[i][0] && point[1] === original[i][1])) continue;
    element.x = points[0][0];
    element.y = points[0][1];
    element.points = points.map(([x, y]) => [x - Number(element.x), y - Number(element.y)]);
    element.width = Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x));
    element.height = Math.max(...points.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y));
  }
}

/** Only run on AI output, never during autosave or when opening a user's scene. */
export function normalizeAiScene(
  scene: ExcalidrawScene,
  measureText: TextMeasurer,
  originalScene?: ExcalidrawScene,
): ExcalidrawScene {
  const originals = new Map((originalScene?.elements ?? []).filter(isElement).map((el) => [el.id, el]));
  const elements = scene.elements.filter(isElement).filter((el) => !el.isDeleted).map((el) => ({
    ...el,
    // The model must not make new content uneditable or unlock the user's work.
    locked: originals.get(el.id)?.locked === true,
  } as Element));
  const byId = new Map(elements.map((el) => [el.id, el]));
  const boxes = elements.filter(isBox);
  const backgrounds = new Set(boxes.filter((outer) => boxes.some((inner) =>
    outer.id !== inner.id && outer.width * outer.height > inner.width * inner.height && contains(outer, inner),
  )).map((box) => box.id));
  const nodes = boxes.filter((box) => !backgrounds.has(box.id));
  const before = new Map(nodes.map((box) => [box.id, { ...box }]));
  const parents = new Map(nodes.map((node) => [node.id, boxes.filter((box) => backgrounds.has(box.id) &&
    node.x + node.width / 2 >= box.x && node.x + node.width / 2 <= box.x + box.width &&
    node.y + node.height / 2 >= box.y && node.y + node.height / 2 <= box.y + box.height,
  )]));
  const labelContainers = new Map<string, Box>();

  for (const label of elements) {
    if (label.type !== "text" || label.angle) continue;
    const explicit = typeof label.containerId === "string" ? byId.get(label.containerId) : undefined;
    if (explicit) {
      if (isBox(explicit)) labelContainers.set(label.id, explicit);
      continue;
    }
    const matches = nodes.filter((box) => labelFitsInside(label, box))
      .sort((a, b) => a.width * a.height - b.width * b.height);
    if (matches[0]) labelContainers.set(label.id, matches[0]);
  }
  // Inferring one editable label is safe; several labels may be subtitles or annotations.
  const labelCounts = new Map<string, number>();
  for (const box of labelContainers.values()) labelCounts.set(box.id, (labelCounts.get(box.id) ?? 0) + 1);
  for (const [id, box] of labelContainers) {
    if (Number(labelCounts.get(box.id)) > 1 && !byId.get(id)?.containerId) {
      labelContainers.delete(id);
    }
  }

  const changedLabels = new Set<string>();
  for (const label of elements) {
    if (label.type !== "text" || label.angle) continue;
    const original = originals.get(label.id);
    const box = labelContainers.get(label.id);
    const oldBox = box && originals.get(box.id);
    const unchanged = original && LAYOUT_KEYS.every((key) => original[key] === label[key]) &&
      (!box || oldBox && LAYOUT_KEYS.every((key) => oldBox[key] === box[key]));
    if (unchanged) continue;
    if (label.containerId && !box) continue; // Arrow labels use Excalidraw's own placement.
    const rawText = original && label.text !== original.text && label.originalText === original.originalText
      ? label.text : typeof label.originalText === "string" ? label.originalText : label.text;
    if (typeof rawText !== "string" || !rawText.trim()) continue;
    const fontSize = Math.max(box ? 18 : 16, numberOr(label.fontSize, 20));
    const fontFamily = Number(label.fontFamily) in FONT_NAMES ? Number(label.fontFamily) : 2;
    const lineHeight = numberOr(label.lineHeight, 1.25);
    const measure = (text: string) => measureText(text, fontSize, fontFamily);
    const originalText = rawText.replace(/\r\n?/g, "\n");
    const factor = box?.type === "ellipse" ? Math.SQRT1_2 : box?.type === "diamond" ? 0.5 : 1;
    const text = box ? wrapText(originalText, Math.max(fontSize, box.width * factor - PADDING * 2), measure) : originalText;
    const lines = text.split("\n");
    const width = Math.ceil(Math.max(...lines.map(measure))) + 1;
    const height = lines.length * fontSize * lineHeight;
    const previousWidth = numberOr(label.width, width);
    const previousHeight = numberOr(label.height, height);
    if (box) {
      box.height = Math.max(box.height, Math.ceil((height + PADDING * 2) / factor));
      label.x = box.x + (box.width - width) / 2;
      label.y = label.verticalAlign === "top" ? box.y + PADDING : box.y + (box.height - height) / 2;
      label.containerId = box.id;
      label.textAlign = "center";
      label.verticalAlign = label.verticalAlign === "top" ? "top" : "middle";
      addBinding(box, label.id, "text");
    } else {
      const offset = label.textAlign === "center" ? 0.5 : label.textAlign === "right" ? 1 : 0;
      label.x = Number(label.x ?? 0) + (previousWidth - width) * offset;
      label.y = Number(label.y ?? 0) + (previousHeight - height) / 2;
    }
    Object.assign(label, { text, originalText, width, height, fontSize, fontFamily, lineHeight, autoResize: true });
    changedLabels.add(label.id);
  }

  for (const element of elements) {
    if (element.type !== "arrow") continue;
    for (const key of ["startBinding", "endBinding"]) {
      const binding = element[key] as { elementId?: string } | null;
      const box = binding?.elementId && changedLabels.has(binding.elementId) && labelContainers.get(binding.elementId);
      if (!box) continue;
      element[key] = { ...binding, elementId: box.id };
      addBinding(box, element.id, "arrow");
      byId.get(binding!.elementId!)!.boundElements = null;
    }
  }

  // Keep a new reference recreation close to the source, only moving nodes that
  // actually overlap. Existing diagrams retain the layout during AI modifications.
  if (!originalScene) {
    const placed: Box[] = [];
    for (const node of [...nodes].sort((a, b) => a.y - b.y || a.x - b.x)) {
      const previousY = node.y;
      let overlapping: Box | undefined;
      while ((overlapping = placed.find((other) => node.x < other.x + other.width && node.x + node.width > other.x &&
        node.y < other.y + other.height && node.y + node.height > other.y))) {
        node.y = overlapping.y + overlapping.height + NODE_GAP;
      }
      const dy = node.y - previousY;
      for (const [id, box] of labelContainers) {
        if (box.id === node.id && changedLabels.has(id)) byId.get(id)!.y = Number(byId.get(id)!.y) + dy;
      }
      for (const parent of parents.get(node.id) ?? []) {
        parent.height = Math.max(parent.height, node.y + node.height + NODE_GAP - parent.y);
      }
      placed.push(node);
    }
  }
  // Label wrapping can resize a box during modifications too. Keep its attached
  // connectors aligned without moving any of the user's other nodes.
  moveConnectorEnds(elements, before, nodes);

  return {
    ...scene,
    // Preserve deleted elements for Excalidraw history and AI-modify compatibility.
    elements: scene.elements.map((el) => isElement(el) ? byId.get(el.id) ?? el : el),
  };
}

async function browserTextMeasurer(elements: unknown[]): Promise<TextMeasurer> {
  const fallback: TextMeasurer = (text, size) => Array.from(text).length * size * 0.65;
  if (typeof document === "undefined" || !document.fonts) return fallback;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return fallback;
  try {
    const { convertToExcalidrawElements, exportToCanvas } = await import("@excalidraw/excalidraw");
    const labels = elements.filter(isElement).filter((el) => el.type === "text" && !el.isDeleted);
    if (!labels.length) return fallback;
    // The public export API loads Excalidraw's registered fonts. A one-pixel
    // scratch export avoids private font APIs and works before the first editor opens.
    const probes = convertToExcalidrawElements(labels.map((el) => ({
      type: "text" as const,
      x: 0, y: 0,
      text: typeof el.originalText === "string" ? el.originalText : String(el.text ?? ""),
      fontSize: 20,
      fontFamily: (Number(el.fontFamily) in FONT_NAMES ? Number(el.fontFamily) : 2) as FontFamilyValues,
    })));
    await exportToCanvas({ elements: probes, files: null, maxWidthOrHeight: 1 });
  } catch {
    // Font failure should not discard a valid generated diagram.
    return fallback;
  }
  return (text, size, family) => {
    const name = FONT_NAMES[family] ?? "Helvetica";
    context.font = `${size}px "${name}", ${family === 3 ? "monospace" : "sans-serif"}`;
    const width = context.measureText(text).width;
    return Number.isFinite(width) ? width : fallback(text, size, family);
  };
}

export async function prepareAiScene(scene: ExcalidrawScene, originalScene?: ExcalidrawScene) {
  return normalizeAiScene(scene, await browserTextMeasurer(scene.elements), originalScene);
}
