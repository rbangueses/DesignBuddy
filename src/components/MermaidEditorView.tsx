import { save } from "@tauri-apps/plugin-dialog";
import { ArrowLeft, Bot, Copy, Download, Pencil, Save, Shuffle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { designApi } from "../lib/designApi";
import { loadAiSettings, type AiSettings } from "../lib/aiSettings";
import { normaliseMermaidContent } from "../lib/mermaidSource";
import { mermaidToExcalidrawScene } from "../lib/mermaidToExcalidraw";
import { prepareSceneForExcalidraw } from "../lib/excalidrawScene";
import { isExcalidrawScene } from "../lib/sceneValidation";
import type { ExcalidrawScene } from "../types/excalidraw";
import { AiMermaidModifyDialog } from "./AiMermaidModifyDialog";
import { MermaidPreview } from "./MermaidPreview";
import { RenameDialog } from "./RenameDialog";

type MermaidEditorViewProps = {
  project: string;
  fileName: string;
  initialSource: string;
  onBack: () => void;
  onDesignMoved: (project: string, fileName: string, initialSource: string) => void;
  onOpenExcalidraw?: (
    project: string,
    fileName: string,
    initialScene: ExcalidrawScene,
  ) => void;
};

type SaveStatus = "saved" | "saving" | "unsaved" | "error";
type PendingAction = "rename" | "duplicate" | "ai-modify" | null;

export function MermaidEditorView({
  project,
  fileName,
  initialSource,
  onBack,
  onDesignMoved,
  onOpenExcalidraw,
}: MermaidEditorViewProps) {
  const [source, setSource] = useState(initialSource);
  const [savedSource, setSavedSource] = useState(initialSource);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isFileActionRunning, setIsFileActionRunning] = useState(false);
  const [aiSettings] = useState<AiSettings>(() => loadAiSettings());
  const title = useMemo(() => fileName.replace(/\.mmd$/, ""), [fileName]);
  const isBusy = saveStatus === "saving" || isFileActionRunning;

  const saveNow = useCallback(async () => {
    setSaveStatus("saving");
    setError(null);

    try {
      const design = await designApi.writeDesign(project, fileName, { source });
      const content = normaliseMermaidContent(design.content);
      setSavedSource(content.source);
      setSource(content.source);
      setSaveStatus("saved");
      return content.source;
    } catch (saveError) {
      setSaveStatus("error");
      setError(String(saveError));
      throw saveError;
    }
  }, [fileName, project, source]);

  useEffect(() => {
    if (source === savedSource || saveStatus === "saving") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveNow().catch(() => undefined);
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [saveNow, saveStatus, savedSource, source]);

  const handleBack = useCallback(async () => {
    if (isBusy) {
      return;
    }

    if (source === savedSource) {
      onBack();
      return;
    }

    try {
      await saveNow();
      onBack();
    } catch {
      return;
    }
  }, [isBusy, onBack, saveNow, savedSource, source]);

  const handleRename = useCallback(
    async (name: string) => {
      setIsFileActionRunning(true);

      try {
        const latestSource = source === savedSource ? source : await saveNow();
        const design = await designApi.renameDesign(project, fileName, name);
        setPendingAction(null);
        onDesignMoved(design.project, design.fileName, latestSource);
      } finally {
        setIsFileActionRunning(false);
      }
    },
    [fileName, onDesignMoved, project, saveNow, savedSource, source],
  );

  const handleDuplicate = useCallback(
    async (name: string) => {
      setIsFileActionRunning(true);

      try {
        const latestSource = source === savedSource ? source : await saveNow();
        const design = await designApi.duplicateDesign(project, fileName, name);
        setPendingAction(null);
        onDesignMoved(design.project, design.fileName, latestSource);
      } finally {
        setIsFileActionRunning(false);
      }
    },
    [fileName, onDesignMoved, project, saveNow, savedSource, source],
  );

  const handleExport = useCallback(async () => {
    const targetPath = await save({
      title: "Export design",
      defaultPath: fileName,
      filters: [{ name: "Mermaid", extensions: ["mmd"] }],
    });

    if (typeof targetPath !== "string") {
      return;
    }

    setIsFileActionRunning(true);
    setError(null);

    try {
      if (source !== savedSource) {
        await saveNow();
      }
      await designApi.exportDesign(project, fileName, targetPath);
    } catch (exportError) {
      setError(String(exportError));
    } finally {
      setIsFileActionRunning(false);
    }
  }, [fileName, project, saveNow, savedSource, source]);

  const handleConvert = useCallback(async () => {
    setIsFileActionRunning(true);
    setError(null);

    try {
      const scene = mermaidToExcalidrawScene(source);
      const baseName = fileName.replace(/\.mmd$/, "");
      const design = await designApi.createDesign(
        project,
        `${baseName} Excalidraw`,
        "excalidraw",
      );
      const saved = await designApi.writeDesign(project, design.fileName, scene);

      if (!isExcalidrawScene(saved.content)) {
        throw new Error("Converted Excalidraw scene was invalid.");
      }

      onOpenExcalidraw?.(
        saved.project,
        saved.fileName,
        prepareSceneForExcalidraw(saved.content),
      );
    } catch (convertError) {
      setError(String(convertError));
    } finally {
      setIsFileActionRunning(false);
    }
  }, [fileName, onOpenExcalidraw, project, source]);

  return (
    <div className="editor-view mermaid-editor-view">
      <header className="editor-header">
        <button
          type="button"
          className="icon-button"
          onClick={() => void handleBack()}
          aria-label="Back to library"
          title="Back to library"
          disabled={isBusy}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="editor-title">
          <span>{project}</span>
          <strong>{title}</strong>
        </div>
        <div className="save-cluster">
          <button
            type="button"
            className="icon-button"
            onClick={() => setPendingAction("ai-modify")}
            aria-label="AI modify"
            title="AI modify"
            disabled={isBusy}
          >
            <Bot size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setPendingAction("rename")}
            aria-label="Rename design"
            title="Rename design"
            disabled={isBusy}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setPendingAction("duplicate")}
            aria-label="Duplicate design"
            title="Duplicate design"
            disabled={isBusy}
          >
            <Copy size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => void handleExport()}
            aria-label="Export design"
            title="Export design"
            disabled={isBusy}
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            onClick={() => void handleConvert()}
            disabled={isBusy}
          >
            <Shuffle size={16} />
            Convert to Excalidraw
          </button>
          <span className={`save-status ${saveStatus}`}>{saveStatus}</span>
          <button
            type="button"
            className="save-button"
            onClick={() => void saveNow()}
            disabled={isBusy}
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </header>
      {error ? <div className="save-error">{error}</div> : null}
      <main className="mermaid-editor-grid">
        <section className="mermaid-source-panel">
          <div className="mermaid-panel-header">Source</div>
          <textarea
            aria-label="Mermaid source"
            value={source}
            onChange={(event) => {
              const nextSource = event.target.value;
              setSource(nextSource);
              setSaveStatus(nextSource === savedSource ? "saved" : "unsaved");
            }}
          />
        </section>
        <section className="mermaid-preview-panel">
          <div className="mermaid-panel-header">Preview</div>
          <MermaidPreview source={source} />
        </section>
      </main>
      {pendingAction === "rename" ? (
        <RenameDialog
          title="Rename design"
          inputLabel="Design name"
          initialName={title}
          submitLabel="Rename"
          onCancel={() => setPendingAction(null)}
          onSubmit={handleRename}
        />
      ) : null}
      {pendingAction === "ai-modify" ? (
        <AiMermaidModifyDialog
          settings={aiSettings}
          source={source}
          onCancel={() => setPendingAction(null)}
          onModified={(nextSource) => {
            setSource(nextSource);
            setSaveStatus(nextSource === savedSource ? "saved" : "unsaved");
            setPendingAction(null);
          }}
        />
      ) : null}
      {pendingAction === "duplicate" ? (
        <RenameDialog
          title="Duplicate design"
          inputLabel="Design name"
          initialName={`${title} Copy`}
          submitLabel="Duplicate"
          onCancel={() => setPendingAction(null)}
          onSubmit={handleDuplicate}
        />
      ) : null}
    </div>
  );
}
