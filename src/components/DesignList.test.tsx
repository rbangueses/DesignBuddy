import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DesignList } from "./DesignList";

describe("DesignList", () => {
  it("shows filtered-empty copy when the project has designs but none match the query", () => {
    render(
      <DesignList
        project="App"
        designs={[]}
        totalDesignCount={2}
        filter="site"
        onFilterChange={vi.fn()}
        onCreateDesign={vi.fn()}
        onCreateMermaidDesign={vi.fn()}
        onCreateAiDesign={vi.fn()}
        onConfigureAi={vi.fn()}
        onImportDesign={vi.fn()}
        onExportDesign={vi.fn()}
        onRenameDesign={vi.fn()}
        onDuplicateDesign={vi.fn()}
        onDeleteDesign={vi.fn()}
        onOpenDesign={vi.fn()}
      />,
    );

    expect(screen.getByText('No designs match "site".')).toBeVisible();
    expect(screen.queryByText("No designs in this project yet.")).not.toBeInTheDocument();
  });

  it("shows the project-empty copy when there are no designs yet", () => {
    render(
      <DesignList
        project="App"
        designs={[]}
        totalDesignCount={0}
        filter=""
        onFilterChange={vi.fn()}
        onCreateDesign={vi.fn()}
        onCreateMermaidDesign={vi.fn()}
        onCreateAiDesign={vi.fn()}
        onConfigureAi={vi.fn()}
        onImportDesign={vi.fn()}
        onExportDesign={vi.fn()}
        onRenameDesign={vi.fn()}
        onDuplicateDesign={vi.fn()}
        onDeleteDesign={vi.fn()}
        onOpenDesign={vi.fn()}
      />,
    );

    expect(screen.getByText("No designs in this project yet.")).toBeVisible();
  });

  it("routes action-button clicks without opening the design", async () => {
    const user = userEvent.setup();
    const onOpenDesign = vi.fn();
    const onExportDesign = vi.fn();
    const onDeleteDesign = vi.fn();
    const design = {
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw" as const,
      updatedAtMs: 1,
    };

    render(
      <DesignList
        project="App"
        designs={[design]}
        totalDesignCount={1}
        filter=""
        onFilterChange={vi.fn()}
        onCreateDesign={vi.fn()}
        onCreateMermaidDesign={vi.fn()}
        onCreateAiDesign={vi.fn()}
        onConfigureAi={vi.fn()}
        onImportDesign={vi.fn()}
        onExportDesign={onExportDesign}
        onRenameDesign={vi.fn()}
        onDuplicateDesign={vi.fn()}
        onDeleteDesign={onDeleteDesign}
        onOpenDesign={onOpenDesign}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete Flow" }));

    expect(onDeleteDesign).toHaveBeenCalledWith(design);
    expect(onOpenDesign).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Export Flow" }));

    expect(onExportDesign).toHaveBeenCalledWith(design);
    expect(onOpenDesign).not.toHaveBeenCalled();
  });

  it("calls the import handler from the project header", async () => {
    const user = userEvent.setup();
    const onImportDesign = vi.fn();

    render(
      <DesignList
        project="App"
        designs={[]}
        totalDesignCount={0}
        filter=""
        onFilterChange={vi.fn()}
        onCreateDesign={vi.fn()}
        onCreateMermaidDesign={vi.fn()}
        onCreateAiDesign={vi.fn()}
        onConfigureAi={vi.fn()}
        onImportDesign={onImportDesign}
        onExportDesign={vi.fn()}
        onRenameDesign={vi.fn()}
        onDuplicateDesign={vi.fn()}
        onDeleteDesign={vi.fn()}
        onOpenDesign={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Import design" }));

    expect(onImportDesign).toHaveBeenCalledTimes(1);
  });

  it("shows type labels and a new Mermaid flowchart action", () => {
    render(
      <DesignList
        project="Docs"
        designs={[
          {
            project: "Docs",
            name: "Canvas",
            fileName: "Canvas.excalidraw",
            kind: "excalidraw",
            updatedAtMs: 1,
          },
          {
            project: "Docs",
            name: "Flow",
            fileName: "Flow.mmd",
            kind: "mermaid",
            updatedAtMs: 2,
          },
        ]}
        totalDesignCount={2}
        filter=""
        onFilterChange={vi.fn()}
        onCreateDesign={vi.fn()}
        onCreateMermaidDesign={vi.fn()}
        onCreateAiDesign={vi.fn()}
        onConfigureAi={vi.fn()}
        onImportDesign={vi.fn()}
        onExportDesign={vi.fn()}
        onRenameDesign={vi.fn()}
        onDuplicateDesign={vi.fn()}
        onDeleteDesign={vi.fn()}
        onOpenDesign={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /new mermaid flowchart/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Excalidraw")).toBeInTheDocument();
    expect(screen.getByText("Mermaid")).toBeInTheDocument();
  });

  it("hides the new Mermaid action when Mermaid is disabled", () => {
    render(
      <DesignList
        project="Docs"
        designs={[
          {
            project: "Docs",
            name: "Flow",
            fileName: "Flow.mmd",
            kind: "mermaid",
            updatedAtMs: 2,
          },
        ]}
        totalDesignCount={1}
        filter=""
        enableMermaid={false}
        onFilterChange={vi.fn()}
        onCreateDesign={vi.fn()}
        onCreateMermaidDesign={vi.fn()}
        onCreateAiDesign={vi.fn()}
        onConfigureAi={vi.fn()}
        onImportDesign={vi.fn()}
        onExportDesign={vi.fn()}
        onRenameDesign={vi.fn()}
        onDuplicateDesign={vi.fn()}
        onDeleteDesign={vi.fn()}
        onOpenDesign={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /new mermaid flowchart/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Mermaid")).toBeInTheDocument();
  });
});
