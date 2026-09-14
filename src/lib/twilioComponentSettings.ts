import {
  DEFAULT_TWILIO_COMPONENT_FONT_FAMILY,
  TWILIO_COMPONENT_FONT_OPTIONS,
  type TwilioComponentFontFamily,
} from "./twilioComponents";

export const TWILIO_COMPONENT_SETTINGS_STORAGE_KEY =
  "designbuddy.twilioComponentSettings";

export type TwilioComponentSettings = {
  fontFamily: TwilioComponentFontFamily;
};

export const DEFAULT_TWILIO_COMPONENT_SETTINGS: TwilioComponentSettings = {
  fontFamily: DEFAULT_TWILIO_COMPONENT_FONT_FAMILY,
};

function isTwilioComponentFontFamily(
  value: unknown,
): value is TwilioComponentFontFamily {
  return TWILIO_COMPONENT_FONT_OPTIONS.some((option) => option.value === value);
}

function sanitizeTwilioComponentSettings(value: unknown): TwilioComponentSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_TWILIO_COMPONENT_SETTINGS };
  }

  const candidate = value as Partial<TwilioComponentSettings>;

  return {
    fontFamily: isTwilioComponentFontFamily(candidate.fontFamily)
      ? candidate.fontFamily
      : DEFAULT_TWILIO_COMPONENT_FONT_FAMILY,
  };
}

export function loadTwilioComponentSettings(): TwilioComponentSettings {
  try {
    const serializedSettings = localStorage.getItem(
      TWILIO_COMPONENT_SETTINGS_STORAGE_KEY,
    );

    return serializedSettings
      ? sanitizeTwilioComponentSettings(JSON.parse(serializedSettings))
      : { ...DEFAULT_TWILIO_COMPONENT_SETTINGS };
  } catch {
    return { ...DEFAULT_TWILIO_COMPONENT_SETTINGS };
  }
}

export function saveTwilioComponentSettings(settings: TwilioComponentSettings) {
  localStorage.setItem(
    TWILIO_COMPONENT_SETTINGS_STORAGE_KEY,
    JSON.stringify(sanitizeTwilioComponentSettings(settings)),
  );
}
