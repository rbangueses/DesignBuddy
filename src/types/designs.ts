import type { ExcalidrawScene } from "./excalidraw";

export type ProjectSummary = {
  name: string;
  designCount: number;
};

export type DesignSummary = {
  project: string;
  name: string;
  fileName: string;
  updatedAtMs: number;
};

export type DesignScene = {
  project: string;
  name: string;
  fileName: string;
  content: ExcalidrawScene;
};
