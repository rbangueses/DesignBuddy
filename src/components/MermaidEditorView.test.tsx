import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { designApi } from "../lib/designApi";
import { MermaidEditorView } from "./MermaidEditorView";
import { save } from "@tauri-apps/plugin-dialog";

vi.mock("./MermaidPreview", () => ({
  MermaidPreview: ({ source }: { source: string }) => (
    <div>Preview: {source}</div>
  ),
}));

vi.mock("../lib/designApi", () => ({
  designApi: {
    copyDesign: vi.fn(),
    createDesign: vi.fn(),
    writeDesign: vi.fn(),
    renameDesign: vi.fn(),
    duplicateDesign: vi.fn(),
    exportDesign: vi.fn(),
    listProjects: vi.fn(),
    moveDesign: vi.fn(),
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
    vi.mocked(designApi.copyDesign).mockReset();
    vi.mocked(designApi.moveDesign).mockReset();
    vi.mocked(designApi.listProjects).mockReset();
    vi.mocked(designApi.listProjects).mockResolvedValue([{ name: "Docs", designCount: 1 }]);
    vi.mocked(designApi.exportDesign).mockReset();
    vi.mocked(save).mockReset();
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

  it("exports Mermaid source from the shared export menu", async () => {
    const user = userEvent.setup();

    vi.mocked(save).mockResolvedValue("/tmp/Flow.mmd");
    vi.mocked(designApi.exportDesign).mockResolvedValue(undefined);

    render(
      <MermaidEditorView
        project="Docs"
        fileName="Flow.mmd"
        initialSource="flowchart LR\n"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("menuitem", { name: /Mermaid source/i }));

    await waitFor(() =>
      expect(designApi.exportDesign).toHaveBeenCalledWith(
        "Docs",
        "Flow.mmd",
        "/tmp/Flow.mmd",
      ),
    );
    expect(save).toHaveBeenCalledWith({
      title: "Export Mermaid source",
      defaultPath: "Flow.mmd",
      filters: [{ name: "Mermaid", extensions: ["mmd"] }],
    });
  });
});
