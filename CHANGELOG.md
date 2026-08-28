# Changelog

## 2026-08-28

- Fixed AI diagram prompt analysis changing the selected output type from Excalidraw to Mermaid when the AI recommendation preferred Mermaid.
- Prompt analysis now receives the user's selected output type so optimized prompts are aligned with the chosen diagram format.

## 2026-08-20

- Fixed Excalidraw labels inside rectangles, circles, and other containers drifting out of position after saving, returning to the library, and reopening a design.
- Added a regression test to preserve Excalidraw-managed bound text geometry during scene normalization.
