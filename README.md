# DesignBuddy

DesignBuddy is a local-first desktop project workspace powered by Excalidraw. It gives you a simple library for organizing diagram projects while keeping every file on your own machine.

## What It Does

- Create, rename, duplicate, and delete projects.
- Create, rename, duplicate, and delete artifacts inside each project.
- Draw with the full Excalidraw canvas experience.
- Autosave designs locally as `.excalidraw` files.
- Create and edit Mermaid flowcharts as local `.mmd` files.
- Create rich text notes as local `.bdnote` files.
- Generate AI diagrams as either Excalidraw scenes or Mermaid flowcharts.
- Modify existing Excalidraw and Mermaid diagrams with AI prompts.
- Convert supported Mermaid flowcharts into editable Excalidraw designs.
- Insert ready-made Twilio architecture blocks into Excalidraw diagrams.
- Import existing Excalidraw, Mermaid, or note files into a project.
- Export individual artifacts for backup, sharing, or moving between machines.
- Export Excalidraw diagrams as basic `.drawio` files for diagrams.net or Lucidchart handoff.
- Back up the full local library to a chosen folder, including Google Drive folders.
- Hide private projects during screen-sharing with presentation mode.
- Mark selected projects as visible in presentation mode, useful for reference architectures.
- Search projects in the sidebar and filter artifacts inside a project.
- Toggle Mermaid support on or off from settings.
- Cancel dialogs with Escape.
- Regenerate the app icon set from a reusable DesignBuddy DB source icon.
- Build a macOS app bundle and Windows installers.

## Screenshots

### Project Library

![DesignBuddy project library](docs/screenshots/project-library.png)

### Drawing Editor

![DesignBuddy drawing editor](docs/screenshots/drawing-editor.png)

### Notes Editor

![DesignBuddy notes editor](docs/screenshots/note-editor.png)

### AI Diagram Prompt

![DesignBuddy AI diagram prompt](docs/screenshots/ai-diagram-dialog.png)

### AI Recommendation

![DesignBuddy AI recommendation](docs/screenshots/ai-recommendation.png)

### Mermaid Editor

![DesignBuddy Mermaid editor](docs/screenshots/mermaid-editor.png)

### Mermaid Converted To Excalidraw

![DesignBuddy Mermaid converted to Excalidraw](docs/screenshots/mermaid-converted-excalidraw.png)

### Twilio Components

![DesignBuddy Twilio components picker](docs/screenshots/twilio-components.png)

### Settings And Backup

![DesignBuddy settings and backup](docs/screenshots/settings-backup.png)

## Local Storage

Design files are stored locally in your user Documents folder:

- macOS: `~/Documents/DesignBuddy/Designs`
- Windows: `C:\Users\<you>\Documents\DesignBuddy\Designs`

Each Excalidraw design is saved as a separate `.excalidraw` file. Mermaid flowcharts are saved as separate `.mmd` files. Notes are saved as separate `.bdnote` files. No cloud sync, account, or remote storage is required.

Project presentation visibility is also stored locally in each project folder using a small `.designbuddy-project.json` metadata file.

## Local Backup

DesignBuddy can copy your local library to a backup folder from **Settings**. Choose a folder once, such as a Google Drive folder, then use **Back up now** whenever you want to copy the current projects and artifacts there.

Backup is one-way in this version: local library to backup folder. It copies Excalidraw files, Mermaid files, note files, and project metadata, but it does not restore automatically or delete files from the backup folder. This keeps offline use unchanged and avoids accidental overwrites from cloud sync conflicts.

## Excalidraw Designs

Excalidraw designs are the default design type. They use the embedded Excalidraw editor, so you get the familiar sketch-style drawing workflow, keyboard shortcuts, library tools, and editable canvas elements.

DesignBuddy adds a local design-manager layer around Excalidraw:

- project folders in the sidebar
- design search and filtering
- rename and duplicate actions
- local autosave
- import and export
- AI modification
- Twilio component templates

## Notes

Notes are lightweight rich text artifacts stored beside diagrams in the selected project. They use a TipTap-powered visual editor, so formatting is applied directly rather than typed as Markdown syntax.

The current note editor supports:

- paragraphs and headings
- bold and italic text
- bullet and numbered lists
- block quotes and code blocks
- undo and redo
- local autosave
- import and export as `.bdnote`

Notes are intentionally project-scoped. Use them for discovery notes, customer context, architecture rationale, meeting summaries, or anything that should live next to the diagrams it explains.

## Presentation Mode

The project sidebar includes a presentation mode toggle for screen-sharing. When enabled, private projects are hidden from the sidebar so their names are not visible and cannot be selected accidentally. The currently open project remains visible so you do not lose your place.

Each project has a visibility flag in the sidebar. Use it to keep non-sensitive projects, such as reference architecture folders, visible even while presentation mode is enabled. Projects are private by default unless you mark them as visible.

## Keyboard Shortcuts

In the project library:

- `1` creates a new note.
- `2` creates a new Excalidraw diagram.
- `3` creates a new Mermaid diagram, when Mermaid is enabled.
- `Escape` cancels open dialogs.

In the note editor:

- `Cmd+B` / `Ctrl+B` toggles bold.
- `Cmd+I` / `Ctrl+I` toggles italic.

Inside Excalidraw, the standard Excalidraw shortcuts still apply, including tool shortcuts for selection, shapes, drawing, text, and pan/hand mode.

## Twilio Component Templates

The Excalidraw editor includes a Twilio components picker for quickly adding architecture blocks. Components are grouped by product area:

- Channels: Programmable Messaging, Programmable Voice, SMS, WhatsApp, Email API, Recording
- Trust & Identity: Verify, Lookup
- Conversations Suite: Twilio Orchestrator, Conversation Relay, Twilio Agent Connect, Conversation Intelligence, Memory
- Contact Center: Flex, Studio, TaskRouter
- Compute & Integrations: Functions, Assets, 3rd Party API
- Segment Stack: Segment CDP, Connections, Profiles, Engage

Twilio-owned blocks use Twilio red. External dependencies such as `3rd Party API` use a separate yellow style.

## Mermaid Flowcharts

DesignBuddy can store Mermaid flowcharts locally as `.mmd` files beside Excalidraw designs. Mermaid mode is useful for structured diagrams and lower-cost AI generation.

Mermaid designs have a split editor:

- source editor on the left
- live preview on the right
- AI modify support
- export/import as `.mmd`
- conversion into Excalidraw when the diagram uses the supported simple flowchart subset

Supported Mermaid-to-Excalidraw conversion currently focuses on simple `flowchart LR` and `flowchart TD` diagrams with basic nodes and arrows. Chained arrows and basic edge labels are supported, but complex Mermaid features such as subgraphs, styling directives, class definitions, sequence diagrams, and advanced shapes are intentionally outside the current conversion scope.

Mermaid can be disabled from AI settings if you want a simpler Excalidraw-only experience.

## AI Diagrams

AI features use your own OpenAI API key. The key is stored locally in the app settings on your machine.

From the library, you can generate a new diagram from a prompt and choose:

- Excalidraw output for fully editable sketch-style diagrams
- Mermaid output for cheaper, more compact structured flowcharts
- model and quality level

From an existing design, you can also ask AI to modify the current diagram. Excalidraw modification updates the editable scene. Mermaid modification updates the Mermaid source.

AI requests are sent to OpenAI only when you explicitly use an AI action. Regular drawing, local storage, import, export, and project management do not require a network connection.

## Migration From BanguesesDraw

DesignBuddy is the renamed version of BanguesesDraw. On first launch, the app looks for an existing local library at `~/Documents/BanguesesDraw/Designs` and moves it to `~/Documents/DesignBuddy/Designs` if the new folder does not already exist.

Existing Excalidraw scenes, Mermaid diagrams, notes, AI settings, and backup settings remain compatible. Some internal file markers and local settings keys intentionally keep the original `banguesesdraw` identifier so older artifacts continue to open cleanly.

## Import And Export

DesignBuddy supports single-artifact import and export:

- import `.excalidraw` files into the selected project
- import `.mmd` Mermaid files into the selected project
- import `.bdnote` note files into the selected project
- export an individual artifact for backup or sharing
- export an Excalidraw diagram as a basic `.drawio` file for diagrams.net or Lucidchart import

If an imported artifact name already exists, DesignBuddy creates a conflict-safe copy name instead of overwriting the existing file.

The draw.io export is a practical first pass intended for handoff: it preserves common editable shapes, text, diamonds, ellipses, and arrows. Freehand strokes and advanced Excalidraw-specific styling may not convert perfectly.

## App Icon

The app icon is generated from `src-tauri/icons/source-icon.png` and the reusable generator script in `scripts/generate-designbuddy-icon.mjs`. After changing the source icon, run:

```bash
node scripts/generate-designbuddy-icon.mjs
npm exec tauri icon -- src-tauri/icons/source-icon.png -o src-tauri/icons
```

The Tauri build script watches the key icon files so `npm run tauri:dev` refreshes icon resources after icon changes.

## Prerequisites

You do not need developer tools to run a downloaded GitHub Actions artifact. You only need these prerequisites if you want to clone the repo, run the app from source, or build it locally.

Required for local development:

- Node.js 22 or newer
- npm
- Rust stable, installed with Cargo available on your terminal `PATH`
- Tauri system dependencies for your OS

Check that Rust is available before running Tauri commands:

```bash
cargo --version
rustc --version
```

If those commands fail with `command not found` or `No such file or directory`, install Rust from rustup and restart your terminal:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

On macOS, also install Xcode Command Line Tools if prompted:

```bash
xcode-select --install
```

On Windows, install Rust from rustup and use the default MSVC toolchain. You may also need Microsoft Visual Studio Build Tools with the **Desktop development with C++** workload.

## Install

### macOS

Download the `DesignBuddy-macos` artifact from GitHub Actions. Unzip it, then drag `DesignBuddy.app` into Applications.

If macOS warns that Apple could not verify the app is free of malware, right-click the app in Applications and choose **Open**. This can happen because the app is ad-hoc signed but not notarized with an Apple Developer ID yet.

### Windows

Download the Windows build artifact from GitHub Actions and open the `nsis` folder. Run the `.exe` installer.

The artifact also includes an `msi` folder. The MSI installer is useful for Windows environments that prefer Windows Installer packages.

If Windows SmartScreen warns about the installer, choose **More info** and **Run anyway**. This can happen because the app is not code-signed yet.

## Build From Source

Before building from source, complete the prerequisites above.

Clone the repository:

```bash
git clone https://github.com/rbangueses/DesignBuddy.git
cd DesignBuddy
```

Install dependencies:

```bash
npm ci
```

Run the app in development:

```bash
npm run tauri:dev
```

Build native app bundles and installers:

```bash
npm exec tauri build
```

On macOS, you can also build only the app bundle:

```bash
npm exec -- tauri build --bundles app
```

The macOS app bundle is created under:

```text
src-tauri/target/release/bundle/macos/
```

The default local macOS build also creates a DMG under:

```text
src-tauri/target/release/bundle/dmg/
```

Open the app bundle folder:

```bash
open src-tauri/target/release/bundle/macos
```

Then drag DesignBuddy into Applications and launch it from Applications. A local build usually avoids the downloaded-artifact Gatekeeper flow, but if macOS still warns, right-click the app and choose **Open**.

Run tests:

```bash
npm run test:run
cargo test --manifest-path src-tauri/Cargo.toml
```

## Installer Builds With GitHub Actions

This repo includes GitHub Actions workflows for a macOS app bundle and Windows installers:

```text
.github/workflows/macos-build.yml
.github/workflows/windows-build.yml
```

The workflows run on pushes to `main` and can also be started manually from GitHub:

1. Open the repo on GitHub.
2. Go to **Actions**.
3. Select **macOS Build** or **Windows Build**.
4. Click **Run workflow**.
5. Download `DesignBuddy-macos` or `DesignBuddy-windows` when the run finishes.

## Tech Stack

- Tauri 2
- React
- TypeScript
- Vite
- Excalidraw
- Mermaid
- TipTap
- Rust backend commands for local file storage

## License

Source-available, all rights reserved. The source code may be viewed, but may
not be copied, modified, distributed, sublicensed, sold, hosted as a service, or
otherwise used without prior written permission. See [LICENSE](LICENSE).
