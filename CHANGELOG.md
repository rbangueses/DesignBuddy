# Changelog

## 2026-09-17 — 0.3.2

- Added per-request AI controls for timeout (30–600 seconds) and custom Excalidraw output limits (1,000–120,000 tokens). These limits apply to prompt analysis and generation, and are also available when modifying an existing Excalidraw diagram.

## 2026-09-15 — 0.3.1

- Added a Move button to artifact editors and library rows. Move a diagram or note into another project without exporting or reimporting it.
- Updated Duplicate to let you choose the destination project and refresh project counters after copying, moving, or deleting. Copies retain associated diagram notes, while name conflicts are never overwritten.

## 2026-09-15

- Added an optional per-diagram Notes panel, toggled with `N` when the canvas is focused. Notes persist privately alongside the diagram through rename, duplicate, backup, and restore, without changing the exported `.excalidraw` file.
- Added an AI API base URL setting for OpenAI-compatible proxies such as LiteLLM. Root and `/v1` proxy URLs use the Responses API automatically.
- Added the installed DesignBuddy version to AI settings.

## 2026-09-14

- Added selectable local-backup restore: choose individual artifacts by project, preview conflicts, and keep both, replace, or skip each conflicting file.
- Added `H` to start a presentation focus mode that automatically keeps the selected project visible, or to show every project again without undoing that visibility choice.
- Made Twilio component labels native bound labels, keeping them centered when a component is moved, resized, or edited.
- Added a persisted component-font preference with Excalifont as the default; component labels can also use Comic Shanns, Lilita One, Nunito, Virgil, sans serif, or monospace.
- Refined the Twilio component palette controls for clearer font selection and shortcut customization.
- Restored Excalidraw's additional-tools menu, including drawing and style controls that are moved there in current Excalidraw releases.
- Updated the TypeScript resolver configuration so the standard production build works with current TypeScript versions.

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
