import type { ExcalidrawScene } from "../types/excalidraw";

const PERSISTED_APP_STATE_KEYS = new Set([
  "gridModeEnabled",
  "gridSize",
  "gridStep",
  "theme",
  "viewBackgroundColor",
]);

const RUNTIME_APP_STATE_KEYS = new Set([
  "activeEmbeddable",
  "collaborators",
  "contextMenu",
  "cursorButton",
  "editingFrame",
  "editingGroupId",
  "editingLinearElement",
  "editingTextElement",
  "elementsToHighlight",
  "errorMessage",
  "fileHandle",
  "followedBy",
  "frameToHighlight",
  "hoveredElementIds",
  "isCropping",
  "isLoading",
  "isResizing",
  "isRotating",
  "multiElement",
  "newElement",
  "openDialog",
  "openMenu",
  "openPopup",
  "pasteDialog",
  "pendingImageElementId",
  "previousSelectedElementIds",
  "resizingElement",
  "searchMatches",
  "selectedElementIds",
  "selectedGroupIds",
  "selectedLinearElement",
  "selectionElement",
  "showHyperlinkPopup",
  "snapLines",
  "startBoundElement",
  "suggestedBindings",
  "toast",
  "userToFollow",
]);

function sanitizeAppState(appState: Record<string, unknown> | undefined) {
  if (!appState) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(appState).filter(
      ([key]) => PERSISTED_APP_STATE_KEYS.has(key) && !RUNTIME_APP_STATE_KEYS.has(key),
    ),
  );
}

function sanitizeAppStateForExcalidraw(appState: Record<string, unknown> | undefined) {
  if (!appState) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(appState).filter(([key]) => !RUNTIME_APP_STATE_KEYS.has(key)),
  );
}

function normalizeElement(element: unknown) {
  if (!element || typeof element !== "object") {
    return element;
  }

  const candidate = element as Record<string, unknown>;
  const { index: _index, ...withoutIndex } = candidate;
  // Font/layout repair belongs to AI generation. Re-estimating on every save
  // changes the bounds of correctly measured or deliberately wrapped user text.
  return withoutIndex;
}

export function prepareSceneForStorage(scene: ExcalidrawScene): ExcalidrawScene {
  return {
    type: "excalidraw",
    version: scene.version ?? 2,
    source: scene.source ?? "banguesesdraw",
    elements: scene.elements.map(normalizeElement),
    appState: sanitizeAppState(scene.appState),
    files: scene.files ?? {},
  };
}

export function prepareSceneForExcalidraw(scene: ExcalidrawScene): ExcalidrawScene {
  return {
    type: "excalidraw",
    version: scene.version ?? 2,
    source: scene.source ?? "banguesesdraw",
    elements: scene.elements.map(normalizeElement),
    appState: sanitizeAppStateForExcalidraw(scene.appState),
    files: scene.files ?? {},
  };
}
