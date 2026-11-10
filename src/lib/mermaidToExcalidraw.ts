import { layout as dagreLayout } from "dagre-d3-es/src/dagre/index.js";
import { Graph } from "dagre-d3-es/src/graphlib/index.js";
import { prepareSceneForStorage } from "./excalidrawScene";
import { parseMermaidFlowchart, type ParsedMermaidNode } from "./mermaidFlowchart";
import {
  applyTwilioComponentTemplates,
  findTwilioComponentIdByLabel,
} from "./twilioComponents";
import type { ExcalidrawScene } from "../types/excalidraw";

type Element = Record<string, unknown>;

type LayoutNode = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LayoutEdge = {
  points?: Array<{ x: number; y: number }>;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  labeloffset?: number;
  labelpos?: string;
};

type PositionedNode = LayoutNode & { x: number; y: number };
type Point = { x: number; y: number };

const MIN_NODE_WIDTH = 220;
const MAX_NODE_WIDTH = 360;
const NODE_HEIGHT = 76;
const NODE_LABEL_PADDING = 16;
const EDGE_LABEL_FONT_SIZE = 16;
const EDGE_LABEL_HEIGHT = 24;
const EDGE_LABEL_PADDING = 8;
const GRAPH_MARGIN = 40;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function estimatedTextWidth(text: string, fontSize: number) {
  const longestLineLength = text
    .split("\n")
    .reduce((longest, line) => Math.max(longest, line.length), 0);

  return Math.max(70, Math.ceil(longestLineLength * fontSize * 0.65));
}

function nodeSize(node: ParsedMermaidNode) {
  return {
    x: 0,
    y: 0,
    width: clamp(
      estimatedTextWidth(node.label, 20) + NODE_LABEL_PADDING * 2,
      MIN_NODE_WIDTH,
      MAX_NODE_WIDTH,
    ),
    height: NODE_HEIGHT,
  };
}

function edgeLabelSize(label: string | undefined) {
  if (!label) {
    return { width: 0, height: 0 };
  }

  return {
    width: estimatedTextWidth(label, EDGE_LABEL_FONT_SIZE) + EDGE_LABEL_PADDING * 2,
    height: EDGE_LABEL_HEIGHT,
  };
}

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
  fontSize = 20,
): Element {
  return {
    ...baseElement(id, "text", x, y),
    width,
    height: Math.ceil(fontSize * 1.25),
    text,
    fontSize,
    fontFamily: 5,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: null,
    originalText: text,
    lineHeight: 1.25,
  };
}

function createLayout(
  direction: "LR" | "TD",
  nodes: ParsedMermaidNode[],
  edges: { from: string; to: string; label?: string }[],
) {
  const graph = new Graph<Record<string, unknown>, LayoutNode, LayoutEdge>({
    directed: true,
    multigraph: true,
  });
  graph.setGraph({
    rankdir: direction,
    nodesep: direction === "LR" ? 80 : 100,
    ranksep: direction === "LR" ? 170 : 120,
    edgesep: 70,
    marginx: GRAPH_MARGIN,
    marginy: GRAPH_MARGIN,
    acyclicer: "greedy",
    ranker: "network-simplex",
  });
  graph.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    graph.setNode(node.id, nodeSize(node));
  });

  edges.forEach((edge, index) => {
    const labelSize = edgeLabelSize(edge.label);
    graph.setEdge(
      edge.from,
      edge.to,
      {
        width: labelSize.width,
        height: labelSize.height,
        labeloffset: 24,
        labelpos: "c",
      },
      `edge-${index}`,
    );
  });

  dagreLayout(graph, {});

  return graph;
}

function pointFromLayoutNode(node: LayoutNode, side: "left" | "right" | "top" | "bottom") {
  if (side === "left") {
    return { x: node.x - node.width / 2, y: node.y };
  }

  if (side === "right") {
    return { x: node.x + node.width / 2, y: node.y };
  }

  if (side === "top") {
    return { x: node.x, y: node.y - node.height / 2 };
  }

  return { x: node.x, y: node.y + node.height / 2 };
}

function edgeEndpoints(
  direction: "LR" | "TD",
  from: LayoutNode,
  to: LayoutNode,
  layoutEdge: LayoutEdge | undefined,
) {
  const points = layoutEdge?.points;

  if (points && points.length >= 2) {
    return {
      start: points[0],
      end: points[points.length - 1],
    };
  }

  if (direction === "LR") {
    return {
      start: pointFromLayoutNode(from, from.x <= to.x ? "right" : "left"),
      end: pointFromLayoutNode(to, from.x <= to.x ? "left" : "right"),
    };
  }

  return {
    start: pointFromLayoutNode(from, from.y <= to.y ? "bottom" : "top"),
    end: pointFromLayoutNode(to, from.y <= to.y ? "top" : "bottom"),
  };
}

function normalizedLabel(label: string) {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

function componentMatch(label: string) {
  const exactId = findTwilioComponentIdByLabel(label);
  if (exactId) return { id: exactId, subtitle: null };

  // The graph model commonly preserves a product subtitle in this form. Keep
  // the real library component and place the qualifier immediately beneath it.
  const flexSubtitle = /^flex\s*[-–:]\s*(.+)$/i.exec(label.trim())?.[1]?.trim();
  return flexSubtitle ? { id: "flex" as const, subtitle: flexSubtitle } : null;
}

function isArchitectureLaneDiagram(nodes: ParsedMermaidNode[]) {
  const labels = nodes.map((node) => normalizedLabel(node.label));
  return labels.some((label) => label.includes("agent")) &&
    labels.some((label) => label === "prog. voice" || label === "prog. messaging");
}

/**
 * A deliberately small set of lanes for conversational architecture diagrams.
 * This avoids allowing cycles and supporting dependencies to decide the position
 * of the primary user-to-channel-to-agent path.
 */
function createArchitectureLanePositions(nodes: ParsedMermaidNode[]) {
  const supportRows = new Map<string, number>();
  let supportIndex = 0;
  let fallbackIndex = 0;

  return new Map(
    nodes.map((node) => {
      const size = nodeSize(node);
      const label = normalizedLabel(node.label);
      const componentId = componentMatch(node.label)?.id;
      let x = 620;
      let y = 120 + fallbackIndex * 120;

      if (/^(user|customer|caller|client|end user)$/.test(label)) {
        x = 40;
        y = 190;
      } else if (componentId === "twilio") {
        x = 360;
        y = 25;
      } else if (componentId === "voice") {
        x = 300;
        y = 150;
      } else if (componentId === "messaging") {
        x = 300;
        y = 500;
      } else if (componentId === "flex") {
        x = 300;
        y = 340;
      } else if (/webhook|backend|integration|relay service/.test(label)) {
        x = 620;
        y = 500;
      } else if (/agent/.test(label)) {
        x = 960;
        y = 170;
      } else if (/^(llm|business logic|tools|knowledge|memory)$/.test(label)) {
        const row = supportRows.get(node.id) ?? supportIndex++;
        supportRows.set(node.id, row);
        x = 1270;
        y = 140 + row * 120;
      } else {
        fallbackIndex += 1;
      }

      return [node.id, { ...size, x, y }] as const;
    }),
  );
}

function edgePoint(position: PositionedNode, side: "left" | "right" | "top" | "bottom"): Point {
  if (side === "left") return { x: position.x, y: position.y + position.height / 2 };
  if (side === "right") return { x: position.x + position.width, y: position.y + position.height / 2 };
  if (side === "top") return { x: position.x + position.width / 2, y: position.y };
  return { x: position.x + position.width / 2, y: position.y + position.height };
}

function architectureEdgePoints(from: PositionedNode, to: PositionedNode, returnIndex: number): Point[] {
  const fromCenterX = from.x + from.width / 2;
  const toCenterX = to.x + to.width / 2;
  const isForward = fromCenterX <= toCenterX;

  if (Math.abs(fromCenterX - toCenterX) < 100) {
    return [
      edgePoint(from, from.y <= to.y ? "bottom" : "top"),
      edgePoint(to, from.y <= to.y ? "top" : "bottom"),
    ];
  }

  if (isForward) {
    return [edgePoint(from, "right"), edgePoint(to, "left")];
  }

  const routeY = Math.max(from.y + from.height, to.y + to.height) + 62 + returnIndex * 42;
  const start = edgePoint(from, "bottom");
  const end = edgePoint(to, "bottom");
  return [start, { x: start.x, y: routeY }, { x: end.x, y: routeY }, end];
}

function longestSegmentMidpoint(points: Point[]) {
  let longest = { from: points[0], to: points[points.length - 1], length: -1 };
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length > longest.length) longest = { from, to, length };
  }
  return {
    x: (longest.from.x + longest.to.x) / 2,
    y: (longest.from.y + longest.to.y) / 2,
  };
}

function renderMermaidScene(source: string, useComponentLibrary: boolean): ExcalidrawScene {
  const parsed = parseMermaidFlowchart(source);
  const useArchitectureLanes = useComponentLibrary && isArchitectureLaneDiagram(parsed.nodes);
  const graph = useArchitectureLanes
    ? null
    : createLayout(parsed.direction, parsed.nodes, parsed.edges);
  const positions: Map<string, PositionedNode> = useArchitectureLanes
    ? createArchitectureLanePositions(parsed.nodes)
    : new Map(
        parsed.nodes.map((node) => {
          const layoutNode = graph?.node(node.id) ?? { ...nodeSize(node), x: 0, y: 0 };
          return [
            node.id,
            {
              ...layoutNode,
              x: layoutNode.x - layoutNode.width / 2,
              y: layoutNode.y - layoutNode.height / 2,
            },
          ] as const;
        }),
      );

  const elements: Element[] = [];

  parsed.nodes.forEach((node, index) => {
    const position = positions.get(node.id) ?? { ...nodeSize(node), x: 0, y: 0 };
    const shapeId = elementId("node", index);
    const textId = elementId("label", index);
    const component = useComponentLibrary ? componentMatch(node.label) : null;
    elements.push({
      ...baseElement(shapeId, nodeShapeType(node), position.x, position.y),
      width: position.width,
      height: position.height,
      backgroundColor: node.shape === "database" ? "#e9f3ff" : "#fffdf3",
      ...(component
        ? {
            customData: { designbuddyComponentId: component.id },
            boundElements: [{ id: textId, type: "text" }],
          }
        : {}),
    });
    elements.push(
      textElement(
        textId,
        node.label,
        position.x + NODE_LABEL_PADDING,
        position.y + position.height / 2 - 12,
        position.width - NODE_LABEL_PADDING * 2,
      ),
    );
    if (component?.subtitle) {
      elements.push(
        textElement(
          elementId("subtitle", index),
          component.subtitle,
          position.x + NODE_LABEL_PADDING,
          position.y + position.height + 8,
          position.width - NODE_LABEL_PADDING * 2,
          16,
        ),
      );
    }
  });

  let returnEdgeIndex = 0;
  parsed.edges.forEach((edge, index) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);

    if (!from || !to) {
      return;
    }

    const layoutEdge = graph?.edge(edge.from, edge.to, `edge-${index}`);
    const fromCenter = { ...from, x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const toCenter = { ...to, x: to.x + to.width / 2, y: to.y + to.height / 2 };
    const isReturn = fromCenter.x > toCenter.x;
    const edgePoints = useArchitectureLanes
      ? architectureEdgePoints(from, to, isReturn ? returnEdgeIndex++ : 0)
      : (() => {
          const { start, end } = edgeEndpoints(parsed.direction, fromCenter, toCenter, layoutEdge);
          return [start, end];
        })();

    const bounds = {
      x: Math.min(...edgePoints.map((point) => point.x)),
      y: Math.min(...edgePoints.map((point) => point.y)),
      width: Math.max(...edgePoints.map((point) => point.x)) - Math.min(...edgePoints.map((point) => point.x)),
      height: Math.max(...edgePoints.map((point) => point.y)) - Math.min(...edgePoints.map((point) => point.y)),
    };

    elements.push({
      ...baseElement(elementId("arrow", index), "arrow", bounds.x, bounds.y),
      width: bounds.width,
      height: bounds.height,
      points: edgePoints.map((point) => [point.x - bounds.x, point.y - bounds.y]),
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: "arrow",
      elbowed: false,
    });

    if (edge.label) {
      const labelSize = edgeLabelSize(edge.label);
      const labelAnchor = useArchitectureLanes ? longestSegmentMidpoint(edgePoints) : null;
      const labelX =
        typeof layoutEdge?.x === "number"
          ? layoutEdge.x - labelSize.width / 2
          : (labelAnchor?.x ?? (edgePoints[0].x + edgePoints[edgePoints.length - 1].x) / 2) - labelSize.width / 2;
      const labelY =
        typeof layoutEdge?.y === "number"
          ? layoutEdge.y - labelSize.height / 2
          : (labelAnchor?.y ?? (edgePoints[0].y + edgePoints[edgePoints.length - 1].y) / 2) - labelSize.height - 8;

      elements.push({
        ...baseElement(elementId("edge-label-bg", index), "rectangle", labelX, labelY),
        width: labelSize.width,
        height: labelSize.height,
        backgroundColor: "#ffffff",
        fillStyle: "solid",
        strokeColor: "transparent",
        strokeWidth: 0,
        roughness: 0,
      });
      elements.push(
        textElement(
          elementId("edge-label", index),
          edge.label,
          labelX + EDGE_LABEL_PADDING,
          labelY + 2,
          labelSize.width - EDGE_LABEL_PADDING * 2,
          EDGE_LABEL_FONT_SIZE,
        ),
      );
    }
  });

  return prepareSceneForStorage({
    type: "excalidraw",
    version: 2,
    source: "banguesesdraw",
    elements: useComponentLibrary
      ? applyTwilioComponentTemplates(elements)
      : elements,
    appState: {
      viewBackgroundColor: "#ffffff",
    },
    files: {},
  });
}

export function mermaidToExcalidrawScene(source: string): ExcalidrawScene {
  return renderMermaidScene(source, false);
}

/**
 * Uses Mermaid purely as a compact graph description, then renders a stable,
 * editable Excalidraw architecture with DesignBuddy components where labels
 * exactly match the component library.
 */
export function mermaidToCleanArchitectureScene(source: string): ExcalidrawScene {
  return renderMermaidScene(source, true);
}
