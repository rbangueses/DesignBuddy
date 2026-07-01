import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { designApi } from "../lib/designApi";
import { MermaidEditorView } from "./MermaidEditorView";

vi.mock("./MermaidPreview", () => ({
  MermaidPreview: ({ source }: { source: string }) => (
    <div>Preview: {source}</div>
  ),
}));

vi.mock("../lib/designApi", () => ({
  designApi: {
    createDesign: vi.fn(),
    writeDesign: vi.fn(),
    renameDesign: vi.fn(),
    duplicateDesign: vi.fn(),
    exportDesign: vi.fn(),
  },
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
}));

describe("MermaidEditorView", () => {
  beforeEach(() => {
    vi.mocked(designApi.writeDesign).mockReset();
    vi.mocked(designApi.createDesign).mockReset();
    vi.mocked(designApi.renameDesign).mockReset();
    vi.mocked(designApi.duplicateDesign).mockReset();
    vi.mocked(designApi.exportDesign).mockReset();
  });

  it("edits and saves Mermaid source", async () => {
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "Docs",
      name: "Flow",
      fileName: "Flow.mmd",
      kind: "mermaid",
      content: { source: "flowchart LR\n  A[Start] --> B[Done]\n" },
    });

    render(
      <MermaidEditorView
        project="Docs"
        fileName="Flow.mmd"
        initialSource="flowchart LR\n"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/mermaid source/i), {
      target: { value: "flowchart LR\n  A[Start] --> B[Done]\n" },
    });
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(designApi.writeDesign).toHaveBeenCalledWith("Docs", "Flow.mmd", {
        source: "flowchart LR\n  A[Start] --> B[Done]\n",
      });
    });
  });

  it("converts Mermaid source into a new Excalidraw design", async () => {
    const emptyScene = {
      type: "excalidraw" as const,
      version: 2,
      source: "banguesesdraw",
      elements: [],
      appState: {},
      files: {},
    };
    const onOpenExcalidraw = vi.fn();
    vi.mocked(designApi.createDesign).mockResolvedValue({
      project: "Docs",
      name: "Flow Excalidraw",
      fileName: "Flow Excalidraw.excalidraw",
      kind: "excalidraw",
      content: emptyScene,
    });
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "Docs",
      name: "Flow Excalidraw",
      fileName: "Flow Excalidraw.excalidraw",
      kind: "excalidraw",
      content: emptyScene,
    });

    render(
      <MermaidEditorView
        project="Docs"
        fileName="Flow.mmd"
        initialSource={"flowchart LR\n  A[Start] --> B[Done]\n"}
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
        onOpenExcalidraw={onOpenExcalidraw}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /convert to excalidraw/i }),
    );

    expect(designApi.createDesign).toHaveBeenCalledWith(
      "Docs",
      "Flow Excalidraw",
      "excalidraw",
    );
    expect(onOpenExcalidraw).toHaveBeenCalledWith(
      "Docs",
      "Flow Excalidraw.excalidraw",
      expect.any(Object),
    );
  });
});
