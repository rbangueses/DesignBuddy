import { useEffect } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "./EditorView";

let editCount = 0;
let echoInitialDataOnRender = false;
let nextEditAppState: Record<string, unknown> | null = null;
const initialDataRenders: unknown[] = [];
const excalidrawPropsRenders: unknown[] = [];

vi.mock("@excalidraw/excalidraw", () => ({
  Excalidraw: ({
    initialData,
    onChange,
    aiEnabled,
  }: {
    initialData: { elements?: unknown[] };
    onChange: (
      elements: unknown[],
      appState: Record<string, unknown>,
      files: Record<string, unknown>,
    ) => void;
    aiEnabled?: boolean;
  }) => (
    function MockExcalidraw() {
      initialDataRenders.push(initialData);
      excalidrawPropsRenders.push({ aiEnabled });

      useEffect(() => {
        if (echoInitialDataOnRender) {
          onChange(initialData.elements ?? [], {}, {});
        }
      }, [initialData, onChange]);

      return (
        <div
          data-testid="mock-excalidraw-canvas"
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div>Mock Excalidraw ({initialData.elements?.length ?? 0})</div>
          <button
            type="button"
            onClick={() => {
              editCount += 1;
              onChange(
                [{ id: `changed-${editCount}` }],
                nextEditAppState ?? {
                  collaborators: new Map(),
                  viewBackgroundColor: "#fff",
                },
                {},
              );
            }}
          >
            Edit scene
          </button>
        </div>
      );
    }
  )(),
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => <span aria-hidden="true">arrow</span>,
  Bot: () => <span aria-hidden="true">bot</span>,
  ChevronDown: () => <span aria-hidden="true">chevron-down</span>,
  Copy: () => <span aria-hidden="true">copy</span>,
  FolderInput: () => <span aria-hidden="true">move</span>,
  Download: () => <span aria-hidden="true">download</span>,
  FileCode2: () => <span aria-hidden="true">file-code</span>,
  Pencil: () => <span aria-hidden="true">pencil</span>,
  Save: () => <span aria-hidden="true">save</span>,
  Shapes: () => <span aria-hidden="true">shapes</span>,
  StickyNote: () => <span aria-hidden="true">notes</span>,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
}));

vi.mock("../lib/designApi", () => ({
  designApi: {
    copyDesign: vi.fn(),
    duplicateDesign: vi.fn(),
    exportDrawio: vi.fn(),
    exportDesign: vi.fn(),
    listProjects: vi.fn(),
    moveDesign: vi.fn(),
    readDesign: vi.fn(),
    readDiagramNotes: vi.fn(),
    renameDesign: vi.fn(),
    writeDesign: vi.fn(),
    writeDiagramNotes: vi.fn(),
  },
}));

const { designApi } = await import("../lib/designApi");
const { save } = await import("@tauri-apps/plugin-dialog");

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("EditorView", () => {
  beforeEach(() => {
    editCount = 0;
    echoInitialDataOnRender = false;
    nextEditAppState = null;
    initialDataRenders.length = 0;
    excalidrawPropsRenders.length = 0;
    vi.mocked(designApi.readDesign).mockReset();
    vi.mocked(designApi.readDiagramNotes).mockReset();
    vi.mocked(designApi.renameDesign).mockReset();
    vi.mocked(designApi.duplicateDesign).mockReset();
    vi.mocked(designApi.copyDesign).mockReset();
    vi.mocked(designApi.exportDrawio).mockReset();
    vi.mocked(designApi.exportDesign).mockReset();
    vi.mocked(designApi.writeDesign).mockReset();
    vi.mocked(designApi.writeDiagramNotes).mockReset();
    vi.mocked(designApi.moveDesign).mockReset();
    vi.mocked(designApi.listProjects).mockReset();
    vi.mocked(designApi.listProjects).mockResolvedValue([{ name: "App", designCount: 1 }]);
    vi.mocked(designApi.readDiagramNotes).mockResolvedValue({ text: "" });
    vi.mocked(save).mockReset();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("flushes pending edits before leaving the editor", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: {
        type: "excalidraw",
        elements: [{ id: "changed" }],
        appState: { viewBackgroundColor: "#fff" },
        files: {},
      },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={onBack}
        onDesignMoved={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Edit scene" }));
    await user.click(screen.getByRole("button", { name: "Back to library" }));

    await waitFor(() => expect(designApi.writeDesign).toHaveBeenCalledTimes(1));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(designApi.writeDesign).toHaveBeenCalledWith(
      "App",
      "Flow.excalidraw",
      expect.objectContaining({
        type: "excalidraw",
        elements: [{ id: "changed-1" }],
        appState: { viewBackgroundColor: "#fff" },
      }),
    );
  });

  it("does not loop when Excalidraw echoes the loaded scene on render", async () => {
    echoInitialDataOnRender = true;

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    expect(await screen.findByText("Mock Excalidraw (0)")).toBeVisible();
    expect(designApi.writeDesign).not.toHaveBeenCalled();
  });

  it("does not feed live edits back into Excalidraw initialData", async () => {
    const user = userEvent.setup();

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Edit scene" }));

    await waitFor(() => expect(initialDataRenders.length).toBeGreaterThan(1));
    expect(new Set(initialDataRenders).size).toBe(1);
  });

  it("disables Excalidraw built-in AI tools inside the embedded editor", async () => {
    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await screen.findByText("Mock Excalidraw (0)");

    expect(excalidrawPropsRenders[excalidrawPropsRenders.length - 1]).toEqual({
      aiEnabled: false,
    });
  });

  it("toggles diagram notes with N only while the canvas has focus", async () => {
    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        initialScene={{ type: "excalidraw", elements: [], appState: {}, files: {} }}
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await screen.findByText("Mock Excalidraw (0)");
    fireEvent.keyDown(document.body, { key: "n" });

    const notes = await screen.findByRole("textbox", { name: "Diagram notes" });
    expect(notes).toBeVisible();

    fireEvent.keyDown(notes, { key: "n" });
    expect(notes).toBeVisible();

    fireEvent.keyDown(document.body, { key: "n" });
    expect(screen.queryByRole("textbox", { name: "Diagram notes" })).not.toBeInTheDocument();
  });

  it("stays in the editor and surfaces save errors when leaving with pending edits", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });
    vi.mocked(designApi.writeDesign).mockRejectedValue(new Error("Disk full"));

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={onBack}
        onDesignMoved={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Edit scene" }));
    await user.click(screen.getByRole("button", { name: "Back to library" }));

    await screen.findByText("Error: Disk full");
    expect(onBack).not.toHaveBeenCalled();
  });

  it("waits for an in-flight autosave before leaving without starting another write", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const deferred = createDeferred<{
      project: string;
      name: string;
      fileName: string;
      kind: "excalidraw";
      content: {
        type: "excalidraw";
        elements: unknown[];
        appState: Record<string, unknown>;
        files: Record<string, unknown>;
      };
    }>();

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });
    vi.mocked(designApi.writeDesign).mockReturnValue(deferred.promise);

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={onBack}
        onDesignMoved={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Edit scene" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const saveButton = screen.getByRole("button", { name: "Save" });
    const backButton = screen.getByRole("button", { name: "Back to library" });

    expect(designApi.writeDesign).toHaveBeenCalledTimes(1);
    expect(screen.getByText("saving")).toBeVisible();
    expect(saveButton).toBeDisabled();

    await user.click(backButton);

    expect(designApi.writeDesign).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve({
        project: "App",
        name: "Flow",
        fileName: "Flow.excalidraw",
        kind: "excalidraw",
        content: {
          type: "excalidraw",
          elements: [{ id: "changed" }],
          appState: { viewBackgroundColor: "#fff" },
          files: {},
        },
      });
      await Promise.resolve();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("waits for the queued follow-up save before leaving when newer edits exist", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const firstWrite = createDeferred<{
      project: string;
      name: string;
      fileName: string;
      kind: "excalidraw";
      content: {
        type: "excalidraw";
        elements: unknown[];
        appState: Record<string, unknown>;
        files: Record<string, unknown>;
      };
    }>();
    const secondWrite = createDeferred<{
      project: string;
      name: string;
      fileName: string;
      kind: "excalidraw";
      content: {
        type: "excalidraw";
        elements: unknown[];
        appState: Record<string, unknown>;
        files: Record<string, unknown>;
      };
    }>();

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });
    vi.mocked(designApi.writeDesign)
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={onBack}
        onDesignMoved={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Edit scene" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(designApi.writeDesign).toHaveBeenCalledTimes(1);
    expect(designApi.writeDesign).toHaveBeenNthCalledWith(
      1,
      "App",
      "Flow.excalidraw",
      expect.objectContaining({
        type: "excalidraw",
        elements: [{ id: "changed-1" }],
      }),
    );
    expect(screen.getByText("saving")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Edit scene" }));
    await user.click(screen.getByRole("button", { name: "Back to library" }));

    expect(onBack).not.toHaveBeenCalled();

    await act(async () => {
      firstWrite.resolve({
        project: "App",
        name: "Flow",
        fileName: "Flow.excalidraw",
        kind: "excalidraw",
        content: {
          type: "excalidraw",
          elements: [{ id: "changed-1" }],
          appState: { viewBackgroundColor: "#fff" },
          files: {},
        },
      });
      await Promise.resolve();
    });

    expect(designApi.writeDesign).toHaveBeenCalledTimes(2);
    expect(designApi.writeDesign).toHaveBeenNthCalledWith(
      2,
      "App",
      "Flow.excalidraw",
      expect.objectContaining({
        type: "excalidraw",
        elements: [{ id: "changed-2" }],
      }),
    );
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText("saving")).toBeVisible();

    await act(async () => {
      secondWrite.resolve({
        project: "App",
        name: "Flow",
        fileName: "Flow.excalidraw",
        kind: "excalidraw",
        content: {
          type: "excalidraw",
          elements: [{ id: "changed-2" }],
          appState: { viewBackgroundColor: "#fff" },
          files: {},
        },
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  });

  it("flushes edits before renaming and stays on the renamed design", async () => {
    const user = userEvent.setup();
    const onDesignMoved = vi.fn();

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: {
        type: "excalidraw",
        elements: [{ id: "changed-1" }],
        appState: { viewBackgroundColor: "#fff" },
        files: {},
      },
    });
    vi.mocked(designApi.renameDesign).mockResolvedValue({
      project: "App",
      name: "Renamed",
      fileName: "Renamed.excalidraw",
      kind: "excalidraw",
      updatedAtMs: 2,
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={onDesignMoved}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Edit scene" }));
    await user.click(screen.getByRole("button", { name: "Rename design" }));

    const dialog = screen.getByRole("dialog", { name: "Rename design" });
    const nameInput = screen.getByRole("textbox", { name: "Design name" });
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed");
    await user.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() =>
      expect(designApi.renameDesign).toHaveBeenCalledWith(
        "App",
        "Flow.excalidraw",
        "Renamed",
      ),
    );
    expect(designApi.writeDesign).toHaveBeenCalledWith(
      "App",
      "Flow.excalidraw",
      expect.objectContaining({ elements: [{ id: "changed-1" }] }),
    );
    expect(onDesignMoved).toHaveBeenCalledWith(
      "App",
      "Renamed.excalidraw",
      expect.objectContaining({ elements: [{ id: "changed-1" }] }),
    );
    expect(dialog).not.toBeInTheDocument();
  });

  it("duplicates the current design from the editor and opens the duplicate", async () => {
    const user = userEvent.setup();
    const onDesignMoved = vi.fn();

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });
    vi.mocked(designApi.duplicateDesign).mockResolvedValue({
      project: "App",
      name: "Flow Copy",
      fileName: "Flow Copy.excalidraw",
      kind: "excalidraw",
      updatedAtMs: 2,
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={onDesignMoved}
      />,
    );

    await screen.findByText("Mock Excalidraw (0)");
    await user.click(screen.getByRole("button", { name: "Duplicate design" }));

    const dialog = screen.getByRole("dialog", { name: "Duplicate design" });
    const nameInput = screen.getByRole("textbox", { name: "Design name" });
    await user.clear(nameInput);
    await user.type(nameInput, "Flow Copy");
    await user.click(screen.getByRole("button", { name: "Duplicate" }));

    await waitFor(() =>
      expect(designApi.duplicateDesign).toHaveBeenCalledWith(
        "App",
        "Flow.excalidraw",
        "Flow Copy",
      ),
    );
    expect(onDesignMoved).toHaveBeenCalledWith(
      "App",
      "Flow Copy.excalidraw",
      expect.objectContaining({ type: "excalidraw" }),
    );
    expect(dialog).not.toBeInTheDocument();
  });

  it("exports the current scene as a draw.io file", async () => {
    const user = userEvent.setup();

    vi.mocked(save).mockResolvedValue("/tmp/Flow.drawio");
    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: {
        type: "excalidraw",
        elements: [
          {
            id: "box-1",
            type: "rectangle",
            x: 10,
            y: 20,
            width: 120,
            height: 60,
            text: "Start",
          },
        ],
        appState: {},
        files: {},
      },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await screen.findByText("Mock Excalidraw (1)");
    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("menuitem", { name: /draw\.io file/i }));

    await waitFor(() =>
      expect(designApi.exportDrawio).toHaveBeenCalledWith(
        "/tmp/Flow.drawio",
        expect.stringContaining("<mxfile"),
      ),
    );
    expect(save).toHaveBeenCalledWith({
      title: "Export draw.io",
      defaultPath: "Flow.drawio",
      filters: [{ name: "draw.io", extensions: ["drawio"] }],
    });
  });

  it("modifies the current design with AI and saves the returned scene", async () => {
    const user = userEvent.setup();

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: {
        type: "excalidraw",
        elements: [{ id: "original" }],
        appState: {},
        files: {},
      },
    });
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: {
        type: "excalidraw",
        elements: [{ id: "modified" }],
        appState: {},
        files: {},
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            type: "excalidraw",
            version: 2,
            source: "openai",
            elements: [{ id: "modified" }],
            appState: {},
            files: {},
          }),
        }),
      }),
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

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    expect(await screen.findByText("Mock Excalidraw (1)")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "AI modify" }));

    const dialog = screen.getByRole("dialog", { name: "AI modify" });
    await user.type(
      screen.getByRole("textbox", { name: "Modification request" }),
      "Add an observability box",
    );
    await user.click(screen.getByRole("button", { name: "Modify" }));
    await user.click(screen.getByRole("button", { name: "Modify anyway" }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());

    const lastInitialData = initialDataRenders[
      initialDataRenders.length - 1
    ] as { elements?: unknown[] };
    expect(lastInitialData.elements).toEqual([{ id: "modified" }]);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(designApi.writeDesign).toHaveBeenCalledWith(
        "App",
        "Flow.excalidraw",
        expect.objectContaining({
          elements: [{ id: "modified" }],
        }),
      ),
    );
  });

  it("inserts Twilio architecture components into the current design", async () => {
    const user = userEvent.setup();

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    expect(await screen.findByText("Mock Excalidraw (0)")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Twilio components" }));
    await user.click(screen.getByRole("button", { name: "Insert Twilio Orchestrator" }));

    expect(await screen.findByText("Mock Excalidraw (2)")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(designApi.writeDesign).toHaveBeenCalledWith(
        "App",
        "Flow.excalidraw",
        expect.objectContaining({
          elements: expect.arrayContaining([
            expect.objectContaining({ text: "Twilio Orchestrator" }),
          ]),
        }),
      ),
    );
  });

  it("shows Twilio components grouped by product area", async () => {
    const user = userEvent.setup();

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    expect(await screen.findByText("Mock Excalidraw (0)")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Twilio components" }));

    expect(screen.getByRole("heading", { name: "Communications" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Trust & Identity" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Conversations Suite" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Builder Tools" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Data" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Insert Email API" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Insert Twilio" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Insert Sync" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Insert Segment CDP" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Insert Knowledge" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Insert Event Streams" })).toBeVisible();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual([
      "Communications",
      "Conversations Suite",
      "Data",
      "Trust & Identity",
      "Builder Tools",
    ]);
  });

  it("uses the chosen default font for a newly inserted component", async () => {
    const user = userEvent.setup();
    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await screen.findByText("Mock Excalidraw (0)");
    await user.click(screen.getByRole("button", { name: "Twilio components" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Default component font" }),
      "7",
    );
    await user.click(screen.getByRole("button", { name: "Insert Twilio" }));

    const lastInitialData = initialDataRenders[
      initialDataRenders.length - 1
    ] as { elements?: Array<Record<string, unknown>> };
    expect(lastInitialData.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text", text: "Twilio", fontFamily: 7 }),
      ]),
    );
  });

  it("opens the Twilio component palette with the section shortcut", async () => {
    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await screen.findByText("Mock Excalidraw (0)");
    fireEvent.keyDown(window, { key: "§" });

    expect(screen.getByRole("dialog", { name: "Twilio components" })).toBeVisible();
  });

  it("inserts a component with its binding while the palette is open", async () => {
    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await screen.findByText("Mock Excalidraw (0)");
    fireEvent.keyDown(window, { key: "§" });
    fireEvent.keyDown(window, { key: "v" });

    expect(await screen.findByText("Mock Excalidraw (2)")).toBeVisible();
  });

  it("uses palette bindings even when Excalidraw already handled the key event", async () => {
    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await screen.findByText("Mock Excalidraw (0)");
    fireEvent.keyDown(window, { key: "§" });
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "v",
    });
    event.preventDefault();
    window.dispatchEvent(event);

    expect(await screen.findByText("Mock Excalidraw (2)")).toBeVisible();
  });

  it("inserts a component directly on the canvas with Shift plus its binding", async () => {
    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await screen.findByText("Mock Excalidraw (0)");
    fireEvent.keyDown(window, { key: "V", shiftKey: true });

    expect(await screen.findByText("Mock Excalidraw (2)")).toBeVisible();
  });

  it("does not insert a component when Shift is pressed on its own", async () => {
    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await screen.findByText("Mock Excalidraw (0)");
    fireEvent.keyDown(window, { key: "Shift", shiftKey: true });

    expect(screen.getByText("Mock Excalidraw (0)")).toBeVisible();
  });

  it("explains the Shift shortcut for direct canvas insertion", async () => {
    const user = userEvent.setup();
    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await screen.findByText("Mock Excalidraw (0)");
    await user.click(screen.getByRole("button", { name: "Twilio components" }));
    expect(
      screen.getByText(/From the canvas, press Shift plus the key badge/),
    ).toBeVisible();
  });

  it("discards unsaved shortcut edits when the palette is cancelled", async () => {
    const user = userEvent.setup();
    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await screen.findByText("Mock Excalidraw (0)");
    await user.click(screen.getByRole("button", { name: "Twilio components" }));
    await user.click(screen.getByRole("button", { name: "Customize shortcuts" }));
    const voiceShortcut = screen.getByLabelText("Shortcut for Prog. Voice");
    await user.clear(voiceShortcut);
    await user.type(voiceShortcut, "z");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Twilio components" }));
    await user.click(screen.getByRole("button", { name: "Customize shortcuts" }));

    expect(screen.getByLabelText("Shortcut for Prog. Voice")).toHaveValue("V");
  });

  it("closes the Twilio components dialog when Escape is pressed", async () => {
    const user = userEvent.setup();

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    expect(await screen.findByText("Mock Excalidraw (0)")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Twilio components" }));
    const dialog = screen.getByRole("dialog", { name: "Twilio components" });

    await user.keyboard("{Escape}");

    expect(dialog).not.toBeInTheDocument();
  });

  it("closes the Twilio components dialog when the canvas consumes bubbling key events", async () => {
    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await screen.findByText("Mock Excalidraw (0)");
    const canvas = screen.getByTestId("mock-excalidraw-canvas");

    fireEvent.keyDown(canvas, { key: "§" });
    expect(screen.getByRole("dialog", { name: "Twilio components" })).toBeVisible();

    fireEvent.keyDown(canvas, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Twilio components" })).not.toBeInTheDocument();
  });

  it("inserts Twilio architecture components near the visible canvas center", async () => {
    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        initialScene={{
          type: "excalidraw",
          elements: [],
          appState: {
            width: 1000,
            height: 800,
            offsetLeft: 0,
            offsetTop: 0,
            scrollX: -400,
            scrollY: -300,
            zoom: { value: 2 },
          },
          files: {},
        }}
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await screen.findByText("Mock Excalidraw (0)");
    fireEvent.keyDown(window, { key: "O", shiftKey: true });

    const lastInitialData = initialDataRenders[
      initialDataRenders.length - 1
    ] as { elements?: Array<Record<string, unknown>> };
    const insertedBox = lastInitialData.elements?.find(
      (element) => element.type === "rectangle",
    );

    expect(insertedBox).toEqual(
      expect.objectContaining({
        x: 535,
        y: 457,
      }),
    );
  });

  it("inserts a Twilio component at the last canvas pointer position", async () => {
    const user = userEvent.setup();
    nextEditAppState = {
      collaborators: new Map(),
      viewBackgroundColor: "#fff",
      width: 1000,
      height: 800,
      offsetLeft: 10,
      offsetTop: 20,
      scrollX: -100,
      scrollY: 50,
      zoom: { value: 2 },
    };

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Edit scene" }));
    const canvas = document.querySelector(".canvas-wrap");
    expect(canvas).not.toBeNull();
    fireEvent.mouseMove(canvas as HTMLElement, { clientX: 410, clientY: 280 });
    fireEvent.keyDown(window, { key: "V", shiftKey: true });

    const lastInitialData = initialDataRenders[
      initialDataRenders.length - 1
    ] as { elements?: Array<Record<string, unknown>> };
    const insertedBox = lastInitialData.elements?.find(
      (element) => element.type === "rectangle",
    );

    expect(insertedBox).toEqual(
      expect.objectContaining({
        x: 185,
        y: 37,
      }),
    );
  });

  it("flushes pending edits before exporting from the editor", async () => {
    const user = userEvent.setup();

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: {
        type: "excalidraw",
        elements: [{ id: "changed-1" }],
        appState: { viewBackgroundColor: "#fff" },
        files: {},
      },
    });
    vi.mocked(save).mockResolvedValue("/tmp/Flow.excalidraw");
    vi.mocked(designApi.exportDesign).mockResolvedValue(undefined);

    render(
      <EditorView
        project="App"
        fileName="Flow.excalidraw"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Edit scene" }));
    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("menuitem", { name: /Excalidraw file/i }));

    await waitFor(() =>
      expect(designApi.exportDesign).toHaveBeenCalledWith(
        "App",
        "Flow.excalidraw",
        "/tmp/Flow.excalidraw",
      ),
    );
    expect(designApi.writeDesign).toHaveBeenCalledWith(
      "App",
      "Flow.excalidraw",
      expect.objectContaining({ elements: [{ id: "changed-1" }] }),
    );
    expect(save).toHaveBeenCalledWith({
      title: "Export design",
      defaultPath: "Flow.excalidraw",
      filters: [{ name: "Excalidraw", extensions: ["excalidraw"] }],
    });
  });
});
