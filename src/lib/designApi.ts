import { invoke } from "@tauri-apps/api/core";
import type {
  BackupResult,
  RestoreArtifact,
  RestorePreview,
  RestoreResult,
  DesignContent,
  DiagramNotes,
  DesignKind,
  DesignScene,
  DesignSummary,
  ProjectSummary,
} from "../types/designs";

export const designApi = {
  listProjects: () => invoke<ProjectSummary[]>("list_projects"),
  createProject: (name: string) =>
    invoke<ProjectSummary>("create_project", { name }),
  renameProject: (oldName: string, newName: string) =>
    invoke<ProjectSummary>("rename_project", { oldName, newName }),
  duplicateProject: (sourceName: string, targetName: string) =>
    invoke<ProjectSummary>("duplicate_project", { sourceName, targetName }),
  deleteProject: (name: string) => invoke<void>("delete_project", { name }),
  setProjectVisibility: (name: string, visibleInPresentationMode: boolean) =>
    invoke<ProjectSummary>("set_project_visibility", {
      name,
      visibleInPresentationMode,
    }),
  listDesigns: (project: string) =>
    invoke<DesignSummary[]>("list_designs", { project }),
  createDesign: (
    project: string,
    name: string,
    kind: DesignKind = "excalidraw",
  ) => invoke<DesignScene>("create_design", { project, name, kind }),
  readDesign: (project: string, fileName: string) =>
    invoke<DesignScene>("read_design", { project, fileName }),
  writeDesign: (project: string, fileName: string, content: DesignContent) =>
    invoke<DesignScene>("write_design", { project, fileName, content }),
  readDiagramNotes: (project: string, fileName: string) =>
    invoke<DiagramNotes>("read_diagram_notes", { project, fileName }),
  writeDiagramNotes: (project: string, fileName: string, text: string) =>
    invoke<DiagramNotes>("write_diagram_notes", { project, fileName, text }),
  renameDesign: (project: string, oldFileName: string, newName: string) =>
    invoke<DesignSummary>("rename_design", { project, oldFileName, newName }),
  duplicateDesign: (
    project: string,
    sourceFileName: string,
    targetName: string,
  ) =>
    invoke<DesignSummary>("duplicate_design", {
      project,
      sourceFileName,
      targetName,
    }),
  deleteDesign: (project: string, fileName: string) =>
    invoke<void>("delete_design", { project, fileName }),
  importDesign: (project: string, sourcePath: string) =>
    invoke<DesignSummary>("import_design", { project, sourcePath }),
  exportDesign: (project: string, fileName: string, targetPath: string) =>
    invoke<void>("export_design", { project, fileName, targetPath }),
  exportDrawio: (targetPath: string, content: string) =>
    invoke<void>("export_drawio", { targetPath, content }),
  backupLibrary: (targetPath: string) =>
    invoke<BackupResult>("backup_library", { targetPath }),
  scanBackup: (sourcePath: string) =>
    invoke<RestorePreview>("scan_backup", { sourcePath }),
  restoreBackup: (sourcePath: string, artifacts: RestoreArtifact[]) =>
    invoke<RestoreResult>("restore_backup", { sourcePath, artifacts }),
};
