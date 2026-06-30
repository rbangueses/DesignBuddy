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

describe("useAutosave", () => {
  beforeEach(() => {
    vi.mocked(designApi.writeDesign).mockReset();
  });

  it("debounces writes and reports saved", async () => {
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
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

  afterAll(() => {
    vi.useRealTimers();
  });
});
