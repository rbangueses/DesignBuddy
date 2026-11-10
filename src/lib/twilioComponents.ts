export type TwilioComponentId =
  | "twilio"
  | "orchestrator"
  | "messaging"
  | "voice"
  | "sms"
  | "whatsapp"
  | "email-api"
  | "recording"
  | "verify"
  | "lookup"
  | "conversation-relay"
  | "agent-connect"
  | "conversation-intelligence"
  | "memory"
  | "functions"
  | "assets"
  | "studio"
  | "taskrouter"
  | "flex"
  | "third-party-api"
  | "segment-cdp"
  | "segment-connections"
  | "segment-profiles"
  | "segment-engage"
  | "knowledge"
  | "event-streams"
  | "sync"
  | "interconnect"
  | "proxy";

type TwilioComponent = {
  id: TwilioComponentId;
  label: string;
  tone?: "twilio" | "external";
  shape?: "rectangle" | "ellipse";
};

type TwilioComponentGroup = {
  title: string;
  componentIds: TwilioComponentId[];
};

type Element = Record<string, unknown> & {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  groupIds: string[];
};

type Position = {
  x: number;
  y: number;
};

export const TWILIO_COMPONENT_WIDTH = 230;
export const TWILIO_COMPONENT_HEIGHT = 86;
export const TWILIO_COMPONENT_FONT_OPTIONS = [
  { value: 5, label: "Excalifont" },
  { value: 8, label: "Comic Shanns" },
  { value: 7, label: "Lilita One" },
  { value: 6, label: "Nunito" },
  { value: 1, label: "Virgil (classic)" },
  { value: 2, label: "Sans serif" },
  { value: 3, label: "Monospace" },
] as const;
export type TwilioComponentFontFamily =
  (typeof TWILIO_COMPONENT_FONT_OPTIONS)[number]["value"];
export const DEFAULT_TWILIO_COMPONENT_FONT_FAMILY: TwilioComponentFontFamily = 5;
const TWILIO_CORE_DIAMETER = 128;
const LABEL_PADDING = 16;
export const TWILIO_RED = "#F22F46";
const TWILIO_EXTERNAL_YELLOW_STROKE = "#B7791F";
const TWILIO_LABEL_FONT_SIZE = 16;

let idCounter = 0;

export const TWILIO_COMPONENTS: TwilioComponent[] = [
  {
    id: "twilio",
    label: "Twilio",
    shape: "ellipse",
  },
  {
    id: "orchestrator",
    label: "Twilio Orchestrator",
  },
  {
    id: "messaging",
    label: "Prog. Messaging",
  },
  {
    id: "voice",
    label: "Prog. Voice",
  },
  {
    id: "sms",
    label: "SMS",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
  },
  {
    id: "email-api",
    label: "Email API",
  },
  {
    id: "recording",
    label: "Recording",
  },
  {
    id: "verify",
    label: "Verify",
  },
  {
    id: "lookup",
    label: "Lookup",
  },
  {
    id: "conversation-relay",
    label: "Conversation Relay",
  },
  {
    id: "agent-connect",
    label: "Twilio Agent Connect",
  },
  {
    id: "conversation-intelligence",
    label: "Conversation Intelligence",
  },
  {
    id: "memory",
    label: "Memory",
  },
  {
    id: "functions",
    label: "Functions",
  },
  {
    id: "assets",
    label: "Assets",
  },
  {
    id: "studio",
    label: "Studio",
  },
  {
    id: "taskrouter",
    label: "TaskRouter",
  },
  {
    id: "flex",
    label: "Flex",
  },
  {
    id: "third-party-api",
    label: "3rd Party API",
    tone: "external",
  },
  {
    id: "segment-cdp",
    label: "Segment CDP",
  },
  {
    id: "segment-connections",
    label: "Connections",
  },
  {
    id: "segment-profiles",
    label: "Profiles",
  },
  {
    id: "segment-engage",
    label: "Engage",
  },
  {
    id: "knowledge",
    label: "Knowledge",
  },
  {
    id: "event-streams",
    label: "Event Streams",
  },
  {
    id: "sync",
    label: "Sync",
  },
  {
    id: "interconnect",
    label: "Interconnect",
  },
  {
    id: "proxy",
    label: "Proxy",
  },
];

export const TWILIO_COMPONENT_GROUPS: TwilioComponentGroup[] = [
  {
    title: "Communications",
    componentIds: [
      "twilio",
      "messaging",
      "voice",
      "sms",
      "whatsapp",
      "email-api",
      "recording",
      "flex",
    ],
  },
  {
    title: "Trust & Identity",
    componentIds: ["verify", "lookup"],
  },
  {
    title: "Conversations Suite",
    componentIds: [
      "orchestrator",
      "conversation-relay",
      "agent-connect",
      "conversation-intelligence",
      "memory",
    ],
  },
  {
    title: "Builder Tools",
    componentIds: [
      "functions",
      "assets",
      "studio",
      "taskrouter",
      "sync",
      "interconnect",
      "proxy",
      "third-party-api",
    ],
  },
  {
    title: "Data",
    componentIds: [
      "segment-cdp",
      "segment-connections",
      "segment-profiles",
      "segment-engage",
      "knowledge",
      "event-streams",
    ],
  },
];

export function getTwilioComponent(componentId: TwilioComponentId) {
  const component = TWILIO_COMPONENTS.find(({ id }) => id === componentId);

  if (!component) {
    throw new Error(`Unknown Twilio component: ${componentId}`);
  }

  return component;
}

/**
 * Finds a library component from the label used in a compact flowchart.
 * This deliberately accepts only the library's own names: generic labels
 * such as "Backend" or "Agent infrastructure" must remain ordinary nodes.
 */
export function findTwilioComponentIdByLabel(label: string): TwilioComponentId | null {
  const normalized = label.trim().replace(/\s+/g, " ").toLowerCase();
  const component = TWILIO_COMPONENTS.find(
    ({ label: componentLabel }) =>
      componentLabel.trim().replace(/\s+/g, " ").toLowerCase() === normalized,
  );

  return component?.id ?? null;
}

export function getTwilioComponentColors(component: TwilioComponent) {
  if (component.tone === "external") {
    return {
      background: "transparent",
      stroke: TWILIO_EXTERNAL_YELLOW_STROKE,
      label: TWILIO_EXTERNAL_YELLOW_STROKE,
    };
  }

  return {
    background: "transparent",
    stroke: TWILIO_RED,
    label: TWILIO_RED,
  };
}

function nextId(componentId: TwilioComponentId, part: string) {
  idCounter += 1;
  return `twilio-${componentId}-${part}-${idCounter}`;
}

function getTwilioComponentDimensions(component: TwilioComponent) {
  return component.shape === "ellipse"
    ? { width: TWILIO_CORE_DIAMETER, height: TWILIO_CORE_DIAMETER }
    : { width: TWILIO_COMPONENT_WIDTH, height: TWILIO_COMPONENT_HEIGHT };
}

export function createTwilioComponentElements(
  componentId: TwilioComponentId,
  position: Position,
  fontFamily: TwilioComponentFontFamily = DEFAULT_TWILIO_COMPONENT_FONT_FAMILY,
): Element[] {
  const component = getTwilioComponent(componentId);
  const colors = getTwilioComponentColors(component);
  const groupId = `twilio-${componentId}-${idCounter + 1}`;
  const { width, height } = getTwilioComponentDimensions(component);
  const boxId = nextId(componentId, "box");
  const labelId = nextId(componentId, "label");

  return [
    {
      id: boxId,
      type: component.shape ?? "rectangle",
      x: position.x,
      y: position.y,
      width,
      height,
      angle: 0,
      strokeColor: colors.stroke,
      backgroundColor: colors.background,
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [groupId],
      roundness: { type: 3 },
      seed: idCounter + 1,
      version: 1,
      versionNonce: idCounter + 2,
      isDeleted: false,
      boundElements: [{ id: labelId, type: "text" }],
      updated: Date.now(),
      link: null,
      locked: false,
    },
    {
      id: labelId,
      type: "text",
      x: position.x + LABEL_PADDING,
      y:
        position.y +
        (component.shape === "ellipse" ? height / 2 - 12 : 32),
      width: width - LABEL_PADDING * 2,
      height: 24,
      angle: 0,
      strokeColor: colors.label,
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [groupId],
      seed: idCounter + 1,
      version: 1,
      versionNonce: idCounter + 2,
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      text: component.label,
      fontSize: TWILIO_LABEL_FONT_SIZE,
      fontFamily,
      textAlign: "center",
      verticalAlign: "middle",
      // Excalidraw labels are individual text elements, but binding makes this
      // one a native label of the shape: it moves, resizes, and stays centered
      // with the component instead of behaving like a loose grouped object.
      containerId: boxId,
      originalText: component.label,
      lineHeight: 1.25,
    },
  ];
}

export function applyTwilioComponentTemplates(
  elements: unknown[],
  fontFamily: TwilioComponentFontFamily = DEFAULT_TWILIO_COMPONENT_FONT_FAMILY,
) {
  const replacements = new Map<string, string>();
  const boundLabelIds = new Set<string>();
  const nextElements: unknown[] = [];

  for (const element of elements) {
    if (!element || typeof element !== "object") {
      nextElements.push(element);
      continue;
    }

    const candidate = element as Record<string, unknown>;
    const customData = candidate.customData;
    const componentId =
      customData && typeof customData === "object"
        ? (customData as Record<string, unknown>).designbuddyComponentId
        : null;

    if (
      typeof componentId !== "string" ||
      !TWILIO_COMPONENTS.some((component) => component.id === componentId) ||
      typeof candidate.id !== "string" ||
      typeof candidate.x !== "number" ||
      typeof candidate.y !== "number"
    ) {
      nextElements.push(element);
      continue;
    }

    const originalWidth = typeof candidate.width === "number" ? candidate.width : TWILIO_COMPONENT_WIDTH;
    const originalHeight = typeof candidate.height === "number" ? candidate.height : TWILIO_COMPONENT_HEIGHT;
    const template = createTwilioComponentElements(
      componentId as TwilioComponentId,
      { x: candidate.x + originalWidth / 2 - TWILIO_COMPONENT_WIDTH / 2, y: candidate.y + originalHeight / 2 - TWILIO_COMPONENT_HEIGHT / 2 },
      fontFamily,
    );
    const templateBox = template[0];
    replacements.set(candidate.id, templateBox.id);

    if (Array.isArray(candidate.boundElements)) {
      candidate.boundElements.forEach((boundElement) => {
        if (
          boundElement &&
          typeof boundElement === "object" &&
          (boundElement as Record<string, unknown>).type === "text" &&
          typeof (boundElement as Record<string, unknown>).id === "string"
        ) {
          boundLabelIds.add((boundElement as Record<string, string>).id);
        }
      });
    }
    nextElements.push(...template);
  }

  return nextElements
    .filter((element) => !(element && typeof element === "object" && boundLabelIds.has((element as Record<string, unknown>).id as string)))
    .map((element) => {
      if (!element || typeof element !== "object") return element;
      const candidate = element as Record<string, unknown>;
      const remapBinding = (binding: unknown) => {
        if (!binding || typeof binding !== "object") return binding;
        const bindingRecord = binding as Record<string, unknown>;
        const replacementId = typeof bindingRecord.elementId === "string" ? replacements.get(bindingRecord.elementId) : undefined;
        return replacementId ? { ...bindingRecord, elementId: replacementId } : binding;
      };
      return { ...candidate, startBinding: remapBinding(candidate.startBinding), endBinding: remapBinding(candidate.endBinding) };
    });
}
