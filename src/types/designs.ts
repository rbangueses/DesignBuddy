import type { ExcalidrawScene } from "./excalidraw";

export type ProjectSummary = {
  name: string;
  designCount: number;
  visibleInPresentationMode?: boolean;
};

export type BackupResult = {
  projectCount: number;
  fileCount: number;
};

export type RestoreConflictResolution = "copy" | "replace" | "skip";

export type RestoreArtifactPreview = {
  project: string;
  fileName: string;
  kind: DesignKind;
  conflictsWithExisting: boolean;
};

export type RestorePreview = {
  artifacts: RestoreArtifactPreview[];
  invalidFileCount: number;
};

export type RestoreArtifact = {
  project: string;
  fileName: string;
  conflictResolution: RestoreConflictResolution;
};

export type RestoreResult = {
  addedCount: number;
  copiedCount: number;
  replacedCount: number;
  skippedCount: number;
  invalidFileCount: number;
};

export type DiagramNotes = {
  text: string;
};

export type DesignKind = "excalidraw" | "mermaid" | "note";

export type MermaidDesignContent = {
  source: string;
};

export type NoteDocument = {
  type: "doc";
  content?: unknown[];
  [key: string]: unknown;
};

export type NoteDesignContent = {
  type: "banguesesdraw-note";
  version: number;
  content: NoteDocument;
};

export type DesignContent =
  | ExcalidrawScene
  | MermaidDesignContent
  | NoteDesignContent;

export type DesignSummary = {
  project: string;
  name: string;
  fileName: string;
  kind: DesignKind;
  updatedAtMs: number;
};

export type DesignScene = {
  project: string;
  name: string;
  fileName: string;
  kind: DesignKind;
  content: DesignContent;
};
