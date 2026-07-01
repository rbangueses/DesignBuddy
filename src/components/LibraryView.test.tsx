import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryView } from "./LibraryView";

vi.mock("../hooks/useDesignLibrary", () => ({
  useDesignLibrary: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

const { useDesignLibrary } = await import("../hooks/useDesignLibrary");
const { open, save } = await import("@tauri-apps/plugin-dialog");

function makeLibraryState() {
  return {
    projects: [{ name: "App", designCount: 1 }],
    designs: [
      {
        project: "App",
        name: "Flow",
        fileName: "Flow.excalidraw",
        kind: "excalidraw" as const,
        updatedAtMs: 1,
      },
    ],
    filteredDesigns: [
      {
        project: "App",
        name: "Flow",
        fileName: "Flow.excalidraw",
        kind: "excalidraw" as const,
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
    importDesign: vi.fn(),
    exportDesign: vi.fn(),
    renameDesign: vi.fn(),
    duplicateDesign: vi.fn(),
    deleteDesign: vi.fn(),
  };
}

describe("LibraryView", () => {
  beforeEach(() => {
    vi.mocked(useDesignLibrary).mockReset();
    vi.mocked(open).mockReset();
    vi.mocked(save).mockReset();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("opens duplicate and delete flows for projects and designs", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    library.duplicateProject.mockResolvedValue({ name: "App Copy", designCount: 1 });
    library.deleteProject.mockResolvedValue(undefined);
    library.duplicateDesign.mockResolvedValue({
      project: "App",
      name: "Flow Copy",
      fileName: "Flow Copy.excalidraw",
      kind: "excalidraw",
      updatedAtMs: 2,
    });
    library.deleteDesign.mockResolvedValue(undefined);
    vi.mocked(useDesignLibrary).mockReturnValue(library);

    render(<LibraryView onOpenDesign={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Duplicate App" }));

    let dialog = screen.getByRole("dialog", { name: "Duplicate project" });
    let nameInput = within(dialog).getByRole("textbox", { name: "Project name" });
    await user.clear(nameInput);
    await user.type(nameInput, "App Copy");
    await user.click(within(dialog).getByRole("button", { name: "Duplicate" }));

    await waitFor(() =>
      expect(library.duplicateProject).toHaveBeenCalledWith("App", "App Copy"),
    );

    await user.click(screen.getByRole("button", { name: "Delete App" }));

    dialog = screen.getByRole("dialog", { name: "Delete project" });
    expect(within(dialog).getByText(/App/)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(library.deleteProject).toHaveBeenCalledWith("App"));

    await user.click(screen.getByRole("button", { name: "Duplicate Flow" }));

    dialog = screen.getByRole("dialog", { name: "Duplicate design" });
    nameInput = within(dialog).getByRole("textbox", { name: "Design name" });
    await user.clear(nameInput);
    await user.type(nameInput, "Flow Copy");
    await user.click(within(dialog).getByRole("button", { name: "Duplicate" }));

    await waitFor(() =>
      expect(library.duplicateDesign).toHaveBeenCalledWith(
        "Flow.excalidraw",
        "Flow Copy",
      ),
    );

    await user.click(screen.getByRole("button", { name: "Delete Flow" }));

    dialog = screen.getByRole("dialog", { name: "Delete design" });
    expect(within(dialog).getByText(/Flow/)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(library.deleteDesign).toHaveBeenCalledWith("Flow.excalidraw"),
    );
  });

  it("shows a visible error when delete confirmation fails", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    library.deleteProject.mockRejectedValue(new Error("Delete failed."));
    vi.mocked(useDesignLibrary).mockReturnValue(library);

    render(<LibraryView onOpenDesign={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Delete App" }));

    const dialog = screen.getByRole("dialog", { name: "Delete project" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(within(dialog).getByText("Delete failed.")).toBeVisible(),
    );
    expect(screen.getByRole("dialog", { name: "Delete project" })).toBeVisible();
    expect(library.deleteProject).toHaveBeenCalledWith("App");
  });

  it("imports a chosen design file into the selected project", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    library.importDesign.mockResolvedValue({
      project: "App",
      name: "Imported",
      fileName: "Imported.excalidraw",
      kind: "excalidraw",
      updatedAtMs: 2,
    });
    vi.mocked(open).mockResolvedValue("/tmp/Imported.excalidraw");
    vi.mocked(useDesignLibrary).mockReturnValue(library);

    render(<LibraryView onOpenDesign={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Import design" }));

    await waitFor(() =>
      expect(library.importDesign).toHaveBeenCalledWith("/tmp/Imported.excalidraw"),
    );
    expect(open).toHaveBeenCalledWith({
      title: "Import design",
      multiple: false,
      filters: [
        {
          name: "BanguesesDraw designs",
          extensions: ["excalidraw", "json", "mmd"],
        },
      ],
    });
  });

  it("exports a design to the chosen file path", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    library.exportDesign.mockResolvedValue(undefined);
    vi.mocked(save).mockResolvedValue("/tmp/Flow.excalidraw");
    vi.mocked(useDesignLibrary).mockReturnValue(library);

    render(<LibraryView onOpenDesign={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Export Flow" }));

    await waitFor(() =>
      expect(library.exportDesign).toHaveBeenCalledWith(
        "Flow.excalidraw",
        "/tmp/Flow.excalidraw",
      ),
    );
    expect(save).toHaveBeenCalledWith({
      title: "Export design",
      defaultPath: "Flow.excalidraw",
      filters: [{ name: "Excalidraw", extensions: ["excalidraw"] }],
    });
  });

  it("creates a Mermaid flowchart in the selected project", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    const onOpenDesign = vi.fn();
    library.createDesign.mockResolvedValue({
      project: "App",
      name: "Routing",
      fileName: "Routing.mmd",
      kind: "mermaid",
      content: { source: "flowchart LR\n" },
    });
    vi.mocked(useDesignLibrary).mockReturnValue(library);

    render(<LibraryView onOpenDesign={onOpenDesign} />);

    await user.click(
      screen.getByRole("button", { name: "New Mermaid flowchart" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Create Mermaid flowchart",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Flowchart name" }),
      "Routing",
    );
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(library.createDesign).toHaveBeenCalledWith("Routing", "mermaid"),
    );
    expect(onOpenDesign).toHaveBeenCalledWith("App", "Routing.mmd");
  });

  it("configures AI settings and generates a design in the selected project", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    library.createDesign.mockResolvedValue({
      project: "App",
      name: "Generated Flow",
      fileName: "Generated Flow.excalidraw",
      kind: "excalidraw",
      content: {
        type: "excalidraw",
        elements: [],
        appState: {},
        files: {},
      },
    });
    vi.mocked(useDesignLibrary).mockReturnValue(library);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            type: "excalidraw",
            version: 2,
            source: "openai",
            elements: [{ id: "one", type: "rectangle" }],
            appState: {},
            files: {},
          }),
        }),
      }),
    );

    render(<LibraryView onOpenDesign={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "AI settings" }));

    let dialog = screen.getByRole("dialog", { name: "AI settings" });
    await user.type(
      within(dialog).getByLabelText("OpenAI API key"),
      "sk-test",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Default model"),
      "gpt-5.4",
    );
    await user.click(within(dialog).getByRole("button", { name: "Save settings" }));

    await user.click(screen.getByRole("button", { name: "AI diagram" }));

    dialog = screen.getByRole("dialog", { name: "AI diagram" });
    const designNameInput = within(dialog).getByLabelText("Design name");
    await user.clear(designNameInput);
    await user.type(designNameInput, "Generated Flow");
    await user.type(
      within(dialog).getByLabelText("Diagram description"),
      "Draw a simple auth flow",
    );
    await user.click(within(dialog).getByRole("button", { name: "Generate" }));

    await waitFor(() =>
      expect(library.createDesign).toHaveBeenCalledWith(
        "Generated Flow",
        "excalidraw",
        expect.objectContaining({
          type: "excalidraw",
          elements: [{ id: "one", type: "rectangle" }],
        }),
      ),
    );
  });

  it("allows cancelling a stuck AI generation request", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    vi.mocked(useDesignLibrary).mockReturnValue(library);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            const signal = init?.signal as AbortSignal | undefined;
            signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    );
    localStorage.setItem(
      "banguesesdraw.aiSettings",
      JSON.stringify({
        apiKey: "sk-test",
        selectedModel: "gpt-5.4-mini",
        customModel: "",
        quality: "balanced",
      }),
    );

    render(<LibraryView onOpenDesign={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "AI diagram" }));

    const dialog = screen.getByRole("dialog", { name: "AI diagram" });
    await user.type(
      within(dialog).getByLabelText("Diagram description"),
      "Draw a Twilio routing flow",
    );
    await user.click(within(dialog).getByRole("button", { name: "Generate" }));

    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeEnabled();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(within(dialog).getByText("Generation cancelled.")).toBeVisible(),
    );
    expect(library.createDesign).not.toHaveBeenCalled();
  });
});
