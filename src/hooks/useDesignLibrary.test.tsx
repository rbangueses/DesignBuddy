import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDesignLibrary } from "./useDesignLibrary";

vi.mock("../lib/designApi", () => ({
  designApi: {
    listProjects: vi.fn(),
    listDesigns: vi.fn(),
    createProject: vi.fn(),
    renameProject: vi.fn(),
    duplicateProject: vi.fn(),
    deleteProject: vi.fn(),
    createDesign: vi.fn(),
    renameDesign: vi.fn(),
    duplicateDesign: vi.fn(),
    deleteDesign: vi.fn(),
  },
}));

const { designApi } = await import("../lib/designApi");

function deferredPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("useDesignLibrary", () => {
  beforeEach(() => {
    vi.mocked(designApi.listProjects).mockReset();
    vi.mocked(designApi.listDesigns).mockReset();
    vi.mocked(designApi.createProject).mockReset();
    vi.mocked(designApi.renameProject).mockReset();
    vi.mocked(designApi.duplicateProject).mockReset();
    vi.mocked(designApi.deleteProject).mockReset();
    vi.mocked(designApi.createDesign).mockReset();
    vi.mocked(designApi.renameDesign).mockReset();
    vi.mocked(designApi.duplicateDesign).mockReset();
    vi.mocked(designApi.deleteDesign).mockReset();
  });

  it("loads projects and designs for the selected project", async () => {
    vi.mocked(designApi.listProjects).mockResolvedValueOnce([
      { name: "App", designCount: 2 },
    ]);
    vi.mocked(designApi.listDesigns).mockResolvedValueOnce([
      {
        project: "App",
        name: "Flow",
        fileName: "Flow.excalidraw",
        updatedAtMs: 1,
      },
      {
        project: "App",
        name: "Board",
        fileName: "Board.excalidraw",
        updatedAtMs: 2,
      },
    ]);

    const { result } = renderHook(() => useDesignLibrary());

    await waitFor(() => expect(result.current.projects[0].name).toBe("App"));
    await waitFor(() => expect(result.current.designs).toHaveLength(2));

    expect(result.current.selectedProject).toBe("App");
    expect(result.current.designs[0].name).toBe("Flow");
    expect(designApi.listDesigns).toHaveBeenCalledWith("App");
  });

  it("treats reselecting the active project as a no-op", async () => {
    const appDesigns = [
      {
        project: "App",
        name: "Flow",
        fileName: "Flow.excalidraw",
        updatedAtMs: 1,
      },
    ];

    vi.mocked(designApi.listProjects).mockResolvedValueOnce([
      { name: "App", designCount: 1 },
    ]);
    vi.mocked(designApi.listDesigns).mockResolvedValueOnce(appDesigns);

    const { result } = renderHook(() => useDesignLibrary());

    await waitFor(() => expect(result.current.designs).toEqual(appDesigns));
    expect(result.current.isDesignsLoading).toBe(false);

    act(() => {
      result.current.setSelectedProject("App");
    });

    expect(result.current.isDesignsLoading).toBe(false);
    expect(result.current.designs).toEqual(appDesigns);
    expect(designApi.listDesigns).toHaveBeenCalledTimes(1);
  });

  it("filters designs by case-insensitive query", async () => {
    vi.mocked(designApi.listProjects).mockResolvedValueOnce([
      { name: "App", designCount: 2 },
    ]);
    vi.mocked(designApi.listDesigns).mockResolvedValueOnce([
      {
        project: "App",
        name: "Flow chart",
        fileName: "Flow.excalidraw",
        updatedAtMs: 1,
      },
      {
        project: "App",
        name: "Landing page",
        fileName: "Landing.excalidraw",
        updatedAtMs: 2,
      },
    ]);

    const { result } = renderHook(() => useDesignLibrary());

    await waitFor(() => expect(result.current.filteredDesigns).toHaveLength(2));

    act(() => {
      result.current.setFilter("flow");
    });

    expect(result.current.filteredDesigns).toEqual([
      {
        project: "App",
        name: "Flow chart",
        fileName: "Flow.excalidraw",
        updatedAtMs: 1,
      },
    ]);
  });

  it("creates a project, selects it, and creates designs within it", async () => {
    vi.mocked(designApi.listProjects)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ name: "Ideas", designCount: 0 }]);
    vi.mocked(designApi.listDesigns)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    vi.mocked(designApi.createProject).mockResolvedValueOnce({
      name: "Ideas",
      designCount: 0,
    });
    vi.mocked(designApi.createDesign).mockResolvedValueOnce({
      project: "Ideas",
      name: "Sketch",
      fileName: "Sketch.excalidraw",
      content: {
        type: "excalidraw",
        elements: [],
        appState: {},
        files: {},
      },
    });

    const { result } = renderHook(() => useDesignLibrary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createProject("Ideas");
    });

    expect(designApi.createProject).toHaveBeenCalledWith("Ideas");
    expect(result.current.selectedProject).toBe("Ideas");

    await act(async () => {
      await result.current.createDesign("Sketch");
    });

    expect(designApi.createDesign).toHaveBeenCalledWith("Ideas", "Sketch");
  });

  it("clears stale designs immediately and ignores late results from the previous project", async () => {
    const appDesignsRequest = deferredPromise<
      {
        project: string;
        name: string;
        fileName: string;
        updatedAtMs: number;
      }[]
    >();
    const siteDesignsRequest = deferredPromise<
      {
        project: string;
        name: string;
        fileName: string;
        updatedAtMs: number;
      }[]
    >();

    vi.mocked(designApi.listProjects).mockResolvedValueOnce([
      { name: "App", designCount: 1 },
      { name: "Site", designCount: 1 },
    ]);
    vi.mocked(designApi.listDesigns).mockImplementation((project: string) => {
      if (project === "App") {
        return appDesignsRequest.promise;
      }

      return siteDesignsRequest.promise;
    });

    const { result } = renderHook(() => useDesignLibrary());

    await waitFor(() => expect(result.current.selectedProject).toBe("App"));

    await act(async () => {
      result.current.setSelectedProject("Site");
    });

    expect(result.current.designs).toEqual([]);

    await act(async () => {
      appDesignsRequest.resolve([
        {
          project: "App",
          name: "Old flow",
          fileName: "Old-flow.excalidraw",
          updatedAtMs: 1,
        },
      ]);
      await appDesignsRequest.promise;
    });

    expect(result.current.designs).toEqual([]);

    await act(async () => {
      siteDesignsRequest.resolve([
        {
          project: "Site",
          name: "Landing",
          fileName: "Landing.excalidraw",
          updatedAtMs: 2,
        },
      ]);
      await siteDesignsRequest.promise;
    });

    await waitFor(() =>
      expect(result.current.designs).toEqual([
        {
          project: "Site",
          name: "Landing",
          fileName: "Landing.excalidraw",
          updatedAtMs: 2,
        },
      ]),
    );
  });

  it("surfaces async project creation failures in the hook error state", async () => {
    vi.mocked(designApi.listProjects).mockResolvedValueOnce([]);
    vi.mocked(designApi.createProject).mockRejectedValueOnce(
      new Error("Project already exists."),
    );

    const { result } = renderHook(() => useDesignLibrary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.createProject("Ideas")).rejects.toThrow(
        "Project already exists.",
      );
    });

    await waitFor(() =>
      expect(result.current.error).toBe("Project already exists."),
    );
  });
});
