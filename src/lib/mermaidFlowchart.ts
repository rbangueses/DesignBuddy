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
const ARROW_PATTERN = /\s*-->(?:\|([^|]+)\|)?\s*/g;
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

function parseEdgeLine(line: string) {
  const arrowMatches = Array.from(line.matchAll(ARROW_PATTERN));

  if (arrowMatches.length === 0) {
    return null;
  }

  const tokens = [line.slice(0, arrowMatches[0].index).trim()];
  const labels: Array<string | undefined> = [];

  arrowMatches.forEach((match, index) => {
    const nextMatch = arrowMatches[index + 1];
    const targetStart = (match.index ?? 0) + match[0].length;
    const targetEnd = nextMatch?.index ?? line.length;
    tokens.push(line.slice(targetStart, targetEnd).trim());
    labels.push(match[1]?.trim());
  });

  if (tokens.some((token) => !token)) {
    throw new Error(UNSUPPORTED_ERROR);
  }

  const nodes = tokens.map(parseNodeToken);
  const edges = labels.map((label, index) => ({
    from: nodes[index].id,
    to: nodes[index + 1].id,
    ...(label ? { label } : {}),
  }));

  return { nodes, edges };
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
    const edgeLine = parseEdgeLine(line);

    if (edgeLine) {
      edgeLine.nodes.forEach(upsertNode);
      edges.push(...edgeLine.edges);
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
