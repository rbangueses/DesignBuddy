import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExcalidrawScene } from "../types/excalidraw";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

describe("designApi", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("calls list_projects", async () => {
    invoke.mockResolvedValueOnce([{ name: "App", designCount: 2 }]);
    const { designApi } = await import("./designApi");

    await expect(designApi.listProjects()).resolves.toEqual([
      { name: "App", designCount: 2 },
    ]);
    expect(invoke).toHaveBeenCalledWith("list_projects");
  });

  it("calls write_design with scene content", async () => {
    const scene: ExcalidrawScene = {
      type: "excalidraw",
      elements: [],
      appState: {},
      files: {},
    };
    invoke.mockResolvedValueOnce({
      project: "App",
      name: "Sketch",
      fileName: "Sketch.excalidraw",
      content: scene,
    });
    const { designApi } = await import("./designApi");

    await designApi.writeDesign("App", "Sketch.excalidraw", scene);

    expect(invoke).toHaveBeenCalledWith("write_design", {
      project: "App",
      fileName: "Sketch.excalidraw",
      content: scene,
    });
  });
});
