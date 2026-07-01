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

  it("rejects unsupported syntax", () => {
    expect(() =>
      parseMermaidFlowchart("flowchart LR\n  subgraph One\n  A --> B\n  end\n"),
    ).toThrow("Only simple flowchart nodes and arrows are supported for conversion.");
  });
});
