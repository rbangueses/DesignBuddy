export const BOX_SELECTION_SETTINGS_STORAGE_KEY = "designbuddy.boxSelectionSettings";

export type BoxSelectionMode = "contain" | "overlap";

export type BoxSelectionSettings = {
  mode: BoxSelectionMode;
};

export const DEFAULT_BOX_SELECTION_SETTINGS: BoxSelectionSettings = {
  mode: "contain",
};

type ElementBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
  locked?: boolean;
};

type SelectionBounds = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function sanitizeBoxSelectionSettings(value: unknown): BoxSelectionSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_BOX_SELECTION_SETTINGS };
  }

  const candidate = value as Partial<BoxSelectionSettings>;
  return {
    mode: candidate.mode === "overlap" ? "overlap" : "contain",
  };
}

export function loadBoxSelectionSettings(): BoxSelectionSettings {
  try {
    const serializedSettings = localStorage.getItem(
      BOX_SELECTION_SETTINGS_STORAGE_KEY,
    );
    return serializedSettings
      ? sanitizeBoxSelectionSettings(JSON.parse(serializedSettings))
      : { ...DEFAULT_BOX_SELECTION_SETTINGS };
  } catch {
    return { ...DEFAULT_BOX_SELECTION_SETTINGS };
  }
}

export function saveBoxSelectionSettings(settings: BoxSelectionSettings) {
  localStorage.setItem(
    BOX_SELECTION_SETTINGS_STORAGE_KEY,
    JSON.stringify(sanitizeBoxSelectionSettings(settings)),
  );
}

/** Returns whether an editable element has any area inside a marquee. */
export function overlapsBoxSelection(
  element: ElementBounds,
  selection: SelectionBounds,
) {
  if (element.isDeleted || element.locked) {
    return false;
  }

  const elementLeft = Math.min(element.x, element.x + element.width);
  const elementRight = Math.max(element.x, element.x + element.width);
  const elementTop = Math.min(element.y, element.y + element.height);
  const elementBottom = Math.max(element.y, element.y + element.height);
  const selectionLeft = Math.min(selection.x1, selection.x2);
  const selectionRight = Math.max(selection.x1, selection.x2);
  const selectionTop = Math.min(selection.y1, selection.y2);
  const selectionBottom = Math.max(selection.y1, selection.y2);

  return (
    elementRight >= selectionLeft &&
    elementLeft <= selectionRight &&
    elementBottom >= selectionTop &&
    elementTop <= selectionBottom
  );
}
