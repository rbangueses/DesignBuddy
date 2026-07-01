import { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
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
        <div>
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
  Copy: () => <span aria-hidden="true">copy</span>,
  Download: () => <span aria-hidden="true">download</span>,
  Pencil: () => <span aria-hidden="true">pencil</span>,
  Save: () => <span aria-hidden="true">save</span>,
  Shapes: () => <span aria-hidden="true">shapes</span>,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
}));

vi.mock("../lib/designApi", () => ({
  designApi: {
    duplicateDesign: vi.fn(),
    exportDesign: vi.fn(),
    readDesign: vi.fn(),
    renameDesign: vi.fn(),
    writeDesign: vi.fn(),
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
    vi.mocked(designApi.renameDesign).mockReset();
    vi.mocked(designApi.duplicateDesign).mockReset();
    vi.mocked(designApi.exportDesign).mockReset();
    vi.mocked(designApi.writeDesign).mockReset();
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

    expect(screen.getByRole("heading", { name: "Channels" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Trust & Identity" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Conversations Suite" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Contact Center" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Compute & Integrations" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Segment Stack" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Insert Email API" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Insert Segment CDP" })).toBeVisible();
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

  it("inserts Twilio architecture components near the visible canvas center", async () => {
    const user = userEvent.setup();
    nextEditAppState = {
      collaborators: new Map(),
      viewBackgroundColor: "#fff",
      width: 1000,
      height: 800,
      offsetLeft: 0,
      offsetTop: 0,
      scrollX: -400,
      scrollY: -300,
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
    await user.click(screen.getByRole("button", { name: "Twilio components" }));
    await user.click(screen.getByRole("button", { name: "Insert Twilio Orchestrator" }));

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
    await user.click(screen.getByRole("button", { name: "Export design" }));

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
