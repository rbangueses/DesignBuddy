import { describe, expect, it } from "vitest";
import {
  createTwilioComponentElements,
  TWILIO_COMPONENT_GROUPS,
  TWILIO_COMPONENTS,
} from "./twilioComponents";

describe("Twilio component library", () => {
  it("creates a reusable Excalidraw component group with a label", () => {
    const elements = createTwilioComponentElements("orchestrator", {
      x: 120,
      y: 80,
    });

    expect(elements).toHaveLength(2);
    expect(elements.map((element) => element.groupIds)).toEqual([
      [expect.stringMatching(/^twilio-orchestrator-/)],
      [expect.stringMatching(/^twilio-orchestrator-/)],
    ]);
    expect(elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "rectangle",
          strokeColor: "#F22F46",
          backgroundColor: "transparent",
          fillStyle: "solid",
        }),
        expect.objectContaining({
          type: "text",
          text: "Twilio Orchestrator",
          x: 136,
          y: 112,
          strokeColor: "#F22F46",
          fontSize: 16,
          textAlign: "center",
          width: 198,
        }),
      ]),
    );
    const [box, label] = elements;
    expect(box.boundElements).toEqual([{ id: label.id, type: "text" }]);
    expect(label.containerId).toBe(box.id);
    expect(label.verticalAlign).toBe("middle");
    expect(label.fontFamily).toBe(5);
  });

  it("uses the selected font for newly inserted component labels", () => {
    const [, label] = createTwilioComponentElements(
      "twilio",
      { x: 120, y: 80 },
      8,
    );

    expect(label.fontFamily).toBe(8);
  });

  it("exposes a focused set of Twilio architecture components", () => {
    expect(TWILIO_COMPONENTS.map((component) => component.id)).toEqual([
      "twilio",
      "orchestrator",
      "messaging",
      "voice",
      "sms",
      "whatsapp",
      "email-api",
      "recording",
      "verify",
      "lookup",
      "conversation-relay",
      "agent-connect",
      "conversation-intelligence",
      "memory",
      "functions",
      "assets",
      "studio",
      "taskrouter",
      "flex",
      "third-party-api",
      "segment-cdp",
      "segment-connections",
      "segment-profiles",
      "segment-engage",
      "knowledge",
      "event-streams",
      "sync",
      "interconnect",
      "proxy",
    ]);
    expect(TWILIO_COMPONENTS.map((component) => component.label)).toEqual(
      expect.arrayContaining([
        "Prog. Messaging",
        "Prog. Voice",
        "SMS",
        "WhatsApp",
        "Email API",
        "Recording",
        "Verify",
        "Lookup",
        "Assets",
        "Segment CDP",
        "Connections",
        "Profiles",
        "Engage",
        "Knowledge",
        "Event Streams",
        "Sync",
        "Interconnect",
        "Proxy",
      ]),
    );
  });

  it("organizes Twilio components into picker groups", () => {
    expect(TWILIO_COMPONENT_GROUPS).toEqual([
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
    ]);
  });

  it("renders the Twilio core component as a circular red outline", () => {
    const elements = createTwilioComponentElements("twilio", { x: 120, y: 80 });

    expect(elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "ellipse",
          width: 128,
          height: 128,
          strokeColor: "#F22F46",
          backgroundColor: "transparent",
        }),
        expect.objectContaining({
          type: "text",
          text: "Twilio",
          x: 136,
          y: 132,
          width: 96,
        }),
      ]),
    );
  });

  it("renders third-party APIs as external yellow outlines", () => {
    const elements = createTwilioComponentElements("third-party-api", {
      x: 120,
      y: 80,
    });

    expect(elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "rectangle",
          strokeColor: "#B7791F",
          backgroundColor: "transparent",
        }),
        expect.objectContaining({
          type: "text",
          strokeColor: "#B7791F",
        }),
      ]),
    );
  });
});
