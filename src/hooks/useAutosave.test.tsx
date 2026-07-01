import { act, renderHook } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "./useAutosave";

vi.useFakeTimers();

vi.mock("../lib/designApi", () => ({
  designApi: {
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

describe("useAutosave", () => {
  beforeEach(() => {
    vi.mocked(designApi.writeDesign).mockReset();
  });

  it("debounces writes and reports saved", async () => {
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    const { rerender, result } = renderHook(
      ({ scene }) =>
        useAutosave({
          project: "App",
          fileName: "Flow.excalidraw",
          scene,
          enabled: true,
        }),
      {
        initialProps: {
          scene: {
            type: "excalidraw" as const,
            elements: [] as unknown[],
            appState: {},
            files: {},
          },
        },
      },
    );

    rerender({
      scene: {
        type: "excalidraw" as const,
        elements: [{ id: "a" }] as unknown[],
        appState: {},
        files: {},
      },
    });

    expect(result.current.status).toBe("unsaved");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    expect(result.current.status).toBe("saved");
    expect(designApi.writeDesign).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending autosave when saved manually", async () => {
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });

    const { rerender, result } = renderHook(
      ({ scene }) =>
        useAutosave({
          project: "App",
          fileName: "Flow.excalidraw",
          scene,
          enabled: true,
        }),
      {
        initialProps: {
          scene: {
            type: "excalidraw" as const,
            elements: [] as unknown[],
            appState: {},
            files: {},
          },
        },
      },
    );

    const updatedScene = {
      type: "excalidraw" as const,
      elements: [{ id: "a" }] as unknown[],
      appState: {},
      files: {},
    };

    rerender({ scene: updatedScene });

    expect(result.current.status).toBe("unsaved");

    await act(async () => {
      await result.current.saveNow();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    expect(designApi.writeDesign).toHaveBeenCalledTimes(1);
    expect(designApi.writeDesign).toHaveBeenCalledWith(
      "App",
      "Flow.excalidraw",
      updatedScene,
    );
  });

  it("does not duplicate writes when saveNow is called while saving", async () => {
    const deferred = createDeferred<{
      project: string;
      name: string;
      fileName: string;
      kind: "excalidraw";
      content: { type: "excalidraw"; elements: unknown[]; appState: {}; files: {} };
    }>();

    vi.mocked(designApi.writeDesign).mockReturnValue(deferred.promise);

    const { rerender, result } = renderHook(
      ({ scene }) =>
        useAutosave({
          project: "App",
          fileName: "Flow.excalidraw",
          scene,
          enabled: true,
        }),
      {
        initialProps: {
          scene: {
            type: "excalidraw" as const,
            elements: [] as unknown[],
            appState: {},
            files: {},
          },
        },
      },
    );

    const updatedScene = {
      type: "excalidraw" as const,
      elements: [{ id: "a" }] as unknown[],
      appState: {},
      files: {},
    };

    rerender({ scene: updatedScene });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    expect(result.current.status).toBe("saving");
    expect(designApi.writeDesign).toHaveBeenCalledTimes(1);

    let manualSaveResult: Promise<boolean> | undefined;

    await act(async () => {
      manualSaveResult = result.current.saveNow();
      await Promise.resolve();
    });

    expect(designApi.writeDesign).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("saving");

    deferred.resolve({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      kind: "excalidraw",
      content: { type: "excalidraw", elements: [{ id: "a" }], appState: {}, files: {} },
    });

    await act(async () => {
      await manualSaveResult;
    });

    expect(result.current.status).toBe("saved");
  });

  it("queues the latest scene when edits land during an in-flight save", async () => {
    const firstWrite = createDeferred<{
      project: string;
      name: string;
      fileName: string;
      kind: "excalidraw";
      content: { type: "excalidraw"; elements: unknown[]; appState: {}; files: {} };
    }>();
    const secondWrite = createDeferred<{
      project: string;
      name: string;
      fileName: string;
      kind: "excalidraw";
      content: { type: "excalidraw"; elements: unknown[]; appState: {}; files: {} };
    }>();

    vi.mocked(designApi.writeDesign)
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);

    const { rerender, result } = renderHook(
      ({ scene }) =>
        useAutosave({
          project: "App",
          fileName: "Flow.excalidraw",
          scene,
          enabled: true,
        }),
      {
        initialProps: {
          scene: {
            type: "excalidraw" as const,
            elements: [] as unknown[],
            appState: {},
            files: {},
          },
        },
      },
    );

    const sceneA = {
      type: "excalidraw" as const,
      elements: [{ id: "a" }] as unknown[],
      appState: {},
      files: {},
    };

    rerender({ scene: sceneA });

    let saveResult: Promise<boolean> | undefined;

    await act(async () => {
      saveResult = result.current.saveNow();
      await Promise.resolve();
    });

    expect(designApi.writeDesign).toHaveBeenCalledTimes(1);
    expect(designApi.writeDesign).toHaveBeenNthCalledWith(
      1,
      "App",
      "Flow.excalidraw",
      sceneA,
    );
    expect(result.current.status).toBe("saving");

    const sceneB = {
      type: "excalidraw" as const,
      elements: [{ id: "b" }] as unknown[],
      appState: {},
      files: {},
    };

    rerender({ scene: sceneB });

    expect(result.current.status).toBe("saving");

    await act(async () => {
      firstWrite.resolve({
        project: "App",
        name: "Flow",
        fileName: "Flow.excalidraw",
        kind: "excalidraw",
        content: sceneA,
      });
      await Promise.resolve();
    });

    expect(designApi.writeDesign).toHaveBeenCalledTimes(2);
    expect(designApi.writeDesign).toHaveBeenNthCalledWith(
      2,
      "App",
      "Flow.excalidraw",
      sceneB,
    );
    expect(result.current.status).toBe("saving");

    await act(async () => {
      secondWrite.resolve({
        project: "App",
        name: "Flow",
        fileName: "Flow.excalidraw",
        kind: "excalidraw",
        content: sceneB,
      });
      await saveResult;
    });

    expect(result.current.status).toBe("saved");
  });

  afterAll(() => {
    vi.useRealTimers();
  });
});
