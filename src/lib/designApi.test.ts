import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExcalidrawScene } from "../types/excalidraw";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

describe("designApi", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("calls list_projects", async () => {
    invoke.mockResolvedValueOnce([
      { name: "App", designCount: 2, visibleInPresentationMode: false },
    ]);
    const { designApi } = await import("./designApi");

    await expect(designApi.listProjects()).resolves.toEqual([
      { name: "App", designCount: 2, visibleInPresentationMode: false },
    ]);
    expect(invoke).toHaveBeenCalledWith("list_projects");
  });

  it("updates project visibility", async () => {
    invoke.mockResolvedValueOnce({
      name: "Reference",
      designCount: 3,
      visibleInPresentationMode: true,
    });
    const { designApi } = await import("./designApi");

    await expect(
      designApi.setProjectVisibility("Reference", true),
    ).resolves.toEqual({
      name: "Reference",
      designCount: 3,
      visibleInPresentationMode: true,
    });
    expect(invoke).toHaveBeenCalledWith("set_project_visibility", {
      name: "Reference",
      visibleInPresentationMode: true,
    });
  });

  it("backs up the local design library to a selected folder", async () => {
    invoke.mockResolvedValueOnce({ projectCount: 2, fileCount: 5 });
    const { designApi } = await import("./designApi");

    await expect(designApi.backupLibrary("/tmp/DesignBuddy Backup")).resolves.toEqual({
      projectCount: 2,
      fileCount: 5,
    });
    expect(invoke).toHaveBeenCalledWith("backup_library", {
      targetPath: "/tmp/DesignBuddy Backup",
    });
  });

  it("scans and restores explicitly selected backup artifacts", async () => {
    invoke
      .mockResolvedValueOnce({ artifacts: [], invalidFileCount: 0 })
      .mockResolvedValueOnce({ addedCount: 1, copiedCount: 0, replacedCount: 0, skippedCount: 0, invalidFileCount: 0 });
    const { designApi } = await import("./designApi");
    await designApi.scanBackup("/tmp/DesignBuddy Backup");
    await designApi.restoreBackup("/tmp/DesignBuddy Backup", [{
      project: "App", fileName: "Flow.excalidraw", conflictResolution: "copy",
    }]);
    expect(invoke).toHaveBeenNthCalledWith(1, "scan_backup", { sourcePath: "/tmp/DesignBuddy Backup" });
    expect(invoke).toHaveBeenNthCalledWith(2, "restore_backup", {
      sourcePath: "/tmp/DesignBuddy Backup",
      artifacts: [{ project: "App", fileName: "Flow.excalidraw", conflictResolution: "copy" }],
    });
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
      kind: "excalidraw",
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

  it("passes design kind when creating a Mermaid design", async () => {
    invoke.mockResolvedValueOnce({
      project: "Docs",
      name: "Flow",
      fileName: "Flow.mmd",
      kind: "mermaid",
      content: { source: "flowchart LR\n" },
    });
    const { designApi } = await import("./designApi");

    await designApi.createDesign("Docs", "Flow", "mermaid");

    expect(invoke).toHaveBeenCalledWith("create_design", {
      project: "Docs",
      name: "Flow",
      kind: "mermaid",
    });
  });

  it("passes design kind when creating a rich text note", async () => {
    invoke.mockResolvedValueOnce({
      project: "Docs",
      name: "Meeting notes",
      fileName: "Meeting notes.bdnote",
      kind: "note",
      content: {
        type: "banguesesdraw-note",
        version: 1,
        content: { type: "doc", content: [] },
      },
    });
    const { designApi } = await import("./designApi");

    await designApi.createDesign("Docs", "Meeting notes", "note");

    expect(invoke).toHaveBeenCalledWith("create_design", {
      project: "Docs",
      name: "Meeting notes",
      kind: "note",
    });
  });

  it("calls import_design and export_design with selected paths", async () => {
    const { designApi } = await import("./designApi");
    invoke
      .mockResolvedValueOnce({
        project: "App",
        name: "Imported",
        fileName: "Imported.excalidraw",
        kind: "excalidraw",
        updatedAtMs: 3,
      })
      .mockResolvedValueOnce(undefined);

    await expect(
      designApi.importDesign("App", "/tmp/Imported.excalidraw"),
    ).resolves.toEqual({
      project: "App",
      name: "Imported",
      fileName: "Imported.excalidraw",
      kind: "excalidraw",
      updatedAtMs: 3,
    });
    await designApi.exportDesign(
      "App",
      "Flow.excalidraw",
      "/tmp/Flow.excalidraw",
    );

    expect(invoke).toHaveBeenNthCalledWith(1, "import_design", {
      project: "App",
      sourcePath: "/tmp/Imported.excalidraw",
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "export_design", {
      project: "App",
      fileName: "Flow.excalidraw",
      targetPath: "/tmp/Flow.excalidraw",
    });
  });
});
