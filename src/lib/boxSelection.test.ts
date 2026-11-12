import { beforeEach, describe, expect, it } from "vitest";
import {
  BOX_SELECTION_SETTINGS_STORAGE_KEY,
  DEFAULT_BOX_SELECTION_SETTINGS,
  loadBoxSelectionSettings,
  overlapsBoxSelection,
  saveBoxSelectionSettings,
} from "./boxSelection";

describe("box selection settings", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to wrap selection", () => {
    expect(loadBoxSelectionSettings()).toEqual(DEFAULT_BOX_SELECTION_SETTINGS);
  });

  it("persists overlap selection", () => {
    saveBoxSelectionSettings({ mode: "overlap" });
    expect(loadBoxSelectionSettings()).toEqual({ mode: "overlap" });
  });

  it("falls back to wrap selection for invalid data", () => {
    localStorage.setItem(BOX_SELECTION_SETTINGS_STORAGE_KEY, '{"mode":"other"}');
    expect(loadBoxSelectionSettings()).toEqual(DEFAULT_BOX_SELECTION_SETTINGS);
  });
});

describe("overlapsBoxSelection", () => {
  const selection = { x1: 10, y1: 10, x2: 30, y2: 30 };

  it("includes an element touched by the marquee", () => {
    expect(overlapsBoxSelection({ x: 0, y: 0, width: 20, height: 20 }, selection)).toBe(true);
  });

  it("excludes elements outside the marquee and locked elements", () => {
    expect(overlapsBoxSelection({ x: 31, y: 10, width: 5, height: 5 }, selection)).toBe(false);
    expect(overlapsBoxSelection({ x: 10, y: 10, width: 5, height: 5, locked: true }, selection)).toBe(false);
  });
});
