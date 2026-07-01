export type MermaidDirection = "LR" | "TD";
export type MermaidNodeShape = "rectangle" | "rounded" | "decision" | "database";

export type ParsedMermaidNode = {
  id: string;
  label: string;
  shape: MermaidNodeShape;
};

export type ParsedMermaidEdge = {
  from: string;
  to: string;
  label?: string;
};

export type ParsedMermaidFlowchart = {
  direction: MermaidDirection;
  nodes: ParsedMermaidNode[];
  edges: ParsedMermaidEdge[];
};

const UNSUPPORTED_ERROR =
  "Only simple flowchart nodes and arrows are supported for conversion.";

const HEADER_PATTERN = /^flowchart\s+(LR|TD)\s*$/;
const EDGE_PATTERN = /^(.+?)\s*-->(?:\|([^|]+)\|)?\s*(.+)$/;
const BARE_ID_PATTERN = /^[A-Za-z][\w-]*$/;
const NODE_PATTERNS = [
  { shape: "database", pattern: /^([A-Za-z][\w-]*)\[\((.+)\)\]$/ },
  { shape: "decision", pattern: /^([A-Za-z][\w-]*)\{(.+)\}$/ },
  { shape: "rectangle", pattern: /^([A-Za-z][\w-]*)\[(.+)\]$/ },
  { shape: "rounded", pattern: /^([A-Za-z][\w-]*)\((.+)\)$/ },
] as const;

function parseNodeToken(token: string): ParsedMermaidNode {
  const trimmed = token.trim();

  for (const { shape, pattern } of NODE_PATTERNS) {
    const match = pattern.exec(trimmed);

    if (match) {
      return {
        id: match[1],
        label: match[2].trim(),
        shape,
      };
    }
  }

  if (BARE_ID_PATTERN.test(trimmed)) {
    return {
      id: trimmed,
      label: trimmed,
      shape: "rectangle",
    };
  }

  throw new Error(UNSUPPORTED_ERROR);
}

export function parseMermaidFlowchart(source: string): ParsedMermaidFlowchart {
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const header = lines.shift();
  const headerMatch = header ? HEADER_PATTERN.exec(header) : null;

  if (!headerMatch) {
    throw new Error(UNSUPPORTED_ERROR);
  }

  const nodes = new Map<string, ParsedMermaidNode>();
  const edges: ParsedMermaidEdge[] = [];

  function upsertNode(node: ParsedMermaidNode) {
    const existing = nodes.get(node.id);

    if (!existing || existing.label === existing.id) {
      nodes.set(node.id, node);
    }
  }

  for (const line of lines) {
    const edgeMatch = EDGE_PATTERN.exec(line);

    if (edgeMatch) {
      const fromNode = parseNodeToken(edgeMatch[1]);
      const toNode = parseNodeToken(edgeMatch[3]);
      upsertNode(fromNode);
      upsertNode(toNode);
      edges.push({
        from: fromNode.id,
        to: toNode.id,
        ...(edgeMatch[2]?.trim() ? { label: edgeMatch[2].trim() } : {}),
      });
      continue;
    }

    const node = parseNodeToken(line);
    upsertNode(node);
  }

  return {
    direction: headerMatch[1] as MermaidDirection,
    nodes: Array.from(nodes.values()),
    edges,
  };
}
