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
          strokeColor: "#B5121B",
          backgroundColor: "#F22F46",
          fillStyle: "solid",
        }),
        expect.objectContaining({
          type: "text",
          text: "Twilio Orchestrator",
          x: 136,
          y: 112,
          strokeColor: "#ffffff",
          fontSize: 16,
          textAlign: "center",
          width: 198,
        }),
      ]),
    );
  });

  it("exposes a focused set of Twilio architecture components", () => {
    expect(TWILIO_COMPONENTS.map((component) => component.id)).toEqual([
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
      ]),
    );
  });

  it("organizes Twilio components into picker groups", () => {
    expect(TWILIO_COMPONENT_GROUPS).toEqual([
      {
        title: "Channels",
        componentIds: [
          "messaging",
          "voice",
          "sms",
          "whatsapp",
          "email-api",
          "recording",
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
        title: "Contact Center",
        componentIds: ["flex", "studio", "taskrouter"],
      },
      {
        title: "Compute & Integrations",
        componentIds: ["functions", "assets", "third-party-api"],
      },
      {
        title: "Segment Stack",
        componentIds: [
          "segment-cdp",
          "segment-connections",
          "segment-profiles",
          "segment-engage",
        ],
      },
    ]);
  });

  it("renders third-party APIs as external yellow blocks", () => {
    const elements = createTwilioComponentElements("third-party-api", {
      x: 120,
      y: 80,
    });

    expect(elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "rectangle",
          strokeColor: "#B7791F",
          backgroundColor: "#FACC15",
        }),
        expect.objectContaining({
          type: "text",
          strokeColor: "#1f2937",
        }),
      ]),
    );
  });
});
