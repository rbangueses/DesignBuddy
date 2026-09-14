import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TWILIO_COMPONENT_SETTINGS,
  loadTwilioComponentSettings,
  saveTwilioComponentSettings,
  TWILIO_COMPONENT_SETTINGS_STORAGE_KEY,
} from "./twilioComponentSettings";

describe("twilioComponentSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses Excalifont by default", () => {
    expect(loadTwilioComponentSettings()).toEqual(
      DEFAULT_TWILIO_COMPONENT_SETTINGS,
    );
  });

  it("persists the selected component font", () => {
    saveTwilioComponentSettings({ fontFamily: 6 });

    expect(loadTwilioComponentSettings()).toEqual({ fontFamily: 6 });
  });

  it("falls back safely when a stored font is invalid", () => {
    localStorage.setItem(
      TWILIO_COMPONENT_SETTINGS_STORAGE_KEY,
      JSON.stringify({ fontFamily: 99 }),
    );

    expect(loadTwilioComponentSettings()).toEqual(
      DEFAULT_TWILIO_COMPONENT_SETTINGS,
    );
  });
});
