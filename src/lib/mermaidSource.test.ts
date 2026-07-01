import { describe, expect, it } from "vitest";
import { normaliseMermaidContent, validateMermaidSource } from "./mermaidSource";

describe("mermaidSource", () => {
  it("accepts flowchart source", () => {
    expect(validateMermaidSource("flowchart LR\n  A[Start] --> B[Done]\n")).toBeNull();
  });

  it("rejects empty or non-flowchart source", () => {
    expect(validateMermaidSource("")).toBe(
      "Mermaid source must start with flowchart LR or flowchart TD.",
    );
    expect(validateMermaidSource("sequenceDiagram\nA->>B: Hi")).toBe(
      "Mermaid source must start with flowchart LR or flowchart TD.",
    );
  });

  it("normalises content from the backend", () => {
    expect(normaliseMermaidContent({ source: "flowchart TD\n" })).toEqual({
      source: "flowchart TD\n",
    });
  });
});
