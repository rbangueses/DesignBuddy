# Mermaid Flowchart Flavour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local Mermaid flowchart designs, cheaper AI Mermaid generation/modification, and simple Mermaid-to-Excalidraw conversion without disrupting the existing Excalidraw workflow.

**Architecture:** Treat project entries as typed local design files. `.excalidraw` files continue through the existing Excalidraw editor; `.mmd` files open in a new Mermaid source + preview editor. AI Mermaid generation produces compact Mermaid text, and conversion parses a small flowchart subset into a new Excalidraw scene.

**Tech Stack:** Tauri 2, Rust file commands, React, TypeScript, Vitest, Testing Library, `@excalidraw/excalidraw`, OpenAI Responses API through the existing renderer fetch helper, and the official `mermaid` npm package for preview rendering.

## Global Constraints

- Keep all user design storage local and file-based under `Designs/`.
- Do not replace Excalidraw as the primary freeform drawing canvas.
- Do not build a full Mermaid visual canvas editor in this version.
- Support only `flowchart LR` and `flowchart TD` for first-pass Mermaid-to-Excalidraw conversion.
- Leave original `.mmd` files unchanged when converting; always create a new `.excalidraw` design.
- Preserve existing `.excalidraw` files and behavior.
- Unsupported Mermaid should remain editable as source, but conversion must block with a clear error.
- Use the existing AI settings dialog and model configuration.
- Follow the existing quiet utility UI style.

---

## File Structure

- Modify `src-tauri/src/designs.rs`: add typed design file support for `.excalidraw` and `.mmd`, including list/create/read/write/import/export/duplicate/delete.
- Modify `src-tauri/src/lib.rs`: expose the same Tauri commands with typed content support.
- Modify `src/types/designs.ts`: add `DesignKind`, `MermaidDesignContent`, `DesignContent`, and typed summaries/scenes.
- Modify `src/lib/designApi.ts`: add `kind` parameters and typed read/write/create helpers while keeping existing call names where possible.
- Modify `src/hooks/useDesignLibrary.ts`: support creating Excalidraw or Mermaid designs and writing optional content.
- Modify `src/App.tsx`: route open files to `EditorView` or new `MermaidEditorView` based on `DesignSummary.kind`.
- Modify `src/components/DesignList.tsx`: show design type and expose `New Mermaid flowchart`.
- Modify `src/components/LibraryView.tsx`: wire Mermaid creation/import/export and AI output mode.
- Create `src/components/MermaidEditorView.tsx`: source editor, preview, autosave/manual save, rename/duplicate/export, AI modify, convert.
- Create `src/components/MermaidPreview.tsx`: isolated Mermaid render lifecycle and error display.
- Create `src/lib/mermaidSource.ts`: validation and normalisation for Mermaid source.
- Create `src/lib/mermaidFlowchart.ts`: parser for supported flowchart subset.
- Create `src/lib/mermaidToExcalidraw.ts`: layout + scene generator.
- Modify `src/lib/openaiDiagram.ts`: add Mermaid generation and modification functions.
- Modify `src/components/AiDiagramDialog.tsx`: add output mode selector.
- Create `src/components/AiMermaidModifyDialog.tsx`: Mermaid-specific modification dialog.
- Modify `src/styles.css`: add compact Mermaid editor and type badge styles.
- Modify `package.json` and `package-lock.json`: add `mermaid`.

---

### Task 1: Typed Local Design Files

**Files:**
- Modify: `src-tauri/src/designs.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/types/designs.ts`
- Modify: `src/lib/designApi.ts`
- Test: `src-tauri/src/designs.rs`
- Test: `src/lib/designApi.test.ts`

**Interfaces:**
- Produces Rust enum:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DesignKind {
    Excalidraw,
    Mermaid,
}
```

- Produces TypeScript types:

```ts
export type DesignKind = "excalidraw" | "mermaid";

export type MermaidDesignContent = {
  source: string;
};

export type DesignContent = ExcalidrawScene | MermaidDesignContent;

export type DesignSummary = {
  project: string;
  name: string;
  fileName: string;
  kind: DesignKind;
  updatedAtMs: number;
};

export type DesignScene = {
  project: string;
  name: string;
  fileName: string;
  kind: DesignKind;
  content: DesignContent;
};
```

- Produces API signatures:

```ts
createDesign(project: string, name: string, kind?: DesignKind): Promise<DesignScene>
writeDesign(project: string, fileName: string, content: DesignContent): Promise<DesignScene>
readDesign(project: string, fileName: string): Promise<DesignScene>
```

- Consumes existing Excalidraw scene validation behavior.

- [ ] **Step 1: Add failing Rust tests for mixed design files**

Append tests in `src-tauri/src/designs.rs`:

```rust
#[test]
fn lists_excalidraw_and_mermaid_designs() {
    let root = test_root("mixed-designs");
    create_project(&root, "Architecture").unwrap();
    create_design(&root, "Architecture", "Canvas", DesignKind::Excalidraw).unwrap();
    create_design(&root, "Architecture", "Flow", DesignKind::Mermaid).unwrap();

    let designs = list_designs(&root, "Architecture").unwrap();
    let kinds = designs
        .iter()
        .map(|design| (design.file_name.as_str(), design.kind.clone()))
        .collect::<Vec<_>>();

    assert!(kinds.contains(&("Canvas.excalidraw", DesignKind::Excalidraw)));
    assert!(kinds.contains(&("Flow.mmd", DesignKind::Mermaid)));

    fs::remove_dir_all(root).unwrap();
}

#[test]
fn reads_and_writes_mermaid_source() {
    let root = test_root("mermaid-read-write");
    create_project(&root, "Architecture").unwrap();
    let design = create_design(&root, "Architecture", "Routing", DesignKind::Mermaid).unwrap();

    assert_eq!(design.kind, DesignKind::Mermaid);
    assert_eq!(design.content, json!({ "source": "flowchart LR\n" }));

    let updated = write_design(
        &root,
        "Architecture",
        "Routing.mmd",
        &json!({ "source": "flowchart LR\n  A[Start] --> B[Done]\n" }),
    )
    .unwrap();

    assert_eq!(updated.kind, DesignKind::Mermaid);
    assert_eq!(
        updated.content,
        json!({ "source": "flowchart LR\n  A[Start] --> B[Done]\n" })
    );

    fs::remove_dir_all(root).unwrap();
}

#[test]
fn imports_and_exports_mermaid_source() {
    let root = test_root("mermaid-import-export");
    create_project(&root, "Architecture").unwrap();
    let external = root.join("external.mmd");
    let exported = root.join("exported.mmd");
    fs::write(&external, "flowchart TD\n  A[Start] --> B[Done]\n").unwrap();

    let imported = import_design(&root, "Architecture", &external).unwrap();
    assert_eq!(imported.kind, DesignKind::Mermaid);
    assert_eq!(imported.file_name, "external.mmd");

    export_design(&root, "Architecture", "external.mmd", &exported).unwrap();
    assert_eq!(
        fs::read_to_string(&exported).unwrap(),
        "flowchart TD\n  A[Start] --> B[Done]\n"
    );

    fs::remove_dir_all(root).unwrap();
}
```

- [ ] **Step 2: Run Rust tests to verify failure**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml mermaid
```

Expected: FAIL because `DesignKind`, typed `create_design`, and Mermaid import/export support do not exist yet.

- [ ] **Step 3: Implement typed file support in Rust**

Change `DesignSummary` and `DesignScene` in `src-tauri/src/designs.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DesignKind {
    Excalidraw,
    Mermaid,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesignSummary {
    pub project: String,
    pub name: String,
    pub file_name: String,
    pub kind: DesignKind,
    pub updated_at_ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DesignScene {
    pub project: String,
    pub name: String,
    pub file_name: String,
    pub kind: DesignKind,
    pub content: Value,
}
```

Replace extension helpers with typed helpers:

```rust
const EXCALIDRAW_EXTENSION: &str = "excalidraw";
const MERMAID_EXTENSION: &str = "mmd";

fn extension_for_kind(kind: &DesignKind) -> &'static str {
    match kind {
        DesignKind::Excalidraw => EXCALIDRAW_EXTENSION,
        DesignKind::Mermaid => MERMAID_EXTENSION,
    }
}

fn kind_from_path(path: &Path) -> Option<DesignKind> {
    match path.extension().and_then(|extension| extension.to_str()) {
        Some(EXCALIDRAW_EXTENSION) => Some(DesignKind::Excalidraw),
        Some(MERMAID_EXTENSION) => Some(DesignKind::Mermaid),
        _ => None,
    }
}

fn is_design_file(path: &Path) -> bool {
    kind_from_path(path).is_some()
}
```

Add content validation:

```rust
fn empty_mermaid_source() -> Value {
    json!({ "source": "flowchart LR\n" })
}

fn validate_mermaid(value: &Value) -> Result<(), DesignError> {
    match value.get("source").and_then(Value::as_str) {
        Some(source) if source.trim_start().starts_with("flowchart ") => Ok(()),
        Some(_) => Err(DesignError::InvalidDesignFile(
            "mermaid source must start with a flowchart declaration".to_string(),
        )),
        None => Err(DesignError::InvalidDesignFile(
            "missing mermaid source".to_string(),
        )),
    }
}

fn validate_content(kind: &DesignKind, value: &Value) -> Result<(), DesignError> {
    match kind {
        DesignKind::Excalidraw => validate_scene(value),
        DesignKind::Mermaid => validate_mermaid(value),
    }
}
```

Update `create_design` signature and call sites:

```rust
pub fn create_design(
    root: &Path,
    project: &str,
    name: &str,
    kind: DesignKind,
) -> Result<DesignScene, DesignError> {
    let path = design_path(root, project, name, &kind)?;
    if path.exists() {
        return Err(DesignError::AlreadyExists(name.to_string()));
    }

    let content = match kind {
        DesignKind::Excalidraw => empty_scene(),
        DesignKind::Mermaid => empty_mermaid_source(),
    };

    write_design(
        root,
        project,
        path.file_name().unwrap().to_string_lossy().as_ref(),
        &content,
    )
}
```

Ensure `read_design`, `write_design`, `rename_design`, `duplicate_design`, `import_design`, `export_design`, and `delete_design` resolve kind from the file extension instead of forcing `.excalidraw`.

For `.mmd` import/export, read and write raw Mermaid text on disk while returning `{ "source": string }` through Tauri. For `.excalidraw`, keep the existing pretty JSON behavior.

- [ ] **Step 4: Update Tauri command signature**

In `src-tauri/src/lib.rs`, import `DesignKind` and update `create_design`:

```rust
use designs::{DesignKind, DesignScene, DesignSummary, ProjectSummary};

#[tauri::command]
fn create_design(
    app: tauri::AppHandle,
    project: String,
    name: String,
    kind: Option<DesignKind>,
) -> Result<DesignScene, String> {
    designs::create_design(
        &designs_root(&app)?,
        &project,
        &name,
        kind.unwrap_or(DesignKind::Excalidraw),
    )
    .map_err(|error| error.to_string())
}
```

- [ ] **Step 5: Update TypeScript API tests**

Add cases to `src/lib/designApi.test.ts`:

```ts
it("passes design kind when creating a Mermaid design", async () => {
  invokeMock.mockResolvedValueOnce({
    project: "Docs",
    name: "Flow",
    fileName: "Flow.mmd",
    kind: "mermaid",
    content: { source: "flowchart LR\n" },
  });

  await designApi.createDesign("Docs", "Flow", "mermaid");

  expect(invokeMock).toHaveBeenCalledWith("create_design", {
    project: "Docs",
    name: "Flow",
    kind: "mermaid",
  });
});
```

- [ ] **Step 6: Update TypeScript types and API implementation**

Apply the interfaces above in `src/types/designs.ts`, then update `src/lib/designApi.ts`:

```ts
createDesign: (project: string, name: string, kind: DesignKind = "excalidraw") =>
  invoke<DesignScene>("create_design", { project, name, kind }),
writeDesign: (project: string, fileName: string, content: DesignContent) =>
  invoke<DesignScene>("write_design", { project, fileName, content }),
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm run test:run -- src/lib/designApi.test.ts
cargo test --manifest-path src-tauri/Cargo.toml designs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/designs.rs src-tauri/src/lib.rs src/types/designs.ts src/lib/designApi.ts src/lib/designApi.test.ts
git commit -m "feat: support typed local design files"
```

---

### Task 2: Library Support for Mermaid Designs

**Files:**
- Modify: `src/hooks/useDesignLibrary.ts`
- Modify: `src/components/DesignList.tsx`
- Modify: `src/components/DesignList.test.tsx`
- Modify: `src/components/LibraryView.tsx`
- Modify: `src/components/LibraryView.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes `DesignKind` from Task 1.
- Produces hook method:

```ts
createDesign(name: string, kind?: DesignKind, content?: DesignContent): Promise<DesignScene | null>
```

- Produces UI action:

```ts
onCreateMermaidDesign: () => void
```

- [ ] **Step 1: Write failing hook test**

Add to `src/hooks/useDesignLibrary.test.tsx`:

```ts
it("creates a Mermaid design in the selected project", async () => {
  mockListProjects.mockResolvedValue([{ name: "Docs", designCount: 0 }]);
  mockListDesigns.mockResolvedValue([]);
  mockCreateDesign.mockResolvedValue({
    project: "Docs",
    name: "Routing",
    fileName: "Routing.mmd",
    kind: "mermaid",
    content: { source: "flowchart LR\n" },
  });

  const { result } = renderHook(() => useDesignLibrary());
  await waitFor(() => expect(result.current.selectedProject).toBe("Docs"));

  await act(async () => {
    await result.current.createDesign("Routing", "mermaid");
  });

  expect(mockCreateDesign).toHaveBeenCalledWith("Docs", "Routing", "mermaid");
});
```

- [ ] **Step 2: Update hook implementation**

Change the hook signature and body:

```ts
createDesign: (
  name: string,
  kind?: DesignKind,
  content?: DesignContent,
) => Promise<DesignScene | null>;
```

```ts
createDesign: async (name, kind = "excalidraw", content) =>
  withProject(async (project) => {
    const design = await designApi.createDesign(project, name, kind);
    const savedDesign = content
      ? await designApi.writeDesign(project, design.fileName, content)
      : design;

    await loadDesigns(project);
    return savedDesign;
  }),
```

- [ ] **Step 3: Write failing DesignList test**

Add to `src/components/DesignList.test.tsx`:

```tsx
it("shows type labels and a new Mermaid flowchart action", async () => {
  render(
    <DesignList
      project="Docs"
      designs={[
        {
          project: "Docs",
          name: "Canvas",
          fileName: "Canvas.excalidraw",
          kind: "excalidraw",
          updatedAtMs: 1,
        },
        {
          project: "Docs",
          name: "Flow",
          fileName: "Flow.mmd",
          kind: "mermaid",
          updatedAtMs: 2,
        },
      ]}
      totalDesignCount={2}
      filter=""
      onFilterChange={vi.fn()}
      onCreateDesign={vi.fn()}
      onCreateMermaidDesign={vi.fn()}
      onCreateAiDesign={vi.fn()}
      onConfigureAi={vi.fn()}
      onImportDesign={vi.fn()}
      onExportDesign={vi.fn()}
      onRenameDesign={vi.fn()}
      onDuplicateDesign={vi.fn()}
      onDeleteDesign={vi.fn()}
      onOpenDesign={vi.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: /new mermaid flowchart/i })).toBeInTheDocument();
  expect(screen.getByText("Excalidraw")).toBeInTheDocument();
  expect(screen.getByText("Mermaid")).toBeInTheDocument();
});
```

- [ ] **Step 4: Implement list UI**

In `src/components/DesignList.tsx`, add prop `onCreateMermaidDesign`, a compact button with an icon from `lucide-react`, and a type badge:

```tsx
<button type="button" onClick={onCreateMermaidDesign}>
  <Workflow size={16} />
  New Mermaid flowchart
</button>
```

```tsx
<span className={`design-kind ${design.kind}`}>{design.kind === "mermaid" ? "Mermaid" : "Excalidraw"}</span>
```

- [ ] **Step 5: Wire LibraryView**

Add pending action:

```ts
| { type: "create-mermaid-design" }
```

Add dialog handling:

```tsx
{pendingAction?.type === "create-mermaid-design" ? (
  <RenameDialog
    title="Create Mermaid flowchart"
    inputLabel="Flowchart name"
    submitLabel="Create"
    onCancel={closeDialog}
    onSubmit={async (name) => {
      const design = await library.createDesign(name, "mermaid");
      closeDialog();
      if (design) {
        onOpenDesign(design.project, design.fileName);
      }
    }}
  />
) : null}
```

- [ ] **Step 6: Update import/export filters**

In `src/components/LibraryView.tsx`, import both local formats:

```ts
const designImportFilters = [
  { name: "BanguesesDraw designs", extensions: ["excalidraw", "json", "mmd"] },
];
```

Choose export filters from the selected design:

```ts
const exportFilters =
  design.kind === "mermaid"
    ? [{ name: "Mermaid", extensions: ["mmd"] }]
    : [{ name: "Excalidraw", extensions: ["excalidraw"] }];
```

Use the existing `library.importDesign(sourcePath)` and `library.exportDesign(design.fileName, targetPath)` calls after updating the filters.

- [ ] **Step 7: Add styles**

In `src/styles.css`:

```css
.design-kind {
  min-width: 72px;
  border: 1px solid #d7d7cf;
  border-radius: 999px;
  padding: 2px 8px;
  color: #555b66;
  font-size: 12px;
  text-align: center;
}

.design-kind.mermaid {
  border-color: #b8d7c3;
  background: #eef8f0;
}
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
npm run test:run -- src/hooks/useDesignLibrary.test.tsx src/components/DesignList.test.tsx src/components/LibraryView.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useDesignLibrary.ts src/hooks/useDesignLibrary.test.tsx src/components/DesignList.tsx src/components/DesignList.test.tsx src/components/LibraryView.tsx src/components/LibraryView.test.tsx src/styles.css
git commit -m "feat: add mermaid designs to library"
```

---

### Task 3: Mermaid Editor and Preview

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/mermaidSource.ts`
- Create: `src/lib/mermaidSource.test.ts`
- Create: `src/components/MermaidPreview.tsx`
- Create: `src/components/MermaidEditorView.tsx`
- Create: `src/components/MermaidEditorView.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes `.mmd` `DesignScene` from Task 1.
- Produces:

```ts
export function normaliseMermaidContent(content: unknown): MermaidDesignContent;
export function validateMermaidSource(source: string): string | null;
```

- Produces `MermaidEditorView` props:

```ts
type MermaidEditorViewProps = {
  project: string;
  fileName: string;
  initialSource: string;
  onBack: () => void;
  onDesignMoved: (project: string, fileName: string, initialSource: string) => void;
};
```

- [ ] **Step 1: Install Mermaid dependency**

Run:

```bash
npm install mermaid
```

Expected: `package.json` and `package-lock.json` include `mermaid`.

- [ ] **Step 2: Write failing source validation tests**

Create `src/lib/mermaidSource.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normaliseMermaidContent, validateMermaidSource } from "./mermaidSource";

describe("mermaidSource", () => {
  it("accepts flowchart source", () => {
    expect(validateMermaidSource("flowchart LR\n  A[Start] --> B[Done]\n")).toBeNull();
  });

  it("rejects empty or non-flowchart source", () => {
    expect(validateMermaidSource("")).toBe("Mermaid source must start with flowchart LR or flowchart TD.");
    expect(validateMermaidSource("sequenceDiagram\nA->>B: Hi")).toBe(
      "Mermaid source must start with flowchart LR or flowchart TD.",
    );
  });

  it("normalises content from the backend", () => {
    expect(normaliseMermaidContent({ source: "flowchart TD\n" })).toEqual({
      source: "flowchart TD\n",
    });
  });
});
```

- [ ] **Step 3: Implement source helper**

Create `src/lib/mermaidSource.ts`:

```ts
import type { MermaidDesignContent } from "../types/designs";

export function validateMermaidSource(source: string) {
  const trimmed = source.trimStart();

  if (!trimmed.startsWith("flowchart LR") && !trimmed.startsWith("flowchart TD")) {
    return "Mermaid source must start with flowchart LR or flowchart TD.";
  }

  return null;
}

export function normaliseMermaidContent(content: unknown): MermaidDesignContent {
  if (
    typeof content === "object" &&
    content !== null &&
    "source" in content &&
    typeof content.source === "string"
  ) {
    return { source: content.source };
  }

  throw new Error("Invalid Mermaid source.");
}
```

- [ ] **Step 4: Create MermaidPreview**

Create `src/components/MermaidPreview.tsx`:

```tsx
import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";
import { validateMermaidSource } from "../lib/mermaidSource";

mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });

type MermaidPreviewProps = {
  source: string;
};

export function MermaidPreview({ source }: MermaidPreviewProps) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const validationError = validateMermaidSource(source);

    if (validationError) {
      setSvg("");
      setError(validationError);
      return;
    }

    mermaid
      .render(`mermaid-${id}`, source)
      .then((result) => {
        if (!cancelled) {
          setSvg(result.svg);
          setError(null);
        }
      })
      .catch((renderError) => {
        if (!cancelled) {
          setSvg("");
          setError(String(renderError));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, source]);

  if (error) {
    return <div className="mermaid-preview-error">{error}</div>;
  }

  return <div className="mermaid-preview" dangerouslySetInnerHTML={{ __html: svg }} />;
}
```

- [ ] **Step 5: Write failing editor test**

Create `src/components/MermaidEditorView.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { designApi } from "../lib/designApi";
import { MermaidEditorView } from "./MermaidEditorView";

vi.mock("../lib/designApi", () => ({
  designApi: {
    writeDesign: vi.fn(),
    renameDesign: vi.fn(),
    duplicateDesign: vi.fn(),
    exportDesign: vi.fn(),
  },
}));

describe("MermaidEditorView", () => {
  it("edits and saves Mermaid source", async () => {
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "Docs",
      name: "Flow",
      fileName: "Flow.mmd",
      kind: "mermaid",
      content: { source: "flowchart LR\n  A[Start] --> B[Done]\n" },
    });

    render(
      <MermaidEditorView
        project="Docs"
        fileName="Flow.mmd"
        initialSource="flowchart LR\n"
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await userEvent.clear(screen.getByLabelText(/mermaid source/i));
    await userEvent.type(screen.getByLabelText(/mermaid source/i), "flowchart LR\n  A[Start] --> B[Done]\n");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(designApi.writeDesign).toHaveBeenCalledWith("Docs", "Flow.mmd", {
        source: "flowchart LR\n  A[Start] --> B[Done]\n",
      });
    });
  });
});
```

- [ ] **Step 6: Implement MermaidEditorView**

Create `src/components/MermaidEditorView.tsx` with the same header pattern as `EditorView`, but using source text state:

```tsx
const [source, setSource] = useState(initialSource);
const [savedSource, setSavedSource] = useState(initialSource);
const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");

const saveNow = useCallback(async () => {
  setSaveStatus("saving");
  const design = await designApi.writeDesign(project, fileName, { source });
  const content = normaliseMermaidContent(design.content);
  setSavedSource(content.source);
  setSaveStatus("saved");
  return content.source;
}, [fileName, project, source]);
```

Render:

```tsx
<main className="mermaid-editor-grid">
  <section className="mermaid-source-panel">
    <textarea
      aria-label="Mermaid source"
      value={source}
      onChange={(event) => {
        setSource(event.target.value);
        setSaveStatus(event.target.value === savedSource ? "saved" : "unsaved");
      }}
    />
  </section>
  <section className="mermaid-preview-panel">
    <MermaidPreview source={source} />
  </section>
</main>
```

Add a simple `useEffect` autosave:

```ts
useEffect(() => {
  if (source === savedSource || saveStatus === "saving") {
    return;
  }

  const timeoutId = window.setTimeout(() => {
    void saveNow().catch((error) => {
      setSaveStatus("error");
      setError(String(error));
    });
  }, 900);

  return () => window.clearTimeout(timeoutId);
}, [saveNow, saveStatus, savedSource, source]);
```

- [ ] **Step 7: Route Mermaid files in App**

In `src/App.tsx`, replace `OpenDesign` with:

```ts
type OpenDesign =
  | {
      kind: "excalidraw";
      project: string;
      fileName: string;
      initialScene: ExcalidrawScene;
    }
  | {
      kind: "mermaid";
      project: string;
      fileName: string;
      initialSource: string;
    };
```

In `handleOpenDesign`, branch on `design.kind` and use `normaliseMermaidContent`.

- [ ] **Step 8: Run focused tests**

Run:

```bash
npm run test:run -- src/lib/mermaidSource.test.ts src/components/MermaidEditorView.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/lib/mermaidSource.ts src/lib/mermaidSource.test.ts src/components/MermaidPreview.tsx src/components/MermaidEditorView.tsx src/components/MermaidEditorView.test.tsx src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: add mermaid editor"
```

---

### Task 4: AI Mermaid Generation and Modification

**Files:**
- Modify: `src/lib/openaiDiagram.ts`
- Modify: `src/lib/openaiDiagram.test.ts`
- Modify: `src/components/AiDiagramDialog.tsx`
- Modify: `src/components/AiDiagramDialog.test.tsx` if present, otherwise add coverage in `src/components/LibraryView.test.tsx`
- Create: `src/components/AiMermaidModifyDialog.tsx`
- Create: `src/components/AiMermaidModifyDialog.test.tsx`
- Modify: `src/components/MermaidEditorView.tsx`
- Modify: `src/components/LibraryView.tsx`

**Interfaces:**
- Produces:

```ts
export async function generateMermaidFlowchart(options: {
  apiKey: string;
  model: string;
  quality: AiQuality;
  description: string;
  signal?: AbortSignal;
}): Promise<string>;

export async function modifyMermaidFlowchart(options: {
  apiKey: string;
  model: string;
  quality: AiQuality;
  source: string;
  instruction: string;
  signal?: AbortSignal;
}): Promise<string>;
```

- [ ] **Step 1: Write failing OpenAI tests**

Add to `src/lib/openaiDiagram.test.ts`:

```ts
it("generates Mermaid source from OpenAI text output", async () => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      output_text: "flowchart LR\n  A[Start] --> B[Done]\n",
    }),
  } as Response);

  await expect(
    generateMermaidFlowchart({
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
      quality: "draft",
      description: "simple process",
    }),
  ).resolves.toBe("flowchart LR\n  A[Start] --> B[Done]\n");
});

it("rejects non-flowchart Mermaid output", async () => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ output_text: "sequenceDiagram\nA->>B: Hi" }),
  } as Response);

  await expect(
    generateMermaidFlowchart({
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
      quality: "draft",
      description: "sequence",
    }),
  ).rejects.toThrow("Mermaid source must start with flowchart LR or flowchart TD.");
});
```

- [ ] **Step 2: Implement Mermaid OpenAI helpers**

In `src/lib/openaiDiagram.ts`, add prompt constants:

```ts
const MERMAID_SYSTEM_PROMPT = [
  "You generate Mermaid flowchart source only.",
  "Return only Mermaid text with no Markdown fence.",
  "Use only flowchart LR or flowchart TD.",
  "Use simple node labels and simple arrows.",
  "Allowed shapes: A[Label], A(Label), A{Decision}, A[(Database)].",
].join("\n");
```

Implement:

```ts
export async function generateMermaidFlowchart(options: GenerateMermaidOptions) {
  const source = await callOpenAiForText({
    apiKey: options.apiKey,
    model: options.model,
    maxOutputTokens: QUALITY_TO_MERMAID_MAX_OUTPUT_TOKENS[options.quality],
    systemPrompt: MERMAID_SYSTEM_PROMPT,
    userPrompt: options.description,
    signal: options.signal,
  });

  const cleaned = source.replace(/^```mermaid\s*/i, "").replace(/```$/i, "").trim();
  const error = validateMermaidSource(cleaned);
  if (error) {
    throw new Error(error);
  }

  return `${cleaned}\n`;
}
```

Refactor existing JSON call enough to share timeout, abort, and response text extraction.

- [ ] **Step 3: Add AI output mode to generation dialog**

In `AiDiagramDialog`, add state:

```ts
const [outputMode, setOutputMode] = useState<"excalidraw" | "mermaid">("excalidraw");
```

Add a segmented control:

```tsx
<div className="segmented-control" aria-label="Diagram output">
  <button type="button" className={outputMode === "excalidraw" ? "active" : ""} onClick={() => setOutputMode("excalidraw")}>
    Excalidraw
  </button>
  <button type="button" className={outputMode === "mermaid" ? "active" : ""} onClick={() => setOutputMode("mermaid")}>
    Mermaid
  </button>
</div>
```

Change `onGenerated` to a discriminated callback:

```ts
onGenerated: (
  result:
    | { kind: "excalidraw"; name: string; scene: ExcalidrawScene }
    | { kind: "mermaid"; name: string; source: string },
) => Promise<void>;
```

- [ ] **Step 4: Wire LibraryView generation**

In `LibraryView`, update AI result handling:

```tsx
onGenerated={async (result) => {
  const design =
    result.kind === "mermaid"
      ? await library.createDesign(result.name, "mermaid", { source: result.source })
      : await library.createDesign(result.name, "excalidraw", result.scene);

  closeDialog();

  if (design) {
    onOpenDesign(design.project, design.fileName);
  }
}}
```

- [ ] **Step 5: Add Mermaid modify dialog**

Create `src/components/AiMermaidModifyDialog.tsx` matching `AiModifyDialog`, but call `modifyMermaidFlowchart` and return source:

```ts
type AiMermaidModifyDialogProps = {
  settings: AiSettings;
  source: string;
  onCancel: () => void;
  onModified: (source: string) => void;
};
```

- [ ] **Step 6: Wire Mermaid editor modify action**

Add pending action `"ai-modify"` in `MermaidEditorView`, render a `Bot` icon button, and on success:

```ts
const handleAiModified = (nextSource: string) => {
  setSource(nextSource);
  setSaveStatus(nextSource === savedSource ? "saved" : "unsaved");
  setPendingAction(null);
};
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm run test:run -- src/lib/openaiDiagram.test.ts src/components/LibraryView.test.tsx src/components/MermaidEditorView.test.tsx src/components/AiMermaidModifyDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/openaiDiagram.ts src/lib/openaiDiagram.test.ts src/components/AiDiagramDialog.tsx src/components/AiMermaidModifyDialog.tsx src/components/AiMermaidModifyDialog.test.tsx src/components/MermaidEditorView.tsx src/components/LibraryView.tsx src/components/LibraryView.test.tsx src/styles.css
git commit -m "feat: generate mermaid diagrams with ai"
```

---

### Task 5: Mermaid Flowchart Parser

**Files:**
- Create: `src/lib/mermaidFlowchart.ts`
- Create: `src/lib/mermaidFlowchart.test.ts`

**Interfaces:**
- Produces:

```ts
export type MermaidDirection = "LR" | "TD";
export type MermaidNodeShape = "rectangle" | "rounded" | "decision" | "database";

export type ParsedMermaidNode = {
  id: string;
  label: string;
  shape: MermaidNodeShape;
};

export type ParsedMermaidEdge = {
  from: string;
  to: string;
  label?: string;
};

export type ParsedMermaidFlowchart = {
  direction: MermaidDirection;
  nodes: ParsedMermaidNode[];
  edges: ParsedMermaidEdge[];
};

export function parseMermaidFlowchart(source: string): ParsedMermaidFlowchart;
```

- [ ] **Step 1: Write parser tests**

Create `src/lib/mermaidFlowchart.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseMermaidFlowchart } from "./mermaidFlowchart";

describe("parseMermaidFlowchart", () => {
  it("parses simple LR flowcharts", () => {
    expect(
      parseMermaidFlowchart("flowchart LR\n  A[Start] -->|go| B[Done]\n"),
    ).toEqual({
      direction: "LR",
      nodes: [
        { id: "A", label: "Start", shape: "rectangle" },
        { id: "B", label: "Done", shape: "rectangle" },
      ],
      edges: [{ from: "A", to: "B", label: "go" }],
    });
  });

  it("parses rounded decision and database shapes", () => {
    expect(
      parseMermaidFlowchart("flowchart TD\n  A(Start) --> B{Ready?}\n  B --> C[(Store)]\n"),
    ).toEqual({
      direction: "TD",
      nodes: [
        { id: "A", label: "Start", shape: "rounded" },
        { id: "B", label: "Ready?", shape: "decision" },
        { id: "C", label: "Store", shape: "database" },
      ],
      edges: [
        { from: "A", to: "B" },
        { from: "B", to: "C" },
      ],
    });
  });

  it("rejects unsupported syntax", () => {
    expect(() => parseMermaidFlowchart("flowchart LR\n  subgraph One\n  A --> B\n  end\n")).toThrow(
      "Only simple flowchart nodes and arrows are supported for conversion.",
    );
  });
});
```

- [ ] **Step 2: Implement parser**

Create `src/lib/mermaidFlowchart.ts` using regex-based parsing for the limited subset:

```ts
const HEADER_PATTERN = /^flowchart\s+(LR|TD)\s*$/;
const EDGE_PATTERN = /^(.+?)\s*-->(?:\|([^|]+)\|)?\s*(.+)$/;
const NODE_PATTERNS = [
  { shape: "database", pattern: /^([A-Za-z][\w-]*)\[\((.+)\)\]$/ },
  { shape: "decision", pattern: /^([A-Za-z][\w-]*)\{(.+)\}$/ },
  { shape: "rectangle", pattern: /^([A-Za-z][\w-]*)\[(.+)\]$/ },
  { shape: "rounded", pattern: /^([A-Za-z][\w-]*)\((.+)\)$/ },
] as const;
```

Rules:

- Trim blank lines.
- First non-empty line must match `flowchart LR` or `flowchart TD`.
- Every remaining line must be either a supported edge or node.
- Inline node definitions inside edges should create or update nodes.
- If an edge references a bare node id with no prior declaration, create a rectangle node with label equal to the id.
- Throw `Only simple flowchart nodes and arrows are supported for conversion.` for unsupported syntax.

- [ ] **Step 3: Run parser tests**

Run:

```bash
npm run test:run -- src/lib/mermaidFlowchart.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/mermaidFlowchart.ts src/lib/mermaidFlowchart.test.ts
git commit -m "feat: parse simple mermaid flowcharts"
```

---

### Task 6: Mermaid to Excalidraw Conversion

**Files:**
- Create: `src/lib/mermaidToExcalidraw.ts`
- Create: `src/lib/mermaidToExcalidraw.test.ts`
- Modify: `src/components/MermaidEditorView.tsx`
- Modify: `src/components/MermaidEditorView.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes `parseMermaidFlowchart`.
- Produces:

```ts
export function mermaidToExcalidrawScene(source: string): ExcalidrawScene;
```

- Produces editor behavior: `Convert to Excalidraw` creates a new `.excalidraw` design in the same project and opens it.

- [ ] **Step 1: Write converter tests**

Create `src/lib/mermaidToExcalidraw.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isExcalidrawScene } from "./sceneValidation";
import { mermaidToExcalidrawScene } from "./mermaidToExcalidraw";

describe("mermaidToExcalidrawScene", () => {
  it("creates a valid Excalidraw scene from a simple flowchart", () => {
    const scene = mermaidToExcalidrawScene("flowchart LR\n  A[Start] -->|go| B[Done]\n");

    expect(isExcalidrawScene(scene)).toBe(true);
    expect(scene.elements.some((element) => element.type === "rectangle")).toBe(true);
    expect(scene.elements.some((element) => element.type === "arrow")).toBe(true);
    expect(JSON.stringify(scene.elements)).toContain("Start");
    expect(JSON.stringify(scene.elements)).toContain("Done");
    expect(JSON.stringify(scene.elements)).toContain("go");
  });
});
```

- [ ] **Step 2: Implement converter**

Create `src/lib/mermaidToExcalidraw.ts`:

```ts
import { parseMermaidFlowchart } from "./mermaidFlowchart";
import { prepareSceneForStorage } from "./excalidrawScene";
import type { ExcalidrawScene } from "../types/excalidraw";
```

Implement stable ids:

```ts
function elementId(prefix: string, index: number) {
  return `${prefix}-${index.toString(36).padStart(4, "0")}`;
}
```

Layout:

- Node size: `190 x 76`.
- Gap: `90`.
- `LR`: x increases by graph level, y by sibling index.
- `TD`: y increases by graph level, x by sibling index.
- If level calculation is ambiguous, fall back to source order.

Scene creation:

- Rectangle and rounded map to Excalidraw `rectangle`.
- Decision maps to Excalidraw `diamond`.
- Database maps to a rectangle plus text label in the first version.
- Each node gets one shape element and one text element.
- Each edge gets one `arrow` element and optional text label near midpoint.

- [ ] **Step 3: Write editor conversion test**

Add to `src/components/MermaidEditorView.test.tsx`:

```tsx
it("converts Mermaid source into a new Excalidraw design", async () => {
  vi.mocked(designApi.createDesign).mockResolvedValue({
    project: "Docs",
    name: "Flow Excalidraw",
    fileName: "Flow Excalidraw.excalidraw",
    kind: "excalidraw",
    content: {
      type: "excalidraw",
      version: 2,
      source: "banguesesdraw",
      elements: [],
      appState: {},
      files: {},
    },
  });
  vi.mocked(designApi.writeDesign).mockResolvedValue({
    project: "Docs",
    name: "Flow Excalidraw",
    fileName: "Flow Excalidraw.excalidraw",
    kind: "excalidraw",
    content: {
      type: "excalidraw",
      version: 2,
      source: "banguesesdraw",
      elements: [],
      appState: {},
      files: {},
    },
  });
  const onOpenExcalidraw = vi.fn();

  render(
    <MermaidEditorView
      project="Docs"
      fileName="Flow.mmd"
      initialSource="flowchart LR\n  A[Start] --> B[Done]\n"
      onBack={vi.fn()}
      onDesignMoved={vi.fn()}
      onOpenExcalidraw={onOpenExcalidraw}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: /convert to excalidraw/i }));

  expect(designApi.createDesign).toHaveBeenCalledWith("Docs", "Flow Excalidraw", "excalidraw");
  expect(onOpenExcalidraw).toHaveBeenCalledWith("Docs", "Flow Excalidraw.excalidraw", expect.any(Object));
});
```

- [ ] **Step 4: Wire conversion button**

Extend `MermaidEditorViewProps`:

```ts
onOpenExcalidraw: (project: string, fileName: string, initialScene: ExcalidrawScene) => void;
```

Add button and handler:

```ts
const handleConvert = async () => {
  setError(null);
  const scene = mermaidToExcalidrawScene(source);
  const baseName = fileName.replace(/\.mmd$/, "");
  const design = await designApi.createDesign(project, `${baseName} Excalidraw`, "excalidraw");
  const saved = await designApi.writeDesign(project, design.fileName, scene);

  if (!isExcalidrawScene(saved.content)) {
    throw new Error("Converted Excalidraw scene was invalid.");
  }

  onOpenExcalidraw(saved.project, saved.fileName, prepareSceneForExcalidraw(saved.content));
};
```

Catch parser errors and show them in the editor error banner.

- [ ] **Step 5: Update App callback**

Pass `onOpenExcalidraw` from `App.tsx`:

```tsx
onOpenExcalidraw={(project, fileName, initialScene) =>
  setOpenDesign({ kind: "excalidraw", project, fileName, initialScene })
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm run test:run -- src/lib/mermaidFlowchart.test.ts src/lib/mermaidToExcalidraw.test.ts src/components/MermaidEditorView.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/mermaidToExcalidraw.ts src/lib/mermaidToExcalidraw.test.ts src/components/MermaidEditorView.tsx src/components/MermaidEditorView.test.tsx src/App.tsx
git commit -m "feat: convert mermaid flowcharts to excalidraw"
```

---

### Task 7: Full Verification and README Update

**Files:**
- Modify: `README.md`
- Modify: `LICENSES.md` if `mermaid` license attribution is not already covered by package metadata.

**Interfaces:**
- Consumes all prior tasks.
- Produces verified app behavior and user-facing README notes.

- [ ] **Step 1: Update README feature description**

Add a concise section:

```md
## Mermaid flowcharts

BanguesesDraw can store Mermaid flowcharts locally as `.mmd` files beside Excalidraw designs. Mermaid mode is useful for structured diagrams and lower-cost AI generation. Supported conversion to Excalidraw currently focuses on simple `flowchart LR` and `flowchart TD` diagrams with basic nodes and arrows.
```

- [ ] **Step 2: Run complete frontend checks**

Run:

```bash
npm run test:run
npm run build
```

Expected: PASS.

- [ ] **Step 3: Run backend checks**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: PASS.

- [ ] **Step 4: Manual smoke test in Tauri**

Run:

```bash
npm run tauri:dev
```

Verify:

- Existing Excalidraw designs still open.
- `New Mermaid flowchart` creates and opens a `.mmd` file.
- Mermaid preview renders `flowchart LR\n  A[Start] --> B[Done]\n`.
- Invalid Mermaid shows a preview error without blocking editing.
- Manual save and autosave persist Mermaid changes.
- AI Mermaid generation creates a `.mmd` file when an API key is configured.
- AI Mermaid modify changes existing `.mmd` source.
- `Convert to Excalidraw` creates and opens a new `.excalidraw` design.

- [ ] **Step 5: Commit**

```bash
git add README.md LICENSES.md
git commit -m "docs: describe mermaid flowchart mode"
```
