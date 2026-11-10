import { prepareSceneForStorage } from "./excalidrawScene";
import {
  createTwilioComponentElements,
  findTwilioComponentIdByLabel,
  TWILIO_COMPONENTS,
  type TwilioComponentId,
} from "./twilioComponents";
import type { ExcalidrawScene } from "../types/excalidraw";

type Element = Record<string, unknown>;
type Point = { x: number; y: number };

export type CleanArchitectureNodeRole =
  | "external"
  | "channel"
  | "integration"
  | "agent"
  | "support"
  | "context"
  | "service";
export type CleanArchitectureEdgeRole =
  | "primary"
  | "return"
  | "association"
  | "dependency";

export type CleanArchitectureSpec = {
  nodes: Array<{
    id: string;
    label: string;
    role: CleanArchitectureNodeRole;
    componentId?: TwilioComponentId;
    subtitle?: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    label?: string;
    role: CleanArchitectureEdgeRole;
  }>;
};

type NodeBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  role: CleanArchitectureNodeRole;
  componentId?: TwilioComponentId;
};

const NODE_WIDTH = 240;
const NODE_HEIGHT = 76;
const EXTERNAL_NODE_WIDTH = 140;
const EXTERNAL_NODE_HEIGHT = 76;
const LABEL_PADDING = 16;

function elementId(prefix: string, index: number) {
  return `clean-${prefix}-${index.toString(36).padStart(3, "0")}`;
}

function baseElement(id: string, type: string, x: number, y: number): Element {
  return {
    id,
    type,
    x,
    y,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "#ffffff",
    fillStyle: "hachure",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 3 },
    seed: 20_000 + id.length,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

function textElement(id: string, text: string, x: number, y: number, width: number, fontSize = 20): Element {
  const lineCount = text.split("\n").length;
  return {
    ...baseElement(id, "text", x, y),
    width,
    height: Math.ceil(fontSize * 1.25 * lineCount),
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

function displayNodeLabel(label: string) {
  if (label.length <= 22) return label;
  const slashIndex = label.indexOf(" / ");
  if (slashIndex > 0) return `${label.slice(0, slashIndex)}\n${label.slice(slashIndex + 3)}`;
  const midpoint = Math.floor(label.length / 2);
  const splitAt = label.lastIndexOf(" ", midpoint);
  return splitAt > 0 ? `${label.slice(0, splitAt)}\n${label.slice(splitAt + 1)}` : label;
}

function point(box: NodeBox, side: "left" | "right" | "top" | "bottom"): Point {
  if (side === "left") return { x: box.x, y: box.y + box.height / 2 };
  if (side === "right") return { x: box.x + box.width, y: box.y + box.height / 2 };
  if (side === "top") return { x: box.x + box.width / 2, y: box.y };
  return { x: box.x + box.width / 2, y: box.y + box.height };
}

function longestSegmentMidpoint(points: Point[]) {
  let from = points[0];
  let to = points[points.length - 1];
  let longest = -1;
  for (let index = 1; index < points.length; index += 1) {
    const candidateFrom = points[index - 1];
    const candidateTo = points[index];
    const length = Math.hypot(candidateTo.x - candidateFrom.x, candidateTo.y - candidateFrom.y);
    if (length > longest) {
      from = candidateFrom;
      to = candidateTo;
      longest = length;
    }
  }
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

function normalizeNodeRole(value: unknown): CleanArchitectureNodeRole | null {
  return value === "external" || value === "channel" || value === "integration" ||
    value === "agent" || value === "support" || value === "context" || value === "service"
    ? value
    : null;
}

function normalizeEdgeRole(value: unknown): CleanArchitectureEdgeRole | null {
  return value === "primary" || value === "return" || value === "association" || value === "dependency"
    ? value
    : null;
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() && value.trim().length <= maxLength
    ? value.trim()
    : null;
}

function inferComponentFromLabel(label: string) {
  const exactId = findTwilioComponentIdByLabel(label);
  if (exactId) return { componentId: exactId, subtitle: undefined };
  const normalized = label.trim();
  // Models commonly expand the palette's abbreviated labels. Keep that
  // harmless wording variation from turning a known Twilio component into a
  // generic rectangle, which also prevents the deterministic lane layout.
  const semanticAliases: Array<{ pattern: RegExp; componentId: TwilioComponentId }> = [
    { pattern: /^(?:prog\.?|programmable)\s+messaging(?:\s+api)?$/i, componentId: "messaging" },
    { pattern: /^(?:prog\.?|programmable)\s+voice(?:\s+api)?$/i, componentId: "voice" },
  ];
  const alias = semanticAliases.find(({ pattern }) => pattern.test(normalized));
  if (alias) return { componentId: alias.componentId, subtitle: undefined };
  const component = [...TWILIO_COMPONENTS]
    .sort((a, b) => b.label.length - a.label.length)
    .find(({ label: componentLabel }) => {
      const suffix = normalized.slice(componentLabel.length);
      return normalized.startsWith(componentLabel) && /^(\s*[/–—-]\s*|\s+\()/.test(suffix);
    });
  if (!component) return null;
  const suffix = normalized.slice(component.label.length).replace(/^(\s*[/–—-]\s*|\s*\()/, "").replace(/\)$/, "").trim();
  return { componentId: component.id, subtitle: suffix || undefined };
}

export function parseCleanArchitectureSpec(text: string): CleanArchitectureSpec {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI did not return a valid clean architecture specification.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI did not return a clean architecture specification.");
  }
  const record = parsed as Record<string, unknown>;
  if (!Array.isArray(record.nodes) || !Array.isArray(record.edges)) {
    throw new Error("The clean architecture specification is missing nodes or edges.");
  }
  if (record.nodes.length < 2 || record.nodes.length > 14 || record.edges.length > 18) {
    throw new Error("The clean architecture specification is too large or incomplete.");
  }

  const nodeIds = new Set<string>();
  const nodes = record.nodes.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object") throw new Error(`Invalid architecture node ${index + 1}.`);
    const node = candidate as Record<string, unknown>;
    const id = cleanString(node.id, 40);
    const label = cleanString(node.label, 80);
    const role = normalizeNodeRole(node.role);
    if (!id || !/^[A-Za-z][\w-]*$/.test(id) || !label || !role || nodeIds.has(id)) {
      throw new Error(`Invalid architecture node ${index + 1}.`);
    }
    nodeIds.add(id);
    const requestedComponentId = cleanString(node.componentId, 40);
    const inferredComponent = inferComponentFromLabel(label);
    const componentId = requestedComponentId && findTwilioComponentIdByLabel(label) === requestedComponentId
      ? requestedComponentId as TwilioComponentId
      : inferredComponent?.componentId;
    const subtitle = cleanString(node.subtitle, 60) ?? inferredComponent?.subtitle;
    return { id, label, role, componentId, subtitle };
  });
  const twilioNodeIds = new Set(
    nodes.filter((node) => node.componentId === "twilio").map((node) => node.id),
  );

  const edges = record.edges.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object") throw new Error(`Invalid architecture edge ${index + 1}.`);
    const edge = candidate as Record<string, unknown>;
    const from = cleanString(edge.from, 40);
    const to = cleanString(edge.to, 40);
    const role = normalizeEdgeRole(edge.role);
    const label = cleanString(edge.label, 48) ?? undefined;
    if (!from || !to || !nodeIds.has(from) || !nodeIds.has(to) || from === to || !role) {
      throw new Error(`Invalid architecture edge ${index + 1}.`);
    }
    if (twilioNodeIds.has(from) || twilioNodeIds.has(to)) {
      // The Twilio circle is an ownership badge, not a traffic endpoint. AI
      // models occasionally use it as one despite the generation contract.
      // Recover safely by retaining the visual ownership relationship and
      // allowing the remaining channel flows to render, rather than failing
      // the entire Clean Architecture request.
      return { from, to, label: undefined, role: "association" as const };
    }
    return { from, to, label, role };
  });

  return { nodes, edges };
}

function firstMatchingNode(
  spec: CleanArchitectureSpec,
  predicate: (node: CleanArchitectureSpec["nodes"][number]) => boolean,
) {
  return spec.nodes.find(predicate);
}

function firstEdgeLabel(
  edges: CleanArchitectureSpec["edges"],
  from: string,
  to: string,
  fallback?: string,
) {
  return edges.find((edge) => edge.from === from && edge.to === to)?.label
    ?? fallback;
}

const STANDARD_AGENT_SUPPORTS = ["LLM", "Business logic", "Tools"] as const;

function expandAgentSupportShorthand(spec: CleanArchitectureSpec): CleanArchitectureSpec {
  const agent = firstMatchingNode(spec, (node) => node.role === "agent");
  if (!agent?.subtitle) return spec;

  const subtitle = agent.subtitle.toLowerCase();
  const shorthandLabels = STANDARD_AGENT_SUPPORTS.filter((label) => subtitle.includes(label.toLowerCase()));
  if (shorthandLabels.length === 0) return spec;

  const existingLabels = new Set(spec.nodes.map((node) => node.label.toLowerCase()));
  const inferredNodes = shorthandLabels
    .filter((label) => !existingLabels.has(label.toLowerCase()))
    .map((label) => ({
      id: `agent-support-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label,
      role: "support" as const,
    }));

  return {
    ...spec,
    nodes: [
      ...spec.nodes.map((node) => node.id === agent.id ? { ...node, subtitle: undefined } : node),
      ...inferredNodes,
    ],
  };
}

/**
 * The AI is allowed to describe an architecture, but the common messaging
 * channel pattern has a fixed transport topology. Normalizing it here keeps
 * Clean mode from drawing a misleading response through a webhook or an
 * accidental second return loop. It deliberately activates only when all four
 * participants and a meaningful messaging chain are present.
 */
export function normalizeCleanArchitectureSpec(spec: CleanArchitectureSpec): CleanArchitectureSpec {
  const expandedSpec = expandAgentSupportShorthand(spec);
  const agent = firstMatchingNode(expandedSpec, (node) => node.role === "agent");
  const supportNodes = expandedSpec.nodes.filter((node) => node.role === "support");
  const supportDependencyEdges = agent
    ? expandedSpec.edges.filter((edge) =>
      edge.role === "dependency" &&
      (supportNodes.some((node) => node.id === edge.from) || supportNodes.some((node) => node.id === edge.to)),
    )
    : [];
  const hasMissingSupportDependency = agent && supportNodes.some((node) =>
    !expandedSpec.edges.some((edge) =>
      edge.role === "dependency" && edge.from === agent.id && edge.to === node.id,
    ),
  );

  // Support services are peers owned by the agent, not a processing chain.
  // This also prevents an otherwise reasonable model response from implying
  // that every LLM call must flow through business logic and then tools.
  const withParallelSupportDependencies = agent && supportNodes.length > 0 &&
    (supportDependencyEdges.length > 0 || hasMissingSupportDependency)
    ? {
      ...expandedSpec,
      edges: [
        ...expandedSpec.edges.filter((edge) => !supportDependencyEdges.includes(edge)),
        ...supportNodes.map((node) => ({
          from: agent.id,
          to: node.id,
          label: firstEdgeLabel(expandedSpec.edges, agent.id, node.id),
          role: "dependency" as const,
        })),
      ],
    }
    : expandedSpec;

  const messaging = firstMatchingNode(withParallelSupportDependencies, (node) => node.componentId === "messaging");
  const normalizedAgent = firstMatchingNode(withParallelSupportDependencies, (node) => node.role === "agent");
  if (!messaging || !normalizedAgent) return withParallelSupportDependencies;

  const externalCandidates = withParallelSupportDependencies.nodes.filter((node) =>
    node.role === "external" && withParallelSupportDependencies.edges.some((edge) =>
      (edge.from === node.id && edge.to === messaging.id) ||
      (edge.from === messaging.id && edge.to === node.id),
    ),
  );
  const integrationCandidates = withParallelSupportDependencies.nodes.filter((node) =>
    node.role === "integration" && withParallelSupportDependencies.edges.some((edge) =>
      (edge.from === messaging.id && edge.to === node.id) ||
      (edge.from === node.id && edge.to === messaging.id) ||
      (edge.from === node.id && edge.to === normalizedAgent.id) ||
      (edge.from === normalizedAgent.id && edge.to === node.id),
    ),
  );
  if (externalCandidates.length !== 1 || integrationCandidates.length !== 1) return withParallelSupportDependencies;

  const external = externalCandidates[0];
  const integration = integrationCandidates[0];
  const messageEdges = withParallelSupportDependencies.edges.filter((edge) =>
    edge.from === messaging.id || edge.to === messaging.id,
  );
  if (messageEdges.length < 2) return withParallelSupportDependencies;

  const isNormalizedTransportEdge = (edge: CleanArchitectureSpec["edges"][number]) => {
    const isMessagingEdge = edge.from === messaging.id || edge.to === messaging.id;
    const isIntegrationAgentEdge =
      (edge.from === integration.id && edge.to === normalizedAgent.id) ||
      (edge.from === normalizedAgent.id && edge.to === integration.id);
    return isMessagingEdge || isIntegrationAgentEdge;
  };

  const retainedEdges = withParallelSupportDependencies.edges.filter((edge) => !isNormalizedTransportEdge(edge));
  const canonicalEdges: CleanArchitectureSpec["edges"] = [
    {
      from: external.id,
      to: messaging.id,
      label: firstEdgeLabel(withParallelSupportDependencies.edges, external.id, messaging.id),
      role: "primary",
    },
    {
      from: messaging.id,
      to: integration.id,
      // These are stable transport semantics. Renderer-owned labels prevent
      // otherwise-valid but verbose model prose from colliding with the
      // compact lower lane.
      label: "inbound webhook",
      role: "primary",
    },
    {
      from: integration.id,
      to: normalizedAgent.id,
      label: "invoke agent",
      role: "primary",
    },
    {
      from: normalizedAgent.id,
      to: integration.id,
      label: "agent response",
      role: "return",
    },
    {
      from: integration.id,
      to: messaging.id,
      label: "send message",
      role: "return",
    },
    {
      from: messaging.id,
      to: external.id,
      label: firstEdgeLabel(withParallelSupportDependencies.edges, messaging.id, external.id),
      role: "return",
    },
  ];

  return {
    ...withParallelSupportDependencies,
    nodes: withParallelSupportDependencies.nodes.map((node) =>
      node.id === integration.id
        ? { ...node, label: "Messaging backend", subtitle: undefined }
        : node.id === messaging.id && /^(?:(?:programmable\s+)?messaging\s+api|api)$/i.test(node.subtitle ?? "")
          ? { ...node, subtitle: undefined }
        : node,
    ),
    edges: [...retainedEdges, ...canonicalEdges],
  };
}

function nodePosition(role: CleanArchitectureNodeRole, index: number, componentId?: TwilioComponentId) {
  // Leave a deliberate routing corridor between the external actor and the
  // channel column. This keeps separate inbound/outbound messaging arrows
  // legible without disturbing the Voice path.
  if (componentId === "twilio") return { x: 420, y: 24 };
  if (componentId === "voice") return { x: 360, y: 150 };
  if (componentId === "messaging") return { x: 360, y: 500 };
  if (componentId === "flex") return { x: 360, y: 340 };
  if (role === "external") return { x: 40, y: 190 + index * 130 };
  if (role === "integration") return { x: 680, y: 500 + index * 120 };
  if (role === "agent") return { x: 960, y: 170 + index * 130 };
  if (role === "support") return { x: 1270, y: 140 + index * 110 };
  if (role === "context") return { x: 360, y: 340 + index * 120 };
  return { x: 680, y: 160 + index * 130 };
}

function edgePoints(
  from: NodeBox,
  to: NodeBox,
  role: CleanArchitectureEdgeRole,
  returnIndex: number,
): Point[] {
  if (role === "association") {
    return [point(from, "bottom"), point(to, "top")];
  }
  if (role === "dependency") {
    if (Math.abs(from.x - to.x) < 160) {
      return [point(from, from.y < to.y ? "bottom" : "top"), point(to, from.y < to.y ? "top" : "bottom")];
    }
    return [point(from, "right"), point(to, "left")];
  }
  if (role === "primary") {
    if (from.role === "external" && to.componentId === "messaging") {
      const start = point(from, "right");
      const end = point(to, "left");
      // Keep incoming messaging outside the channel column. The matching
      // response uses a separate, inner rail below.
      const gutterX = to.x - 52;
      return [start, { x: gutterX, y: start.y }, { x: gutterX, y: end.y }, end];
    }
    if (from.componentId === "messaging" && to.role === "integration") {
      // The outbound webhook hand-off is the first short link in the lower
      // messaging lane. Keep it horizontal rather than sharing the larger
      // voice/agent routing area.
      return [point(from, "right"), point(to, "left")];
    }
    if (from.role === "integration" && to.role === "agent") {
      // The matching response leaves the agent's bottom edge. Starting this
      // request at the backend's top edge keeps the two diagonals apart.
      return [point(from, "top"), point(to, "left")];
    }
    if (Math.abs(from.x - to.x) < 150) {
      return [point(from, from.y < to.y ? "bottom" : "top"), point(to, from.y < to.y ? "top" : "bottom")];
    }
    return [point(from, from.x < to.x ? "right" : "left"), point(to, from.x < to.x ? "left" : "right")];
  }

  // Response paths share dedicated gutters, keeping them away from primary lanes.
  if (from.role === "agent" && to.componentId === "voice") {
    const start = point(from, "bottom");
    const end = point(to, "right");
    const railY = to.y + to.height + 42 + returnIndex * 26;
    return [start, { x: start.x, y: railY }, { x: end.x + 34, y: railY }, end];
  }
  if (from.role === "agent" && to.componentId === "messaging") {
    const start = point(from, "left");
    const end = point(to, "right");
    // The backend-to-agent request and agent-to-messaging response meet at
    // the agent's left edge and naturally fan out. A direct diagonal is much
    // clearer than sending the response around the bottom of the diagram.
    return [start, end];
  }
  if (from.role === "agent" && to.role === "integration") {
    // Return traffic from the agent belongs to the lower messaging lane, not
    // a large U-turn beneath the entire diagram.
    return [point(from, "bottom"), point(to, "right")];
  }
  if (from.role === "integration" && to.componentId === "messaging") {
    // Use the lower edge of both adjacent boxes for the return direction so
    // it reads as a second, compact transport arrow beside the webhook hop.
    return [point(from, "bottom"), point(to, "bottom")];
  }
  if (from.componentId === "messaging" && to.role === "external") {
    const start = point(from, "left");
    const end = point(to, "right");
    const gutterX = from.x - 10;
    return [start, { x: gutterX, y: start.y }, { x: gutterX, y: end.y }, end];
  }
  if (to.x < 280 && from.x >= 280) {
    const gutterX = Math.max(to.x + to.width + 14, 274);
    const start = point(from, "left");
    const end = point(to, "right");
    return [start, { x: gutterX, y: start.y }, { x: gutterX, y: end.y }, end];
  }
  if (from.x >= 900 && to.x < 600) {
    const routeY = to.y + to.height + 44 + returnIndex * 34;
    const start = point(from, "left");
    const end = point(to, "right");
    return [start, { x: start.x - 40, y: routeY }, { x: end.x + 34, y: routeY }, end];
  }
  const routeY = Math.max(from.y + from.height, to.y + to.height) + 58 + returnIndex * 36;
  const start = point(from, "bottom");
  const end = point(to, "bottom");
  return [start, { x: start.x, y: routeY }, { x: end.x, y: routeY }, end];
}

function shouldRenderEdgeLabel(edge: CleanArchitectureSpec["edges"][number], from: NodeBox, to: NodeBox) {
  if (!edge.label) return false;
  // The messaging channel and its backend typically have only a small gap.
  // A long transport label there lands on one of the boxes, so the labelled
  // nodes themselves communicate the flow more clearly.
  if (
    (from.role === "external" && to.componentId === "messaging") ||
    (from.componentId === "messaging" && to.role === "external")
  ) return false;
  return true;
}

function edgeLabelAnchor(
  edge: CleanArchitectureSpec["edges"][number],
  from: NodeBox,
  to: NodeBox,
  points: Point[],
) {
  const anchor = longestSegmentMidpoint(points);
  // Put the two labels for the short Messaging <-> Backend exchange on
  // opposite sides of the lane, never over either endpoint box.
  if (from.componentId === "messaging" && to.role === "integration") {
    return { x: anchor.x, y: anchor.y - 42 };
  }
  if (from.role === "integration" && to.componentId === "messaging") {
    return { x: anchor.x, y: anchor.y + 34 };
  }
  return anchor;
}

export function cleanArchitectureSpecToExcalidrawScene(spec: CleanArchitectureSpec): ExcalidrawScene {
  const elements: Element[] = [];
  const boxes = new Map<string, NodeBox>();
  const nodes = new Map(spec.nodes.map((node) => [node.id, node]));
  const roleIndices = new Map<CleanArchitectureNodeRole, number>();

  spec.nodes.forEach((node, index) => {
    const roleIndex = roleIndices.get(node.role) ?? 0;
    roleIndices.set(node.role, roleIndex + 1);
    const position = nodePosition(node.role, roleIndex, node.componentId);
    if (node.componentId) {
      const componentElements = createTwilioComponentElements(node.componentId, position);
      const shape = componentElements[0] as Record<string, unknown>;
      elements.push(...componentElements);
      boxes.set(node.id, {
        id: String(shape.id), x: Number(shape.x), y: Number(shape.y), width: Number(shape.width), height: Number(shape.height), role: node.role, componentId: node.componentId,
      });
      if (node.subtitle) {
        elements.push(textElement(elementId("subtitle", index), node.subtitle, position.x, position.y + Number(shape.height) + 8, Number(shape.width), 16));
      }
      return;
    }

    const shapeId = elementId("node", index);
    const labelId = elementId("label", index);
    const isExternal = node.role === "external";
    const width = isExternal ? EXTERNAL_NODE_WIDTH : NODE_WIDTH;
    const height = isExternal ? EXTERNAL_NODE_HEIGHT : NODE_HEIGHT;
    const visibleLabel = displayNodeLabel(node.label);
    const labelFontSize = node.label.length > 22 ? 17 : 20;
    const labelHeight = Math.ceil(labelFontSize * 1.25 * visibleLabel.split("\n").length);
    elements.push({
      ...baseElement(shapeId, isExternal ? "ellipse" : "rectangle", position.x, position.y),
      width,
      height,
      boundElements: [{ id: labelId, type: "text" }],
    });
    elements.push({
      ...textElement(
        labelId,
        visibleLabel,
        position.x + LABEL_PADDING,
        position.y + (height - labelHeight) / 2,
        width - LABEL_PADDING * 2,
        labelFontSize,
      ),
      containerId: shapeId,
      fontSize: labelFontSize,
      height: labelHeight,
    });
    boxes.set(node.id, { id: shapeId, x: position.x, y: position.y, width, height, role: node.role, componentId: node.componentId });
    if (node.subtitle) {
      elements.push(textElement(elementId("subtitle", index), node.subtitle, position.x + LABEL_PADDING, position.y + height + 8, width - LABEL_PADDING * 2, 16));
    }
  });

  // A single short dashed association is enough to establish the Twilio
  // grouping. Rendering every association from a shared Twilio node creates
  // a distracting line through the channel column.
  const visibleTwilioAssociation = new Map<string, number>();
  spec.edges.forEach((edge, index) => {
    if (edge.role !== "association" || nodes.get(edge.from)?.componentId !== "twilio") return;
    const from = boxes.get(edge.from);
    const to = boxes.get(edge.to);
    if (!from || !to) return;
    const existingIndex = visibleTwilioAssociation.get(edge.from);
    const existing = existingIndex === undefined ? null : spec.edges[existingIndex];
    const existingBox = existing ? boxes.get(existing.to) : null;
    const distance = Math.abs((from.y + from.height / 2) - (to.y + to.height / 2));
    const existingDistance = existingBox
      ? Math.abs((from.y + from.height / 2) - (existingBox.y + existingBox.height / 2))
      : Number.POSITIVE_INFINITY;
    if (distance < existingDistance) visibleTwilioAssociation.set(edge.from, index);
  });

  let returnIndex = 0;
  const pairedMessagingReturns = new Map<number, number>();
  spec.edges.forEach((edge, index) => {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (edge.role !== "primary" || from?.role !== "external" || to?.componentId !== "messaging") return;
    const returnIndexForPair = spec.edges.findIndex((candidate) =>
      candidate.role === "return" && candidate.from === edge.to && candidate.to === edge.from,
    );
    if (returnIndexForPair >= 0) pairedMessagingReturns.set(index, returnIndexForPair);
  });

  spec.edges.forEach((edge, index) => {
    const from = boxes.get(edge.from);
    const to = boxes.get(edge.to);
    if (!from || !to) return;
    if (
      edge.role === "association" &&
      nodes.get(edge.from)?.componentId === "twilio" &&
      visibleTwilioAssociation.get(edge.from) !== index
    ) return;
    if ([...pairedMessagingReturns.values()].includes(index)) return;
    const isTwoWayMessaging = pairedMessagingReturns.has(index);
    const points = isTwoWayMessaging
      ? [point(from, "right"), point(to, "left")]
      : edgePoints(from, to, edge.role, edge.role === "return" ? returnIndex++ : 0);
    const displayedLabel = isTwoWayMessaging ? "messages" : edge.label;
    const minX = Math.min(...points.map((candidate) => candidate.x));
    const minY = Math.min(...points.map((candidate) => candidate.y));
    const maxX = Math.max(...points.map((candidate) => candidate.x));
    const maxY = Math.max(...points.map((candidate) => candidate.y));
    elements.push({
      ...baseElement(elementId("edge", index), edge.role === "association" ? "line" : "arrow", minX, minY),
      width: maxX - minX,
      height: maxY - minY,
      points: points.map((candidate) => [candidate.x - minX, candidate.y - minY]),
      strokeStyle: edge.role === "association" ? "dashed" : "solid",
      startBinding: edge.role === "association" ? null : { elementId: from.id, focus: 0, gap: 1 },
      endBinding: edge.role === "association" ? null : { elementId: to.id, focus: 0, gap: 1 },
      startArrowhead: isTwoWayMessaging ? "arrow" : null,
      endArrowhead: edge.role === "association" ? null : "arrow",
      elbowed: false,
    });
    if (displayedLabel && (isTwoWayMessaging || shouldRenderEdgeLabel(edge, from, to))) {
      const anchor = edgeLabelAnchor(edge, from, to, points);
      const width = Math.max(90, Math.ceil(displayedLabel.length * 8.5) + 16);
      elements.push({
        ...baseElement(elementId("edge-label-bg", index), "rectangle", anchor.x - width / 2, anchor.y - 28),
        width,
        height: 24,
        backgroundColor: "#ffffff",
        fillStyle: "solid",
        strokeColor: "transparent",
        strokeWidth: 0,
        roughness: 0,
      });
      elements.push(textElement(elementId("edge-label", index), displayedLabel, anchor.x - width / 2 + 8, anchor.y - 26, width - 16, 16));
    }
  });

  // Connectors must sit underneath nodes. Otherwise a horizontal arrow can
  // obscure the first or last letters of a box label (as with a webhook node).
  const edgeLines = elements.filter((element) => /^clean-edge-\d+$/.test(String(element.id)));
  const edgeLabels = elements.filter((element) => String(element.id).startsWith("clean-edge-label"));
  const nodeElements = elements.filter((element) =>
    !edgeLines.includes(element) && !edgeLabels.includes(element),
  );

  return prepareSceneForStorage({
    type: "excalidraw",
    version: 2,
    source: "banguesesdraw",
    elements: [...edgeLines, ...nodeElements, ...edgeLabels],
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
  });
}
