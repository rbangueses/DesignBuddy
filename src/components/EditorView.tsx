import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { ArrowLeft, Copy, Pencil, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAutosave } from "../hooks/useAutosave";
import { designApi } from "../lib/designApi";
import { isExcalidrawScene } from "../lib/sceneValidation";
import type { ExcalidrawScene } from "../types/excalidraw";
import { RenameDialog } from "./RenameDialog";

type EditorViewProps = {
  project: string;
  fileName: string;
  initialScene?: ExcalidrawScene;
  onBack: () => void;
  onDesignMoved: (
    project: string,
    fileName: string,
    initialScene: ExcalidrawScene,
  ) => void;
};

type PendingAction = "rename" | "duplicate" | null;

export function EditorView({
  project,
  fileName,
  initialScene,
  onBack,
  onDesignMoved,
}: EditorViewProps) {
  const [scene, setScene] = useState<ExcalidrawScene | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isFileActionRunning, setIsFileActionRunning] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const sceneKey = `${project}/${fileName}`;
  const [loadedSceneKey, setLoadedSceneKey] = useState<string | null>(null);
  const autosave = useAutosave({
    project,
    fileName,
    scene,
    enabled: Boolean(scene) && loadedSceneKey === sceneKey,
  });

  useEffect(() => {
    let cancelled = false;

    setScene(null);
    setLoadError(null);
    setLoadedSceneKey(null);

    if (initialScene) {
      setScene(initialScene);
      setLoadedSceneKey(sceneKey);
      return () => {
        cancelled = true;
      };
    }

    async function load() {
      try {
        const design = await designApi.readDesign(project, fileName);

        if (!isExcalidrawScene(design.content)) {
          throw new Error("Invalid Excalidraw scene.");
        }

        if (!cancelled) {
          setScene(design.content);
          setLoadedSceneKey(sceneKey);
        }
      } catch (unknownError) {
        if (!cancelled) {
          setLoadError(String(unknownError));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [fileName, initialScene, project, sceneKey]);

  const title = useMemo(() => fileName.replace(/\.excalidraw$/, ""), [fileName]);

  const handleBack = useCallback(async () => {
    if (isLeaving) {
      return;
    }

    if (!scene || autosave.status === "saved") {
      onBack();
      return;
    }

    setIsLeaving(true);

    try {
      const didSave = await autosave.saveNow();

      if (didSave) {
        onBack();
      }
    } finally {
      setIsLeaving(false);
    }
  }, [autosave, isLeaving, onBack, scene]);

  const getLatestSavedScene = useCallback(async () => {
    if (!scene) {
      throw new Error("Design is still loading.");
    }

    if (autosave.status === "saved") {
      return scene;
    }

    const didSave = await autosave.saveNow();

    if (!didSave) {
      throw new Error(autosave.error ?? "Save failed.");
    }

    return scene;
  }, [autosave, scene]);

  const handleRename = useCallback(
    async (name: string) => {
      setIsFileActionRunning(true);

      try {
        const latestScene = await getLatestSavedScene();
        const design = await designApi.renameDesign(project, fileName, name);
        setPendingAction(null);
        onDesignMoved(design.project, design.fileName, latestScene);
      } finally {
        setIsFileActionRunning(false);
      }
    },
    [fileName, getLatestSavedScene, onDesignMoved, project],
  );

  const handleDuplicate = useCallback(
    async (name: string) => {
      setIsFileActionRunning(true);

      try {
        const latestScene = await getLatestSavedScene();
        const design = await designApi.duplicateDesign(project, fileName, name);
        setPendingAction(null);
        onDesignMoved(design.project, design.fileName, latestScene);
      } finally {
        setIsFileActionRunning(false);
      }
    },
    [fileName, getLatestSavedScene, onDesignMoved, project],
  );

  const isBusy = isLeaving || isFileActionRunning;

  return (
    <div className="editor-view">
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
            onClick={() => setPendingAction("rename")}
            aria-label="Rename design"
            title="Rename design"
            disabled={isBusy || !scene}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setPendingAction("duplicate")}
            aria-label="Duplicate design"
            title="Duplicate design"
            disabled={isBusy || !scene}
          >
            <Copy size={16} />
          </button>
          <span className={`save-status ${autosave.status}`}>{autosave.status}</span>
          <button
            type="button"
            className="save-button"
            onClick={() => void autosave.saveNow()}
            disabled={isBusy || autosave.status === "saving"}
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </header>
      {loadError ? (
        <main className="empty-state">{loadError}</main>
      ) : scene ? (
        <main className="canvas-wrap">
          <Excalidraw
            key={sceneKey}
            initialData={scene as never}
            onChange={(elements, appState, files) => {
              setScene((currentScene) => ({
                type: "excalidraw",
                version: currentScene?.version,
                source: currentScene?.source,
                elements: elements as unknown[],
                appState: appState as unknown as Record<string, unknown>,
                files: files as Record<string, unknown>,
              }));
            }}
          />
          {autosave.error ? <div className="save-error">{autosave.error}</div> : null}
        </main>
      ) : (
        <main className="empty-state">Loading editor...</main>
      )}
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
