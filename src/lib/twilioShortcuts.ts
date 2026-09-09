import { TWILIO_COMPONENTS, type TwilioComponentId } from "./twilioComponents";

export const TWILIO_SHORTCUTS_STORAGE_KEY = "designbuddy.twilioShortcuts";

export type TwilioShortcutSettings = {
  shortcuts: Record<TwilioComponentId, string>;
};

const DEFAULT_SHORTCUTS: Record<TwilioComponentId, string> = {
  twilio: "t",
  orchestrator: "o",
  messaging: "m",
  voice: "v",
  sms: "s",
  whatsapp: "w",
  "email-api": "e",
  recording: "r",
  verify: "y",
  lookup: "l",
  "conversation-relay": "c",
  "agent-connect": "a",
  "conversation-intelligence": "i",
  memory: "n",
  functions: "f",
  assets: "d",
  studio: "u",
  taskrouter: "q",
  flex: "x",
  "third-party-api": "p",
  "segment-cdp": "b",
  "segment-connections": "1",
  "segment-profiles": "j",
  "segment-engage": "2",
  knowledge: "k",
  "event-streams": "3",
  sync: "z",
  interconnect: "g",
  proxy: "h",
};

export const DEFAULT_TWILIO_SHORTCUT_SETTINGS: TwilioShortcutSettings = {
  shortcuts: DEFAULT_SHORTCUTS,
};

export function normalizeTwilioShortcut(value: string) {
  const shortcut = value.trim();

  return Array.from(shortcut).length === 1 ? shortcut.toLowerCase() : "";
}

function sanitizeShortcuts(value: unknown): Record<TwilioComponentId, string> {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_SHORTCUTS };
  }

  const candidate = value as Record<string, unknown>;

  const shortcuts = TWILIO_COMPONENTS.reduce<Record<TwilioComponentId, string>>(
    (shortcuts, component) => {
      const storedShortcut = candidate[component.id];
      shortcuts[component.id] =
        typeof storedShortcut === "string"
          ? normalizeTwilioShortcut(storedShortcut)
          : DEFAULT_SHORTCUTS[component.id];
      return shortcuts;
    },
    {} as Record<TwilioComponentId, string>,
  );

  // These were defaults before the Twilio and Interconnect templates existed.
  if (!("twilio" in candidate) && shortcuts.taskrouter === "t") {
    shortcuts.taskrouter = "q";
  }
  if (!("interconnect" in candidate) && shortcuts["segment-connections"] === "g") {
    shortcuts["segment-connections"] = "1";
  }
  if (!("knowledge" in candidate) && shortcuts["segment-engage"] === "k") {
    shortcuts["segment-engage"] = "2";
  }

  return shortcuts;
}

function sanitizeTwilioShortcutSettings(value: unknown): TwilioShortcutSettings {
  if (!value || typeof value !== "object") {
    return {
      shortcuts: { ...DEFAULT_SHORTCUTS },
    };
  }

  const candidate = value as Partial<TwilioShortcutSettings>;

  return {
    shortcuts: sanitizeShortcuts(candidate.shortcuts),
  };
}

export function loadTwilioShortcutSettings(): TwilioShortcutSettings {
  try {
    const serializedSettings = localStorage.getItem(TWILIO_SHORTCUTS_STORAGE_KEY);

    return serializedSettings
      ? sanitizeTwilioShortcutSettings(JSON.parse(serializedSettings))
      : {
          shortcuts: { ...DEFAULT_SHORTCUTS },
        };
  } catch {
    return {
      shortcuts: { ...DEFAULT_SHORTCUTS },
    };
  }
}

export function saveTwilioShortcutSettings(settings: TwilioShortcutSettings) {
  localStorage.setItem(
    TWILIO_SHORTCUTS_STORAGE_KEY,
    JSON.stringify(sanitizeTwilioShortcutSettings(settings)),
  );
}

export function getDuplicateTwilioShortcutKeys(
  settings: TwilioShortcutSettings,
) {
  const counts = new Map<string, number>();

  Object.values(settings.shortcuts).forEach((shortcut) => {
    if (shortcut) {
      counts.set(shortcut, (counts.get(shortcut) ?? 0) + 1);
    }
  });

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([shortcut]) => shortcut)
    .sort();
}

export function findTwilioComponentByShortcut(
  shortcuts: Record<TwilioComponentId, string>,
  key: string,
) {
  const normalizedKey = normalizeTwilioShortcut(key);

  return TWILIO_COMPONENTS.find(
    (component) => shortcuts[component.id] === normalizedKey,
  );
}
