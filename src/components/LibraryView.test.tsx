import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryView } from "./LibraryView";

vi.mock("../hooks/useDesignLibrary", () => ({
  useDesignLibrary: vi.fn(),
}));

const { useDesignLibrary } = await import("../hooks/useDesignLibrary");

function makeLibraryState() {
  return {
    projects: [{ name: "App", designCount: 1 }],
    designs: [
      {
        project: "App",
        name: "Flow",
        fileName: "Flow.excalidraw",
        updatedAtMs: 1,
      },
    ],
    filteredDesigns: [
      {
        project: "App",
        name: "Flow",
        fileName: "Flow.excalidraw",
        updatedAtMs: 1,
      },
    ],
    selectedProject: "App",
    filter: "",
    isLoading: false,
    isDesignsLoading: false,
    error: null,
    setSelectedProject: vi.fn(),
    setFilter: vi.fn(),
    refresh: vi.fn(),
    createProject: vi.fn().mockResolvedValue({ name: "Ideas", designCount: 0 }),
    renameProject: vi.fn(),
    duplicateProject: vi.fn(),
    deleteProject: vi.fn(),
    createDesign: vi.fn(),
    renameDesign: vi.fn(),
    duplicateDesign: vi.fn(),
    deleteDesign: vi.fn(),
  };
}

describe("LibraryView", () => {
  beforeEach(() => {
    vi.mocked(useDesignLibrary).mockReset();
  });

  it("opens the create project dialog and submits through an accessibly named input", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    vi.mocked(useDesignLibrary).mockReturnValue(library);

    render(<LibraryView onOpenDesign={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Create project" }));

    const dialog = screen.getByRole("dialog", { name: "Create project" });
    const nameInput = within(dialog).getByRole("textbox", { name: "Project name" });

    await user.type(nameInput, "Ideas");
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => expect(library.createProject).toHaveBeenCalledWith("Ideas"));
  });
});
