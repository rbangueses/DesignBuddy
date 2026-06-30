import type { ExcalidrawScene } from "../types/excalidraw";

export function isExcalidrawScene(value: unknown): value is ExcalidrawScene {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.type === "excalidraw" && Array.isArray(candidate.elements);
}
