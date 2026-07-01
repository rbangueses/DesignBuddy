import { describe, expect, it } from "vitest";
import { parseMermaidFlowchart } from "./mermaidFlowchart";

describe("parseMermaidFlowchart", () => {
  it("parses simple LR flowcharts", () => {
    expect(
      parseMermaidFlowchart("flowchart LR\n  A[Start] -->|go| B[Done]\n"),
    ).toEqual({
      direction: "LR",
      nodes: [
        { id: "A", label: "Start", shape: "rectangle" },
        { id: "B", label: "Done", shape: "rectangle" },
      ],
      edges: [{ from: "A", to: "B", label: "go" }],
    });
  });

  it("parses rounded decision and database shapes", () => {
    expect(
      parseMermaidFlowchart("flowchart TD\n  A(Start) --> B{Ready?}\n  B --> C[(Store)]\n"),
    ).toEqual({
      direction: "TD",
      nodes: [
        { id: "A", label: "Start", shape: "rounded" },
        { id: "B", label: "Ready?", shape: "decision" },
        { id: "C", label: "Store", shape: "database" },
      ],
      edges: [
        { from: "A", to: "B" },
        { from: "B", to: "C" },
      ],
    });
  });

  it("parses chained arrows as separate edges", () => {
    expect(
      parseMermaidFlowchart(
        [
          "flowchart TD",
          "  ORCH[Twilio Orchestrator] -->|trigger| MEM[(Memory)] --> SUM[Summaries]",
          "  VOICE[Voice] --> RELAY[Conversation Relay] --> TAC[Twilio Agent Connect]",
        ].join("\n"),
      ),
    ).toEqual({
      direction: "TD",
      nodes: [
        { id: "ORCH", label: "Twilio Orchestrator", shape: "rectangle" },
        { id: "MEM", label: "Memory", shape: "database" },
        { id: "SUM", label: "Summaries", shape: "rectangle" },
        { id: "VOICE", label: "Voice", shape: "rectangle" },
        { id: "RELAY", label: "Conversation Relay", shape: "rectangle" },
        { id: "TAC", label: "Twilio Agent Connect", shape: "rectangle" },
      ],
      edges: [
        { from: "ORCH", to: "MEM", label: "trigger" },
        { from: "MEM", to: "SUM" },
        { from: "VOICE", to: "RELAY" },
        { from: "RELAY", to: "TAC" },
      ],
    });
  });

  it("rejects unsupported syntax", () => {
    expect(() =>
      parseMermaidFlowchart("flowchart LR\n  subgraph One\n  A --> B\n  end\n"),
    ).toThrow("Only simple flowchart nodes and arrows are supported for conversion.");
  });
});
