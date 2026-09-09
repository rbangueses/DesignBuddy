import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TWILIO_SHORTCUT_SETTINGS,
  getDuplicateTwilioShortcutKeys,
  loadTwilioShortcutSettings,
  saveTwilioShortcutSettings,
} from "./twilioShortcuts";

describe("twilioShortcuts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads the default palette shortcuts", () => {
    expect(loadTwilioShortcutSettings()).toEqual(
      DEFAULT_TWILIO_SHORTCUT_SETTINGS,
    );
    expect(DEFAULT_TWILIO_SHORTCUT_SETTINGS.shortcuts).toMatchObject({
      twilio: "t",
      taskrouter: "q",
      sync: "z",
      interconnect: "g",
      proxy: "h",
      "segment-connections": "1",
      knowledge: "k",
      "event-streams": "3",
      "segment-engage": "2",
    });
  });

  it("persists custom component shortcuts", () => {
    saveTwilioShortcutSettings({
      shortcuts: {
        ...DEFAULT_TWILIO_SHORTCUT_SETTINGS.shortcuts,
        voice: "7",
      },
    });

    expect(loadTwilioShortcutSettings()).toEqual({
      shortcuts: expect.objectContaining({ voice: "7" }),
    });
  });

  it("migrates former defaults to keep new component bindings unique", () => {
    localStorage.setItem(
      "designbuddy.twilioShortcuts",
      JSON.stringify({
        shortcuts: {
          taskrouter: "t",
          "segment-connections": "g",
          voice: "7",
        },
      }),
    );

    expect(loadTwilioShortcutSettings().shortcuts).toMatchObject({
      twilio: "t",
      taskrouter: "q",
      interconnect: "g",
      "segment-connections": "1",
      voice: "7",
    });
  });

  it("migrates the former Engage binding for Knowledge", () => {
    localStorage.setItem(
      "designbuddy.twilioShortcuts",
      JSON.stringify({ shortcuts: { "segment-engage": "k" } }),
    );

    expect(loadTwilioShortcutSettings().shortcuts).toMatchObject({
      knowledge: "k",
      "segment-engage": "2",
    });
  });

  it("flags duplicate component bindings", () => {
    expect(
      getDuplicateTwilioShortcutKeys(DEFAULT_TWILIO_SHORTCUT_SETTINGS),
    ).toEqual([]);

    expect(
      getDuplicateTwilioShortcutKeys({
        ...DEFAULT_TWILIO_SHORTCUT_SETTINGS,
        shortcuts: {
          ...DEFAULT_TWILIO_SHORTCUT_SETTINGS.shortcuts,
          voice: "m",
        },
      }),
    ).toEqual(["m"]);
  });
});
