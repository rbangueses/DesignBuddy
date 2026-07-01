import { prepareSceneForStorage } from "./excalidrawScene";
import { parseMermaidFlowchart, type ParsedMermaidNode } from "./mermaidFlowchart";
import type { ExcalidrawScene } from "../types/excalidraw";

type Element = Record<string, unknown>;

const NODE_WIDTH = 260;
const NODE_HEIGHT = 76;
const GAP = 90;
const NODE_LABEL_PADDING = 16;

function elementId(prefix: string, index: number) {
  return `${prefix}-${index.toString(36).padStart(4, "0")}`;
}

function baseElement(id: string, type: string, x: number, y: number): Element {
  return {
    id,
    type,
    x,
    y,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 3 },
    seed: 1000 + id.length,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

function nodeShapeType(node: ParsedMermaidNode) {
  return node.shape === "decision" ? "diamond" : "rectangle";
}

function textElement(
  id: string,
  text: string,
  x: number,
  y: number,
  width = Math.max(70, text.length * 8),
): Element {
  return {
    ...baseElement(id, "text", x, y),
    width,
    height: 24,
    text,
    fontSize: 20,
    fontFamily: 5,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: null,
    originalText: text,
    lineHeight: 1.25,
  };
}

function calculateLevels(nodes: ParsedMermaidNode[], edges: { from: string; to: string }[]) {
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>();

  for (const edge of edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }

  const levels = new Map<string, number>();
  const queue = nodes
    .filter((node) => (incoming.get(node.id) ?? 0) === 0)
    .map((node) => node.id);

  if (queue.length === 0 && nodes[0]) {
    queue.push(nodes[0].id);
  }

  for (const id of queue) {
    levels.set(id, 0);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const nextLevel = (levels.get(current) ?? 0) + 1;

    for (const next of outgoing.get(current) ?? []) {
      if ((levels.get(next) ?? -1) < nextLevel) {
        levels.set(next, nextLevel);
        queue.push(next);
      }
    }
  }

  for (const node of nodes) {
    if (!levels.has(node.id)) {
      levels.set(node.id, levels.size);
    }
  }

  return levels;
}

function orderNodesByLevel(
  nodes: ParsedMermaidNode[],
  edges: { from: string; to: string }[],
  levels: Map<string, number>,
) {
  const originalIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const incoming = new Map<string, string[]>();
  const levelsByDepth = new Map<number, ParsedMermaidNode[]>();
  const orderedIndex = new Map<string, number>();

  for (const edge of edges) {
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge.from]);
  }

  for (const node of nodes) {
    const level = levels.get(node.id) ?? 0;
    levelsByDepth.set(level, [...(levelsByDepth.get(level) ?? []), node]);
  }

  const orderedLevels = Array.from(levelsByDepth.entries())
    .sort(([left], [right]) => left - right)
    .map(([level, levelNodes]) => {
      const orderedNodes = [...levelNodes].sort((left, right) => {
        if (level === 0) {
          return (originalIndex.get(left.id) ?? 0) - (originalIndex.get(right.id) ?? 0);
        }

        const leftParents = incoming.get(left.id) ?? [];
        const rightParents = incoming.get(right.id) ?? [];
        const leftParentAverage =
          leftParents.reduce(
            (sum, parent) => sum + (orderedIndex.get(parent) ?? originalIndex.get(parent) ?? 0),
            0,
          ) / Math.max(1, leftParents.length);
        const rightParentAverage =
          rightParents.reduce(
            (sum, parent) => sum + (orderedIndex.get(parent) ?? originalIndex.get(parent) ?? 0),
            0,
          ) / Math.max(1, rightParents.length);

        if (leftParentAverage !== rightParentAverage) {
          return leftParentAverage - rightParentAverage;
        }

        return (originalIndex.get(left.id) ?? 0) - (originalIndex.get(right.id) ?? 0);
      });

      orderedNodes.forEach((node, index) => orderedIndex.set(node.id, index));
      return orderedNodes;
    });

  return orderedLevels;
}

export function mermaidToExcalidrawScene(source: string): ExcalidrawScene {
  const parsed = parseMermaidFlowchart(source);
  const levels = calculateLevels(parsed.nodes, parsed.edges);
  const orderedLevels = orderNodesByLevel(parsed.nodes, parsed.edges, levels);
  const maxLevelSize = Math.max(...orderedLevels.map((level) => level.length), 1);
  const positions = new Map<string, { x: number; y: number }>();
  const horizontalSpacing = NODE_WIDTH + GAP;
  const verticalSpacing = NODE_HEIGHT + GAP;

  orderedLevels.forEach((levelNodes, levelIndex) => {
    const horizontalOffset = ((maxLevelSize - levelNodes.length) * horizontalSpacing) / 2;
    const verticalOffset = ((maxLevelSize - levelNodes.length) * verticalSpacing) / 2;

    levelNodes.forEach((node, siblingIndex) => {
      if (parsed.direction === "LR") {
        positions.set(node.id, {
          x: levelIndex * horizontalSpacing,
          y: verticalOffset + siblingIndex * verticalSpacing,
        });
      } else {
        positions.set(node.id, {
          x: horizontalOffset + siblingIndex * horizontalSpacing,
          y: levelIndex * verticalSpacing,
        });
      }
    });
  });

  const elements: Element[] = [];

  parsed.nodes.forEach((node, index) => {
    const position = positions.get(node.id) ?? { x: 0, y: 0 };
    const shapeId = elementId("node", index);
    const textId = elementId("label", index);
    elements.push({
      ...baseElement(shapeId, nodeShapeType(node), position.x, position.y),
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      backgroundColor: node.shape === "database" ? "#e9f3ff" : "#fffdf3",
    });
    elements.push(
      textElement(
        textId,
        node.label,
        position.x + NODE_LABEL_PADDING,
        position.y + NODE_HEIGHT / 2 - 12,
        NODE_WIDTH - NODE_LABEL_PADDING * 2,
      ),
    );
  });

  parsed.edges.forEach((edge, index) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);

    if (!from || !to) {
      return;
    }

    const start = {
      x: from.x + NODE_WIDTH,
      y: from.y + NODE_HEIGHT / 2,
    };
    const end = {
      x: to.x,
      y: to.y + NODE_HEIGHT / 2,
    };

    if (parsed.direction === "TD") {
      start.x = from.x + NODE_WIDTH / 2;
      start.y = from.y + NODE_HEIGHT;
      end.x = to.x + NODE_WIDTH / 2;
      end.y = to.y;
    }

    elements.push({
      ...baseElement(elementId("arrow", index), "arrow", start.x, start.y),
      width: end.x - start.x,
      height: end.y - start.y,
      points: [
        [0, 0],
        [end.x - start.x, end.y - start.y],
      ],
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: "arrow",
      elbowed: false,
    });

    if (edge.label) {
      elements.push(
        textElement(
          elementId("edge-label", index),
          edge.label,
          start.x + (end.x - start.x) / 2 - Math.max(70, edge.label.length * 8) / 2,
          start.y + (end.y - start.y) / 2 - 28,
        ),
      );
    }
  });

  return prepareSceneForStorage({
    type: "excalidraw",
    version: 2,
    source: "banguesesdraw",
    elements,
    appState: {
      viewBackgroundColor: "#ffffff",
    },
    files: {},
  });
}
