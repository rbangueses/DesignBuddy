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
    const onDeleteDesign = vi.fn();
    const design = {
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
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
        onRenameDesign={vi.fn()}
        onDuplicateDesign={vi.fn()}
        onDeleteDesign={onDeleteDesign}
        onOpenDesign={onOpenDesign}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete Flow" }));

    expect(onDeleteDesign).toHaveBeenCalledWith(design);
    expect(onOpenDesign).not.toHaveBeenCalled();
  });
});
