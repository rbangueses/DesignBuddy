import type { ExcalidrawScene } from "../types/excalidraw";

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
    Object.entries(appState).filter(([key]) => !RUNTIME_APP_STATE_KEYS.has(key)),
  );
}

function estimateTextWidth(element: Record<string, unknown>) {
  const rawText = element.originalText ?? element.text;

  if (typeof rawText !== "string" || !rawText.trim()) {
    return null;
  }

  const fontSize = typeof element.fontSize === "number" ? element.fontSize : 20;
  const longestLineLength = rawText
    .split("\n")
    .reduce((longest, line) => Math.max(longest, line.length), 0);

  return Math.max(70, Math.ceil(longestLineLength * fontSize * 0.65));
}

function normalizeElement(element: unknown) {
  if (!element || typeof element !== "object") {
    return element;
  }

  const candidate = element as Record<string, unknown>;

  if (candidate.type !== "text") {
    return element;
  }

  const estimatedWidth = estimateTextWidth(candidate);

  if (!estimatedWidth) {
    return element;
  }

  const currentWidth = typeof candidate.width === "number" ? candidate.width : 0;

  if (currentWidth >= estimatedWidth) {
    return element;
  }

  return {
    ...candidate,
    width: estimatedWidth,
  };
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
  return prepareSceneForStorage(scene);
}
