import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectSidebar } from "./ProjectSidebar";

describe("ProjectSidebar", () => {
  const projects = [
    {
      name: "Customer A",
      designCount: 2,
      visibleInPresentationMode: false,
    },
    {
      name: "Reference Architectures",
      designCount: 4,
      visibleInPresentationMode: true,
    },
    {
      name: "Customer B",
      designCount: 1,
      visibleInPresentationMode: false,
    },
  ];

  it("hides private projects in presentation mode while keeping the active project visible", () => {
    render(
      <ProjectSidebar
        projects={projects}
        selectedProject="Customer A"
        presentationMode
        onTogglePresentationMode={vi.fn()}
        onSetProjectVisibility={vi.fn()}
        onSelectProject={vi.fn()}
        onCreateProject={vi.fn()}
        onRenameProject={vi.fn()}
        onDuplicateProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />,
    );

    expect(screen.getByText("Customer A")).toBeVisible();
    expect(screen.getByText("Reference Architectures")).toBeVisible();
    expect(screen.queryByText("Customer B")).not.toBeInTheDocument();
    expect(screen.getByText("1 private project hidden")).toBeVisible();
  });

  it("toggles presentation mode and per-project visibility", async () => {
    const user = userEvent.setup();
    const onTogglePresentationMode = vi.fn();
    const onSetProjectVisibility = vi.fn();

    render(
      <ProjectSidebar
        projects={projects}
        selectedProject="Customer A"
        presentationMode={false}
        onTogglePresentationMode={onTogglePresentationMode}
        onSetProjectVisibility={onSetProjectVisibility}
        onSelectProject={vi.fn()}
        onCreateProject={vi.fn()}
        onRenameProject={vi.fn()}
        onDuplicateProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Start presentation mode" }));

    expect(onTogglePresentationMode).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Start presentation mode" })).toHaveAttribute(
      "title",
      "Start presentation mode. Press H to focus the selected project or show all projects.",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Show Customer A in presentation mode",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Hide Reference Architectures in presentation mode",
      }),
    );

    expect(onSetProjectVisibility).toHaveBeenNthCalledWith(1, "Customer A", true);
    expect(onSetProjectVisibility).toHaveBeenNthCalledWith(
      2,
      "Reference Architectures",
      false,
    );
  });

  it("filters projects from the sidebar search", async () => {
    const user = userEvent.setup();

    render(
      <ProjectSidebar
        projects={projects}
        selectedProject="Customer A"
        presentationMode={false}
        onTogglePresentationMode={vi.fn()}
        onSetProjectVisibility={vi.fn()}
        onSelectProject={vi.fn()}
        onCreateProject={vi.fn()}
        onRenameProject={vi.fn()}
        onDuplicateProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />,
    );

    await user.type(screen.getByRole("searchbox", { name: "Search projects" }), "ref");

    expect(screen.queryByText("Customer A")).not.toBeInTheDocument();
    expect(screen.getByText("Reference Architectures")).toBeVisible();
    expect(screen.queryByText("Customer B")).not.toBeInTheDocument();
  });
});
