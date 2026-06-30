# BanguesesDraw

BanguesesDraw is a local-first desktop design manager powered by Excalidraw. It gives you a simple library for organizing projects and designs, while keeping every drawing file on your own machine.

## What It Does

- Create, rename, duplicate, and delete projects.
- Create, rename, duplicate, and delete designs inside each project.
- Draw with the full Excalidraw canvas experience.
- Autosave designs locally as `.excalidraw` files.
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

Each design is saved as a separate `.excalidraw` file. No cloud sync, account, or remote storage is required.

## Install

### macOS

Download the macOS `.dmg`, open it, and drag BanguesesDraw into Applications.

If macOS warns that the app is from an unidentified developer, right-click the app and choose **Open**. This can happen because the app is not code-signed yet.

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

## Windows Builds With GitHub Actions

This repo includes a Windows GitHub Actions workflow:

```text
.github/workflows/windows-build.yml
```

The workflow runs on pushes to `main` and can also be started manually from GitHub:

1. Open the repo on GitHub.
2. Go to **Actions**.
3. Select **Windows Build**.
4. Click **Run workflow**.
5. Download the `BanguesesDraw-windows` artifact when the run finishes.

## Tech Stack

- Tauri 2
- React
- TypeScript
- Vite
- Excalidraw
- Rust backend commands for local file storage

## License

Private/internal project unless a license is added.
