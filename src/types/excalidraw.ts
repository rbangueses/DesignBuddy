export type ExcalidrawScene = {
  type: "excalidraw";
  version?: number;
  source?: string;
  elements: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
};
