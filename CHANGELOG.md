# Changelog

## 2026-11-13 — 0.3.11

- Fixed the Windows build test collision by giving every test its own unique temporary library folder.
- Refined the updater action with a clear bordered primary button and matched Cancel/Update action heights.
- Check silently for signed updates shortly after DesignBuddy opens. When one is available, a subtle sidebar notice opens release notes and a user-initiated update; no download starts automatically.
- Made **Selection: Overlap** preview touched elements while you drag the marquee, matching the immediate visual feedback of Wrap selection.

## 2026-11-13 — 0.3.10

- Show **Saving…** as soon as a diagram edit is detected, then switch to **Saved** only after the verified autosave completes.
- Moved diagram save feedback beside the project and diagram title, with a compact state dot that keeps the action strip focused on tools and Export.
- Hide the Export tooltip while its menu is open so it cannot cover the first export option.

## 2026-11-13 — 0.3.9

- Calmed diagram autosave feedback: the header keeps a fixed Saved/Saving status slot, no longer presents a false unsaved state while a diagram opens, and removes the redundant manual Save button.
- Ignore transient Excalidraw viewport and interaction state when deciding whether a diagram changed, while retaining diagram appearance settings such as background, theme, and grid.
- Record failed diagram and diagram-note saves in `Documents/DesignBuddy/Logs/save-failures.jsonl` without logging diagram content, and point to that file in the retry alert.
- Kept the Back tooltip inside the editor window by anchoring it from the left edge.

## 2026-11-13 — 0.3.8

- Made the update action use the same blue primary-button treatment as the rest of DesignBuddy.
- After a signed update is installed successfully, DesignBuddy now restarts automatically so the new version opens without requiring a manual quit and reopen.

## 2026-11-13 — 0.3.7

- Hardened local saves for diagrams, Mermaid files, and notes. DesignBuddy now writes through a temporary file, flushes it to disk, verifies the saved content can be read back correctly, and only then reports success.
- Made save problems explicit in the editor: failed saves remain visibly flagged with the underlying error and a **Retry save** action, instead of leaving a misleading saved state.
- Added a clear warning when a save remains in progress for more than 10 seconds, so a stalled save cannot go unnoticed.
- Protected against closing a native editor window while changes are pending: DesignBuddy completes a final save before it closes, and keeps the editor open if that save fails.
- Added signed in-app update checks in Settings. Before an update downloads, DesignBuddy creates a dated local library backup in `Documents/DesignBuddy/Backups`; failed backups prevent installation.
- Added an update review screen that shows release notes newest-first before any backup or download starts. When already current, it confirms that status and keeps the changelog available to read.

## 2026-11-12 — 0.3.5

- Added a persisted **Selection** mode to Excalidraw diagrams. Switch between the familiar **Wrap** marquee behaviour (select only fully enclosed elements) and **Overlap** (select any unlocked element the marquee touches).
- Added a clear, labelled Selection control at the start of the diagram editor action bar, with an immediate explanation of the active mode.
- Replaced delayed browser-title hints in diagram, Mermaid, and note editor headers with consistent immediate tooltips that explain what Notes, AI, component insertion, copy, move, export, conversion, and save actions do.

## 2026-11-10 — 0.3.4

- Fixed Clean Architecture generation failing when an AI model incorrectly uses the decorative Twilio ownership badge as a traffic endpoint. DesignBuddy now safely treats that link as an ownership association and continues generating the diagram.

## 2026-11-10 — 0.3.3

- Added optional reference-image input for AI diagram creation and prompt analysis. DesignBuddy sends the image only for the requested AI action and creates editable diagram elements rather than embedding the source image.
- Added **Clean architecture** generation mode for structured, presentation-oriented Excalidraw architecture diagrams. It uses the Twilio component library where applicable and applies deterministic layout and routing for common voice, messaging, backend, and agent patterns.
- Added local AI diagnostics controls, including optional raw-response export for troubleshooting. Diagnostics remain on the device unless you explicitly download and share them.

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
