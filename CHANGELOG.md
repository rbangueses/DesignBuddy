# Changelog

## 2026-09-09

- Added customizable keyboard shortcuts for Twilio component templates, including `§` and `Cmd+Shift+T` to open the component palette.
- Added `Shift` plus a component key to insert a Twilio component directly from the Excalidraw canvas, without conflicting with Excalidraw's usual shortcuts.
- Reorganized Twilio component templates into Communications and Builder Tools, and added Twilio, Sync, Interconnect, and Proxy blocks.
- Renamed the Segment Stack group to Data and added Knowledge and Event Streams blocks.
- Expanded the Twilio component palette so all component groups are visible together on desktop.
- Fixed component bindings such as `V`, `E`, and `F` being ignored while the palette is open because they overlap with Excalidraw tool shortcuts.

## 2026-09-08

- Fixed unbound centered Excalidraw text shifting after save/reopen when DesignBuddy expands narrow text elements for reliable rendering.

## 2026-09-04

- Changed the macOS GitHub Actions artifact to publish a DMG instead of a raw `.app` bundle directory.
- Updated macOS install instructions to explain that the downloaded GitHub artifact is a ZIP containing the DMG.

## 2026-08-28

- Fixed AI diagram prompt analysis changing the selected output type from Excalidraw to Mermaid when the AI recommendation preferred Mermaid.
- Prompt analysis now receives the user's selected output type so optimized prompts are aligned with the chosen diagram format.

## 2026-08-20

- Fixed Excalidraw labels inside rectangles, circles, and other containers drifting out of position after saving, returning to the library, and reopening a design.
- Added a regression test to preserve Excalidraw-managed bound text geometry during scene normalization.
