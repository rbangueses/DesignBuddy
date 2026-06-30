import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "./EditorView";

let editCount = 0;

vi.mock("@excalidraw/excalidraw", () => ({
  Excalidraw: ({
    initialData,
    onChange,
  }: {
    initialData: { elements?: unknown[] };
    onChange: (
      elements: unknown[],
      appState: Record<string, unknown>,
      files: Record<string, unknown>,
    ) => void;
  }) => (
    <div>
      <div>Mock Excalidraw ({initialData.elements?.length ?? 0})</div>
      <button
        type="button"
        onClick={() => {
          editCount += 1;
          onChange(
            [{ id: `changed-${editCount}` }],
            { viewBackgroundColor: "#fff" },
            {},
          );
        }}
      >
        Edit scene
      </button>
    </div>
  ),
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => <span aria-hidden="true">arrow</span>,
  Copy: () => <span aria-hidden="true">copy</span>,
  Pencil: () => <span aria-hidden="true">pencil</span>,
  Save: () => <span aria-hidden="true">save</span>,
}));

vi.mock("../lib/designApi", () => ({
  designApi: {
    duplicateDesign: vi.fn(),
    readDesign: vi.fn(),
    renameDesign: vi.fn(),
    writeDesign: vi.fn(),
  },
}));

const { designApi } = await import("../lib/designApi");

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
    vi.mocked(designApi.readDesign).mockReset();
    vi.mocked(designApi.renameDesign).mockReset();
    vi.mocked(designApi.duplicateDesign).mockReset();
    vi.mocked(designApi.writeDesign).mockReset();
  });

  it("flushes pending edits before leaving the editor", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
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
      }),
    );
  });

  it("stays in the editor and surfaces save errors when leaving with pending edits", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
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
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
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
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });
    vi.mocked(designApi.duplicateDesign).mockResolvedValue({
      project: "App",
      name: "Flow Copy",
      fileName: "Flow Copy.excalidraw",
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
});
