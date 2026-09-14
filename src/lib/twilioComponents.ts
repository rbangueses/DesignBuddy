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
