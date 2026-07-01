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
    importDesign: vi.fn(),
    exportDesign: vi.fn(),
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
    vi.mocked(designApi.importDesign).mockReset();
    vi.mocked(designApi.exportDesign).mockReset();
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
        kind: "excalidraw",
        updatedAtMs: 1,
      },
      {
        project: "App",
        name: "Board",
        fileName: "Board.excalidraw",
        kind: "excalidraw",
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
        kind: "excalidraw" as const,
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
        kind: "excalidraw",
        updatedAtMs: 1,
      },
      {
        project: "App",
        name: "Landing page",
        fileName: "Landing.excalidraw",
        kind: "excalidraw",
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
        kind: "excalidraw",
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
      kind: "excalidraw",
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

    expect(designApi.createDesign).toHaveBeenCalledWith(
      "Ideas",
      "Sketch",
      "excalidraw",
    );
  });

  it("creates a Mermaid design in the selected project", async () => {
    vi.mocked(designApi.listProjects).mockResolvedValue([{ name: "Docs", designCount: 0 }]);
    vi.mocked(designApi.listDesigns).mockResolvedValue([]);
    vi.mocked(designApi.createDesign).mockResolvedValue({
      project: "Docs",
      name: "Routing",
      fileName: "Routing.mmd",
      kind: "mermaid",
      content: { source: "flowchart LR\n" },
    });

    const { result } = renderHook(() => useDesignLibrary());
    await waitFor(() => expect(result.current.selectedProject).toBe("Docs"));

    await act(async () => {
      await result.current.createDesign("Routing", "mermaid");
    });

    expect(designApi.createDesign).toHaveBeenCalledWith(
      "Docs",
      "Routing",
      "mermaid",
    );
  });

  it("clears stale designs and marks loading when createProject switches to a new project", async () => {
    const refreshedProjectsRequest = deferredPromise<
      { name: string; designCount: number }[]
    >();
    const ideasDesignsRequest = deferredPromise<
      {
        project: string;
        name: string;
        fileName: string;
        kind: "excalidraw" | "mermaid";
        updatedAtMs: number;
      }[]
    >();

    vi.mocked(designApi.listProjects)
      .mockResolvedValueOnce([{ name: "App", designCount: 1 }])
      .mockImplementationOnce(() => refreshedProjectsRequest.promise);
    vi.mocked(designApi.listDesigns).mockImplementation((project: string) => {
      if (project === "Ideas") {
        return ideasDesignsRequest.promise;
      }

      return Promise.resolve([
        {
          project: "App",
        name: "Flow",
        fileName: "Flow.excalidraw",
        kind: "excalidraw",
        updatedAtMs: 1,
      },
      ]);
    });
    vi.mocked(designApi.createProject).mockResolvedValueOnce({
      name: "Ideas",
      designCount: 0,
    });

    const { result } = renderHook(() => useDesignLibrary());

    await waitFor(() =>
      expect(result.current.designs).toEqual([
        {
          project: "App",
          name: "Flow",
          fileName: "Flow.excalidraw",
          kind: "excalidraw",
          updatedAtMs: 1,
        },
      ]),
    );

    let createProjectPromise!: Promise<unknown>;

    act(() => {
      createProjectPromise = result.current.createProject("Ideas");
    });

    await waitFor(() => expect(result.current.selectedProject).toBe("Ideas"));
    expect(result.current.designs).toEqual([]);
    expect(result.current.isDesignsLoading).toBe(true);

    await act(async () => {
      refreshedProjectsRequest.resolve([
        { name: "App", designCount: 1 },
        { name: "Ideas", designCount: 0 },
      ]);
      await createProjectPromise;
    });

    await act(async () => {
      ideasDesignsRequest.resolve([
        {
          project: "Ideas",
          name: "Sketch",
          fileName: "Sketch.excalidraw",
          kind: "excalidraw",
          updatedAtMs: 2,
        },
      ]);
      await ideasDesignsRequest.promise;
    });

    await waitFor(() =>
      expect(result.current.designs).toEqual([
        {
          project: "Ideas",
          name: "Sketch",
          fileName: "Sketch.excalidraw",
          kind: "excalidraw",
          updatedAtMs: 2,
        },
      ]),
    );
  });

  it("clears stale designs immediately and ignores late results from the previous project", async () => {
    const appDesignsRequest = deferredPromise<
      {
        project: string;
        name: string;
        fileName: string;
        kind: "excalidraw" | "mermaid";
        updatedAtMs: number;
      }[]
    >();
    const siteDesignsRequest = deferredPromise<
      {
        project: string;
        name: string;
        fileName: string;
        kind: "excalidraw" | "mermaid";
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
          kind: "excalidraw",
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
          kind: "excalidraw",
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
          kind: "excalidraw",
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

  it("duplicates and deletes designs through the API", async () => {
    vi.mocked(designApi.listProjects).mockResolvedValue([{ name: "App", designCount: 1 }]);
    vi.mocked(designApi.listDesigns).mockResolvedValue([
      {
        project: "App",
        name: "Flow",
        fileName: "Flow.excalidraw",
        kind: "excalidraw",
        updatedAtMs: 1,
      },
    ]);
    vi.mocked(designApi.duplicateDesign).mockResolvedValue({
      project: "App",
      name: "Flow Copy",
      fileName: "Flow Copy.excalidraw",
      kind: "excalidraw",
      updatedAtMs: 2,
    });
    vi.mocked(designApi.deleteDesign).mockResolvedValue();

    const { result } = renderHook(() => useDesignLibrary());
    await waitFor(() => expect(result.current.selectedProject).toBe("App"));

    await act(async () => {
      await result.current.duplicateDesign("Flow.excalidraw", "Flow Copy");
      await result.current.deleteDesign("Flow.excalidraw");
    });

    expect(designApi.duplicateDesign).toHaveBeenCalledWith(
      "App",
      "Flow.excalidraw",
      "Flow Copy",
    );
    expect(designApi.deleteDesign).toHaveBeenCalledWith("App", "Flow.excalidraw");
  });

  it("imports and exports designs through the selected project", async () => {
    vi.mocked(designApi.listProjects).mockResolvedValue([{ name: "App", designCount: 1 }]);
    vi.mocked(designApi.listDesigns).mockResolvedValue([
      {
        project: "App",
        name: "Flow",
        fileName: "Flow.excalidraw",
        kind: "excalidraw",
        updatedAtMs: 1,
      },
    ]);
    vi.mocked(designApi.importDesign).mockResolvedValue({
      project: "App",
      name: "Imported",
      fileName: "Imported.excalidraw",
      kind: "excalidraw",
      updatedAtMs: 2,
    });
    vi.mocked(designApi.exportDesign).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDesignLibrary());
    await waitFor(() => expect(result.current.selectedProject).toBe("App"));

    await act(async () => {
      await result.current.importDesign("/tmp/Imported.excalidraw");
      await result.current.exportDesign("Flow.excalidraw", "/tmp/Flow.excalidraw");
    });

    expect(designApi.importDesign).toHaveBeenCalledWith(
      "App",
      "/tmp/Imported.excalidraw",
    );
    expect(designApi.exportDesign).toHaveBeenCalledWith(
      "App",
      "Flow.excalidraw",
      "/tmp/Flow.excalidraw",
    );
  });

  it("selects the duplicated project after the API succeeds", async () => {
    vi.mocked(designApi.listProjects)
      .mockResolvedValueOnce([{ name: "App", designCount: 1 }])
      .mockResolvedValueOnce([
        { name: "App", designCount: 1 },
        { name: "App Copy", designCount: 1 },
      ]);
    vi.mocked(designApi.listDesigns).mockResolvedValue([]);
    vi.mocked(designApi.duplicateProject).mockResolvedValue({
      name: "App Copy",
      designCount: 1,
    });

    const { result } = renderHook(() => useDesignLibrary());

    await waitFor(() => expect(result.current.selectedProject).toBe("App"));

    await act(async () => {
      await result.current.duplicateProject("App", "App Copy");
    });

    expect(designApi.duplicateProject).toHaveBeenCalledWith("App", "App Copy");
    await waitFor(() => expect(result.current.selectedProject).toBe("App Copy"));
  });

  it("preserves the selected project when deleting a different project", async () => {
    vi.mocked(designApi.listProjects)
      .mockResolvedValueOnce([
        { name: "A", designCount: 0 },
        { name: "B", designCount: 0 },
        { name: "C", designCount: 0 },
      ])
      .mockResolvedValueOnce([
        { name: "A", designCount: 0 },
        { name: "C", designCount: 0 },
      ]);
    vi.mocked(designApi.listDesigns).mockResolvedValue([]);
    vi.mocked(designApi.deleteProject).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDesignLibrary());

    await waitFor(() => expect(result.current.selectedProject).toBe("A"));

    act(() => {
      result.current.setSelectedProject("C");
    });

    await waitFor(() => expect(result.current.selectedProject).toBe("C"));

    await act(async () => {
      await result.current.deleteProject("B");
    });

    expect(designApi.deleteProject).toHaveBeenCalledWith("B");
    await waitFor(() => expect(result.current.selectedProject).toBe("C"));
  });

  it("clears stale designs and marks loading when refresh reselects a different project", async () => {
    const siteDesignsRequest = deferredPromise<
      {
        project: string;
        name: string;
        fileName: string;
        kind: "excalidraw" | "mermaid";
        updatedAtMs: number;
      }[]
    >();

    vi.mocked(designApi.listProjects)
      .mockResolvedValueOnce([{ name: "App", designCount: 1 }])
      .mockResolvedValueOnce([{ name: "Site", designCount: 1 }]);
    vi.mocked(designApi.listDesigns).mockImplementation((project: string) => {
      if (project === "Site") {
        return siteDesignsRequest.promise;
      }

      return Promise.resolve([
        {
          project: "App",
          name: "Flow",
          fileName: "Flow.excalidraw",
          kind: "excalidraw",
          updatedAtMs: 1,
        },
      ]);
    });

    const { result } = renderHook(() => useDesignLibrary());

    await waitFor(() =>
      expect(result.current.designs).toEqual([
        {
          project: "App",
          name: "Flow",
          fileName: "Flow.excalidraw",
          kind: "excalidraw",
          updatedAtMs: 1,
        },
      ]),
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.selectedProject).toBe("Site");
    expect(result.current.designs).toEqual([]);
    expect(result.current.isDesignsLoading).toBe(true);

    await act(async () => {
      siteDesignsRequest.resolve([
        {
          project: "Site",
          name: "Landing",
          fileName: "Landing.excalidraw",
          kind: "excalidraw",
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
          kind: "excalidraw",
          updatedAtMs: 2,
        },
      ]),
    );
  });
});
