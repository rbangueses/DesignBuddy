import { invoke } from "@tauri-apps/api/core";
import type {
  DesignScene,
  DesignSummary,
  ProjectSummary,
} from "../types/designs";
import type { ExcalidrawScene } from "../types/excalidraw";

export const designApi = {
  listProjects: () => invoke<ProjectSummary[]>("list_projects"),
  createProject: (name: string) =>
    invoke<ProjectSummary>("create_project", { name }),
  renameProject: (oldName: string, newName: string) =>
    invoke<ProjectSummary>("rename_project", { oldName, newName }),
  duplicateProject: (sourceName: string, targetName: string) =>
    invoke<ProjectSummary>("duplicate_project", { sourceName, targetName }),
  deleteProject: (name: string) => invoke<void>("delete_project", { name }),
  listDesigns: (project: string) =>
    invoke<DesignSummary[]>("list_designs", { project }),
  createDesign: (project: string, name: string) =>
    invoke<DesignScene>("create_design", { project, name }),
  readDesign: (project: string, fileName: string) =>
    invoke<DesignScene>("read_design", { project, fileName }),
  writeDesign: (project: string, fileName: string, content: ExcalidrawScene) =>
    invoke<DesignScene>("write_design", { project, fileName, content }),
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
};
