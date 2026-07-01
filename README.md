# BanguesesDraw

BanguesesDraw is a local-first desktop design manager powered by Excalidraw. It gives you a simple library for organizing projects and designs, while keeping every drawing file on your own machine.

## What It Does

- Create, rename, duplicate, and delete projects.
- Create, rename, duplicate, and delete designs inside each project.
- Draw with the full Excalidraw canvas experience.
- Autosave designs locally as `.excalidraw` files.
- Create and edit Mermaid flowcharts as local `.mmd` files.
- Generate lower-cost AI Mermaid flowcharts and convert simple flowcharts into editable Excalidraw designs.
- Import existing Excalidraw files into a project.
- Export individual designs for backup, sharing, or moving between machines.
- Build native installers for macOS and Windows.

## Screenshots

### Project Library

![BanguesesDraw project library](docs/screenshots/main%20ui.png)

### Drawing Editor

![BanguesesDraw drawing editor](docs/screenshots/sample%20drawing.png)

## Local Storage

Design files are stored locally in your user Documents folder:

- macOS: `~/Documents/BanguesesDraw/Designs`
- Windows: `C:\Users\<you>\Documents\BanguesesDraw\Designs`

Each Excalidraw design is saved as a separate `.excalidraw` file. Mermaid flowcharts are saved as separate `.mmd` files. No cloud sync, account, or remote storage is required.

## Mermaid Flowcharts

BanguesesDraw can store Mermaid flowcharts locally as `.mmd` files beside Excalidraw designs. Mermaid mode is useful for structured diagrams and lower-cost AI generation. Supported conversion to Excalidraw currently focuses on simple `flowchart LR` and `flowchart TD` diagrams with basic nodes and arrows.

## Install

### macOS

Download the `BanguesesDraw-macos` artifact from GitHub Actions. Open the `.dmg` file inside the artifact and drag BanguesesDraw into Applications.

If macOS warns that the app is from an unidentified developer, right-click the app in Applications and choose **Open**. This can happen because the app is ad-hoc signed but not notarized with an Apple Developer ID yet.

### Windows

Download the Windows build artifact from GitHub Actions and open the `nsis` folder. Run the `.exe` installer.

The artifact also includes an `msi` folder. The MSI installer is useful for Windows environments that prefer Windows Installer packages.

If Windows SmartScreen warns about the installer, choose **More info** and **Run anyway**. This can happen because the app is not code-signed yet.

## Build From Source

Requirements:

- Node.js 22 or newer
- npm
- Rust stable
- Tauri system dependencies for your OS

Install dependencies:

```bash
npm ci
```

Run the app in development:

```bash
npm run tauri:dev
```

Run tests:

```bash
npm run test:run
cargo test --manifest-path src-tauri/Cargo.toml
```

Build a native app bundle:

```bash
npm exec tauri build
```

Local macOS builds create a DMG under:

```text
src-tauri/target/release/bundle/dmg/
```

## Installer Builds With GitHub Actions

This repo includes GitHub Actions workflows for macOS and Windows installers:

```text
.github/workflows/macos-build.yml
.github/workflows/windows-build.yml
```

The workflows run on pushes to `main` and can also be started manually from GitHub:

1. Open the repo on GitHub.
2. Go to **Actions**.
3. Select **macOS Build** or **Windows Build**.
4. Click **Run workflow**.
5. Download `BanguesesDraw-macos` or `BanguesesDraw-windows` when the run finishes.

## Tech Stack

- Tauri 2
- React
- TypeScript
- Vite
- Excalidraw
- Mermaid
- Rust backend commands for local file storage

## License

Private/internal project unless a license is added.
