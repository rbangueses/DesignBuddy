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
    projects: [
      { name: "App", designCount: 1, visibleInPresentationMode: false },
    ],
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
    createProject: vi
      .fn()
      .mockResolvedValue({
        name: "Ideas",
        designCount: 0,
        visibleInPresentationMode: false,
      }),
    renameProject: vi.fn(),
    duplicateProject: vi.fn(),
    deleteProject: vi.fn(),
    setProjectVisibility: vi.fn().mockResolvedValue({
      name: "App",
      designCount: 1,
      visibleInPresentationMode: true,
    }),
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

    await user.click(screen.getByRole("button", { name: "Project actions for App" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    let dialog = screen.getByRole("dialog", { name: "Duplicate project" });
    let nameInput = within(dialog).getByRole("textbox", { name: "Project name" });
    await user.clear(nameInput);
    await user.type(nameInput, "App Copy");
    await user.click(within(dialog).getByRole("button", { name: "Duplicate" }));

    await waitFor(() =>
      expect(library.duplicateProject).toHaveBeenCalledWith("App", "App Copy"),
    );

    await user.click(screen.getByRole("button", { name: "Project actions for App" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

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

    await user.click(screen.getByRole("button", { name: "Project actions for App" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

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
          name: "DesignBuddy artifacts",
          extensions: ["excalidraw", "json", "mmd", "bdnote"],
        },
      ],
    });
  });

  it("removes Mermaid from import filters when Mermaid is disabled", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    vi.mocked(open).mockResolvedValue("/tmp/Imported.excalidraw");
    vi.mocked(useDesignLibrary).mockReturnValue(library);
    localStorage.setItem(
      "banguesesdraw.aiSettings",
      JSON.stringify({
        apiKey: "",
        selectedModel: "gpt-5.4-mini",
        customModel: "",
        quality: "balanced",
        enableMermaid: false,
      }),
    );

    render(<LibraryView onOpenDesign={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: "New Mermaid" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Import design" }));

    expect(open).toHaveBeenCalledWith({
      title: "Import design",
      multiple: false,
      filters: [
        {
          name: "DesignBuddy artifacts",
          extensions: ["excalidraw", "json", "bdnote"],
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

  it("hides private projects in presentation mode and updates project visibility", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    library.projects = [
      { name: "Client A", designCount: 1, visibleInPresentationMode: false },
      {
        name: "Reference Architectures",
        designCount: 3,
        visibleInPresentationMode: true,
      },
      { name: "Client B", designCount: 2, visibleInPresentationMode: false },
    ];
    library.selectedProject = "Client A";
    vi.mocked(useDesignLibrary).mockReturnValue(library);

    render(<LibraryView onOpenDesign={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Start presentation mode" }));

    const projectsNav = screen.getByRole("navigation", { name: "Projects" });

    expect(within(projectsNav).getByText("Client A")).toBeVisible();
    expect(within(projectsNav).getByText("Reference Architectures")).toBeVisible();
    expect(within(projectsNav).queryByText("Client B")).not.toBeInTheDocument();
    expect(screen.getByText("1 private project hidden")).toBeVisible();
    expect(library.setProjectVisibility).toHaveBeenCalledWith("Client A", true);

    await user.click(screen.getByRole("button", { name: "Stop presentation mode" }));
    expect(library.setProjectVisibility).toHaveBeenCalledTimes(1);
  });

  it("toggles presentation mode with H outside text entry and dialogs", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    library.projects = [
      { name: "Client A", designCount: 1, visibleInPresentationMode: false },
      { name: "Reference", designCount: 1, visibleInPresentationMode: true },
    ];
    library.selectedProject = "Client A";
    vi.mocked(useDesignLibrary).mockReturnValue(library);
    render(<LibraryView onOpenDesign={vi.fn()} />);

    await user.keyboard("h");
    expect(screen.getByRole("button", { name: "Stop presentation mode" })).toBeVisible();
    expect(screen.queryByText("Reference")).toBeVisible();
    expect(library.setProjectVisibility).toHaveBeenCalledWith("Client A", true);

    await user.keyboard("h");
    expect(screen.getByRole("button", { name: "Start presentation mode" })).toBeVisible();
    expect(library.setProjectVisibility).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("textbox", { name: "Filter designs" }));
    await user.keyboard("h");
    expect(screen.getByRole("button", { name: "Start presentation mode" })).toBeVisible();
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

    await user.click(screen.getByRole("button", { name: "New" }));
    await user.click(screen.getByRole("menuitem", { name: /Mermaid/ }));

    const dialog = screen.getByRole("dialog", {
      name: "Create Mermaid",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Mermaid name" }),
      "Routing",
    );
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(library.createDesign).toHaveBeenCalledWith("Routing", "mermaid"),
    );
    expect(onOpenDesign).toHaveBeenCalledWith("App", "Routing.mmd");
  });

  it("creates a rich text note in the selected project", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    const onOpenDesign = vi.fn();
    library.createDesign.mockResolvedValue({
      project: "App",
      name: "Meeting notes",
      fileName: "Meeting notes.bdnote",
      kind: "note",
      content: {
        type: "banguesesdraw-note",
        version: 1,
        content: { type: "doc", content: [] },
      },
    });
    vi.mocked(useDesignLibrary).mockReturnValue(library);

    render(<LibraryView onOpenDesign={onOpenDesign} />);

    await user.click(screen.getByRole("button", { name: "New" }));
    await user.click(screen.getByRole("menuitem", { name: /Note/ }));

    const dialog = screen.getByRole("dialog", {
      name: "Create Note",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Note name" }),
      "Meeting notes",
    );
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(library.createDesign).toHaveBeenCalledWith("Meeting notes", "note"),
    );
    expect(onOpenDesign).toHaveBeenCalledWith("App", "Meeting notes.bdnote");
  });

  it("opens create dialogs with keyboard shortcuts when not typing", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    vi.mocked(useDesignLibrary).mockReturnValue(library);

    const { rerender } = render(<LibraryView onOpenDesign={vi.fn()} />);

    await user.keyboard("1");
    expect(
      screen.getByRole("dialog", { name: "Create Note" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.keyboard("2");
    expect(
      screen.getByRole("dialog", { name: "Create Excalidraw" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.keyboard("3");
    expect(
      screen.getByRole("dialog", { name: "Create Mermaid" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");

    rerender(<LibraryView onOpenDesign={vi.fn()} />);
    await user.click(screen.getByRole("textbox", { name: "Filter designs" }));
    await user.keyboard("1");

    expect(
      screen.queryByRole("dialog", { name: "Create Note" }),
    ).not.toBeInTheDocument();
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
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            output_text: JSON.stringify({
              recommendedKind: "excalidraw",
              recommendedQuality: "balanced",
              recommendedBudget: "standard",
              expectedOutputTokenRange: "10k-20k",
              completionRisk: "medium",
              reason: "A simple auth flow works well as an Excalidraw diagram.",
              optimizedPrompt: "Draw a simple auth flow with compact labels.",
            }),
          }),
        } as Response)
        .mockResolvedValueOnce({
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
        } as Response),
    );

    render(<LibraryView onOpenDesign={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Settings" }));

    let dialog = screen.getByRole("dialog", { name: "Settings" });
    await user.type(
      within(dialog).getByLabelText("AI API key"),
      "sk-test",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Default model"),
      "gpt-5.4",
    );
    await user.click(within(dialog).getByLabelText("Enable Mermaid diagrams"));
    await user.click(within(dialog).getByRole("button", { name: "Save settings" }));

    await user.click(screen.getByRole("button", { name: "AI diagram" }));

    dialog = screen.getByRole("dialog", { name: "AI diagram" });
    expect(
      within(dialog).queryByRole("button", { name: "Mermaid" }),
    ).not.toBeInTheDocument();
    const designNameInput = within(dialog).getByLabelText("Design name");
    await user.clear(designNameInput);
    await user.type(designNameInput, "Generated Flow");
    await user.type(
      within(dialog).getByLabelText("Diagram description"),
      "Draw a simple auth flow",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Analyze prompt" }),
    );
    expect(await within(dialog).findByText("AI recommendation")).toBeVisible();
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

  it("chooses a backup folder and backs up the local library from settings", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    vi.mocked(useDesignLibrary).mockReturnValue(library);
    vi.mocked(open).mockResolvedValue("/Users/me/Google Drive/DesignBuddy Backup");

    const { designApi } = await import("../lib/designApi");
    vi.spyOn(designApi, "backupLibrary").mockResolvedValue({
      projectCount: 1,
      fileCount: 2,
    });

    render(<LibraryView onOpenDesign={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Settings" }));

    const dialog = screen.getByRole("dialog", { name: "Settings" });
    await user.click(within(dialog).getByRole("button", { name: "Choose backup folder" }));

    expect(open).toHaveBeenCalledWith({
      title: "Choose backup folder",
      directory: true,
      multiple: false,
    });
    expect(
      within(dialog).getByText("/Users/me/Google Drive/DesignBuddy Backup"),
    ).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: "Back up now" }));

    await waitFor(() =>
      expect(designApi.backupLibrary).toHaveBeenCalledWith(
        "/Users/me/Google Drive/DesignBuddy Backup",
      ),
    );
    expect(within(dialog).getByText("Backed up 2 files across 1 project.")).toBeVisible();
  });

  it("lets people select backup artifacts and choose a conflict resolution before restoring", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    vi.mocked(useDesignLibrary).mockReturnValue(library);
    vi.mocked(open).mockResolvedValue("/Users/me/DesignBuddy Backup");
    const { designApi } = await import("../lib/designApi");
    vi.spyOn(designApi, "scanBackup").mockResolvedValue({
      artifacts: [
        { project: "App", fileName: "Flow.excalidraw", kind: "excalidraw", conflictsWithExisting: true },
        { project: "App", fileName: "New.mmd", kind: "mermaid", conflictsWithExisting: false },
      ], invalidFileCount: 0,
    });
    vi.spyOn(designApi, "restoreBackup").mockResolvedValue({
      addedCount: 1, copiedCount: 0, replacedCount: 1, skippedCount: 0, invalidFileCount: 0,
    });
    render(<LibraryView onOpenDesign={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Restore from backup" }));
    const dialog = await screen.findByRole("dialog", { name: "Restore backup" });
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Resolution for Flow.excalidraw" }), "replace");
    await user.click(within(dialog).getByRole("button", { name: "Restore 2 selected" }));
    await waitFor(() => expect(designApi.restoreBackup).toHaveBeenCalledWith(
      "/Users/me/DesignBuddy Backup",
      [
        { project: "App", fileName: "Flow.excalidraw", conflictResolution: "replace" },
        { project: "App", fileName: "New.mmd", conflictResolution: "copy" },
      ],
    ));
    expect(library.refresh).toHaveBeenCalled();
  });

  it("allows cancelling a stuck AI generation request", async () => {
    const user = userEvent.setup();
    const library = makeLibraryState();
    vi.mocked(useDesignLibrary).mockReturnValue(library);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            output_text: JSON.stringify({
              recommendedKind: "excalidraw",
              recommendedQuality: "balanced",
              recommendedBudget: "standard",
              expectedOutputTokenRange: "10k-20k",
              completionRisk: "medium",
              reason: "This can be generated as a compact Excalidraw diagram.",
              optimizedPrompt: "Draw a Twilio routing flow with compact labels.",
            }),
          }),
        } as Response)
        .mockImplementationOnce(
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
    await user.click(
      within(dialog).getByRole("button", { name: "Analyze prompt" }),
    );
    expect(await within(dialog).findByText("AI recommendation")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Generate" }));

    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeEnabled();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(within(dialog).getByText("Generation cancelled.")).toBeVisible(),
    );
    expect(library.createDesign).not.toHaveBeenCalled();
  });
});
