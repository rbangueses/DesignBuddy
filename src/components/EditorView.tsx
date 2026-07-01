import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { save } from "@tauri-apps/plugin-dialog";
import { ArrowLeft, Bot, Copy, Download, Pencil, Save, Shapes } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAutosave } from "../hooks/useAutosave";
import { loadAiSettings, type AiSettings } from "../lib/aiSettings";
import { designApi } from "../lib/designApi";
import {
  prepareSceneForExcalidraw,
  prepareSceneForStorage,
} from "../lib/excalidrawScene";
import { isExcalidrawScene } from "../lib/sceneValidation";
import {
  createTwilioComponentElements,
  getTwilioComponent,
  getTwilioComponentColors,
  TWILIO_COMPONENT_GROUPS,
  TWILIO_COMPONENT_HEIGHT,
  TWILIO_COMPONENT_WIDTH,
} from "../lib/twilioComponents";
import type { ExcalidrawScene } from "../types/excalidraw";
import { AiModifyDialog } from "./AiModifyDialog";
import { RenameDialog } from "./RenameDialog";
import { useDialogEscape } from "./useDialogEscape";

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

type PendingAction = "rename" | "duplicate" | "ai-modify" | "twilio-components" | null;

function numberFromAppState(
  appState: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
) {
  const value = appState?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function zoomFromAppState(appState: Record<string, unknown> | undefined) {
  const zoom = appState?.zoom;

  if (
    zoom &&
    typeof zoom === "object" &&
    "value" in zoom &&
    typeof zoom.value === "number" &&
    Number.isFinite(zoom.value) &&
    zoom.value > 0
  ) {
    return zoom.value;
  }

  return 1;
}

function getVisibleCenterInsertionPosition(
  appState: Record<string, unknown> | undefined,
  insertionIndex: number,
) {
  const width = numberFromAppState(appState, "width", 0);
  const height = numberFromAppState(appState, "height", 0);

  if (width <= 0 || height <= 0) {
    return {
      x: 120 + (insertionIndex % 3) * 270,
      y: 120 + Math.floor(insertionIndex / 3) * 130,
    };
  }

  const zoom = zoomFromAppState(appState);
  const offsetLeft = numberFromAppState(appState, "offsetLeft", 0);
  const offsetTop = numberFromAppState(appState, "offsetTop", 0);
  const scrollX = numberFromAppState(appState, "scrollX", 0);
  const scrollY = numberFromAppState(appState, "scrollY", 0);
  const clientX = width / 2 + offsetLeft;
  const clientY = height / 2 + offsetTop;
  const sceneCenterX = (clientX - offsetLeft) / zoom - scrollX;
  const sceneCenterY = (clientY - offsetTop) / zoom - scrollY;

  return {
    x: sceneCenterX - TWILIO_COMPONENT_WIDTH / 2 + (insertionIndex % 3) * 32,
    y:
      sceneCenterY -
      TWILIO_COMPONENT_HEIGHT / 2 +
      Math.floor(insertionIndex / 3) * 32,
  };
}

export function EditorView({
  project,
  fileName,
  initialScene,
  onBack,
  onDesignMoved,
}: EditorViewProps) {
  const [initialData, setInitialData] = useState<ExcalidrawScene | null>(null);
  const [autosaveScene, setAutosaveScene] = useState<ExcalidrawScene | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isFileActionRunning, setIsFileActionRunning] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [sceneRevision, setSceneRevision] = useState(0);
  const [aiSettings] = useState<AiSettings>(() => loadAiSettings());
  const latestSceneRef = useRef<ExcalidrawScene | null>(null);
  const sceneKey = `${project}/${fileName}`;
  const [loadedSceneKey, setLoadedSceneKey] = useState<string | null>(null);
  const autosave = useAutosave({
    project,
    fileName,
    scene: autosaveScene,
    enabled: Boolean(autosaveScene) && loadedSceneKey === sceneKey,
  });

  useDialogEscape(
    () => setPendingAction(null),
    pendingAction === "twilio-components",
  );

  useEffect(() => {
    let cancelled = false;

    setInitialData(null);
    setAutosaveScene(null);
    latestSceneRef.current = null;
    setLoadError(null);
    setLoadedSceneKey(null);
    setSceneRevision((revision) => revision + 1);

    if (initialScene) {
      const preparedScene = prepareSceneForExcalidraw(initialScene);
      latestSceneRef.current = preparedScene;
      setInitialData(preparedScene);
      setAutosaveScene(preparedScene);
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
          const preparedScene = prepareSceneForExcalidraw(design.content);
          latestSceneRef.current = preparedScene;
          setInitialData(preparedScene);
          setAutosaveScene(preparedScene);
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

    if (!latestSceneRef.current || autosave.status === "saved") {
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
  }, [autosave, isLeaving, onBack]);

  const getLatestSavedScene = useCallback(async () => {
    const latestScene = latestSceneRef.current;

    if (!latestScene) {
      throw new Error("Design is still loading.");
    }

    if (autosave.status === "saved") {
      return latestScene;
    }

    const didSave = await autosave.saveNow();

    if (!didSave) {
      throw new Error(autosave.error ?? "Save failed.");
    }

    return latestScene;
  }, [autosave]);

  const handleSceneChange = useCallback(
    (
      elements: readonly unknown[],
      appState: Record<string, unknown>,
      files: Record<string, unknown>,
    ) => {
      const currentScene = latestSceneRef.current;
      const nextScene = prepareSceneForStorage({
        type: "excalidraw",
        version: currentScene?.version,
        source: currentScene?.source,
        elements: elements as unknown[],
        appState,
        files,
      });

      latestSceneRef.current = nextScene;
      setAutosaveScene(nextScene);
    },
    [],
  );

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

  const handleExport = useCallback(async () => {
    const targetPath = await save({
      title: "Export design",
      defaultPath: fileName,
      filters: [{ name: "Excalidraw", extensions: ["excalidraw"] }],
    });

    if (typeof targetPath !== "string") {
      return;
    }

    setIsFileActionRunning(true);
    setLoadError(null);

    try {
      await getLatestSavedScene();
      await designApi.exportDesign(project, fileName, targetPath);
    } catch (unknownError) {
      setLoadError(String(unknownError));
    } finally {
      setIsFileActionRunning(false);
    }
  }, [fileName, getLatestSavedScene, project]);

  const handleAiModified = useCallback((scene: ExcalidrawScene) => {
    const preparedScene = prepareSceneForExcalidraw(scene);
    latestSceneRef.current = preparedScene;
    setInitialData(preparedScene);
    setAutosaveScene(preparedScene);
    setSceneRevision((revision) => revision + 1);
    setPendingAction(null);
  }, []);

  const handleInsertTwilioComponent = useCallback(
    (componentId: Parameters<typeof createTwilioComponentElements>[0]) => {
      const currentScene = latestSceneRef.current;

      if (!currentScene) {
        return;
      }

      const insertionIndex = Math.floor(currentScene.elements.length / 2);
      const insertedElements = createTwilioComponentElements(
        componentId,
        getVisibleCenterInsertionPosition(currentScene.appState, insertionIndex),
      );
      const nextScene = prepareSceneForExcalidraw({
        ...currentScene,
        elements: [...currentScene.elements, ...insertedElements],
      });

      latestSceneRef.current = nextScene;
      setInitialData(nextScene);
      setAutosaveScene(nextScene);
      setSceneRevision((revision) => revision + 1);
      setPendingAction(null);
    },
    [],
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
            onClick={() => setPendingAction("twilio-components")}
            aria-label="Twilio components"
            title="Twilio components"
            disabled={isBusy || !initialData}
          >
            <Shapes size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setPendingAction("ai-modify")}
            aria-label="AI modify"
            title="AI modify"
            disabled={isBusy || !initialData}
          >
            <Bot size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setPendingAction("rename")}
            aria-label="Rename design"
            title="Rename design"
            disabled={isBusy || !initialData}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setPendingAction("duplicate")}
            aria-label="Duplicate design"
            title="Duplicate design"
            disabled={isBusy || !initialData}
          >
            <Copy size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => void handleExport()}
            aria-label="Export design"
            title="Export design"
            disabled={isBusy || !initialData}
          >
            <Download size={16} />
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
      ) : initialData ? (
        <main className="canvas-wrap">
          <Excalidraw
            key={`${sceneKey}/${sceneRevision}`}
            initialData={initialData as never}
            onChange={handleSceneChange as never}
            aiEnabled={false}
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
      {pendingAction === "twilio-components" ? (
        <div className="dialog-backdrop">
          <section className="dialog twilio-component-dialog" role="dialog" aria-label="Twilio components">
            <header className="dialog-header">
              <h2>Twilio components</h2>
            </header>
            <div className="twilio-component-groups">
              {TWILIO_COMPONENT_GROUPS.map((group) => (
                <section className="twilio-component-group" key={group.title}>
                  <h3>{group.title}</h3>
                  <div className="twilio-component-grid">
                    {group.componentIds.map((componentId) => {
                      const component = getTwilioComponent(componentId);
                      const colors = getTwilioComponentColors(component);

                      return (
                        <button
                          key={component.id}
                          type="button"
                          className="twilio-component-option"
                          onClick={() => handleInsertTwilioComponent(component.id)}
                          aria-label={`Insert ${component.label}`}
                        >
                          <span
                            className="twilio-component-swatch"
                            style={{ backgroundColor: colors.background }}
                            aria-hidden="true"
                          />
                          <span>{component.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            <div className="dialog-actions">
              <button type="button" onClick={() => setPendingAction(null)}>
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {pendingAction === "ai-modify" && latestSceneRef.current ? (
        <AiModifyDialog
          settings={aiSettings}
          scene={latestSceneRef.current}
          onCancel={() => setPendingAction(null)}
          onModified={handleAiModified}
        />
      ) : null}
    </div>
  );
}
