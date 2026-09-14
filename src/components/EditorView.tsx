import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { save } from "@tauri-apps/plugin-dialog";
import {
  ArrowLeft,
  Bot,
  Copy,
  Pencil,
  Save,
  Shapes,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAutosave } from "../hooks/useAutosave";
import { loadAiSettings, type AiSettings } from "../lib/aiSettings";
import { designApi } from "../lib/designApi";
import {
  prepareSceneForExcalidraw,
  prepareSceneForStorage,
} from "../lib/excalidrawScene";
import { exportSceneToDrawioXml } from "../lib/excalidrawToDrawio";
import { isExcalidrawScene } from "../lib/sceneValidation";
import {
  createTwilioComponentElements,
  getTwilioComponent,
  getTwilioComponentColors,
  TWILIO_COMPONENT_FONT_OPTIONS,
  TWILIO_COMPONENT_GROUPS,
  TWILIO_COMPONENT_HEIGHT,
  TWILIO_COMPONENT_WIDTH,
  type TwilioComponentFontFamily,
} from "../lib/twilioComponents";
import {
  loadTwilioComponentSettings,
  saveTwilioComponentSettings,
  type TwilioComponentSettings,
} from "../lib/twilioComponentSettings";
import {
  DEFAULT_TWILIO_SHORTCUT_SETTINGS,
  findTwilioComponentByShortcut,
  getDuplicateTwilioShortcutKeys,
  loadTwilioShortcutSettings,
  normalizeTwilioShortcut,
  saveTwilioShortcutSettings,
  type TwilioShortcutSettings,
} from "../lib/twilioShortcuts";
import type { ExcalidrawScene } from "../types/excalidraw";
import { AiModifyDialog } from "./AiModifyDialog";
import { ExportMenu } from "./ExportMenu";
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

type CanvasPointerPosition = {
  clientX: number;
  clientY: number;
};

const [
  communicationsGroup,
  trustAndIdentityGroup,
  conversationsSuiteGroup,
  builderToolsGroup,
  dataGroup,
] = TWILIO_COMPONENT_GROUPS;

const TWILIO_COMPONENT_GROUP_COLUMNS = [
  [communicationsGroup],
  [conversationsSuiteGroup, dataGroup, trustAndIdentityGroup],
  [builderToolsGroup],
];

function isEditableElement(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

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

function getPointerInsertionPosition(
  appState: Record<string, unknown> | undefined,
  pointer: CanvasPointerPosition,
) {
  const zoom = zoomFromAppState(appState);
  const offsetLeft = numberFromAppState(appState, "offsetLeft", 0);
  const offsetTop = numberFromAppState(appState, "offsetTop", 0);
  const scrollX = numberFromAppState(appState, "scrollX", 0);
  const scrollY = numberFromAppState(appState, "scrollY", 0);

  return {
    x:
      (pointer.clientX - offsetLeft) / zoom -
      scrollX -
      TWILIO_COMPONENT_WIDTH / 2,
    y:
      (pointer.clientY - offsetTop) / zoom -
      scrollY -
      TWILIO_COMPONENT_HEIGHT / 2,
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
  const [twilioShortcutSettings, setTwilioShortcutSettings] =
    useState<TwilioShortcutSettings>(() => loadTwilioShortcutSettings());
  const [twilioComponentSettings, setTwilioComponentSettings] =
    useState<TwilioComponentSettings>(() => loadTwilioComponentSettings());
  const [isCustomizingTwilioShortcuts, setIsCustomizingTwilioShortcuts] =
    useState(false);
  const [twilioShortcutError, setTwilioShortcutError] = useState<string | null>(
    null,
  );
  const latestSceneRef = useRef<ExcalidrawScene | null>(null);
  const canvasPointerRef = useRef<CanvasPointerPosition | null>(null);
  const sceneKey = `${project}/${fileName}`;
  const [loadedSceneKey, setLoadedSceneKey] = useState<string | null>(null);
  const autosave = useAutosave({
    project,
    fileName,
    scene: autosaveScene,
    enabled: Boolean(autosaveScene) && loadedSceneKey === sceneKey,
  });

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

  const handleExportDrawio = useCallback(async () => {
    const targetPath = await save({
      title: "Export draw.io",
      defaultPath: `${title}.drawio`,
      filters: [{ name: "draw.io", extensions: ["drawio"] }],
    });

    if (typeof targetPath !== "string") {
      return;
    }

    setIsFileActionRunning(true);
    setLoadError(null);

    try {
      const latestScene = await getLatestSavedScene();
      await designApi.exportDrawio(targetPath, exportSceneToDrawioXml(latestScene));
    } catch (unknownError) {
      setLoadError(String(unknownError));
    } finally {
      setIsFileActionRunning(false);
    }
  }, [getLatestSavedScene, title]);

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
        canvasPointerRef.current
          ? getPointerInsertionPosition(currentScene.appState, canvasPointerRef.current)
          : getVisibleCenterInsertionPosition(currentScene.appState, insertionIndex),
        twilioComponentSettings.fontFamily,
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
      setIsCustomizingTwilioShortcuts(false);
      setTwilioShortcutError(null);
      setTwilioShortcutSettings(loadTwilioShortcutSettings());
    },
    [twilioComponentSettings.fontFamily],
  );

  const updateTwilioComponentFont = useCallback(
    (fontFamily: TwilioComponentFontFamily) => {
      const settings = { fontFamily };
      setTwilioComponentSettings(settings);
      saveTwilioComponentSettings(settings);
    },
    [],
  );

  const updateTwilioShortcut = useCallback(
    (componentId: Parameters<typeof createTwilioComponentElements>[0], value: string) => {
      setTwilioShortcutSettings((settings) => ({
        ...settings,
        shortcuts: {
          ...settings.shortcuts,
          [componentId]: normalizeTwilioShortcut(value),
        },
      }));
      setTwilioShortcutError(null);
    },
    [],
  );

  const handleSaveTwilioShortcuts = useCallback(() => {
    const duplicateKeys = getDuplicateTwilioShortcutKeys(twilioShortcutSettings);

    if (duplicateKeys.length > 0) {
      setTwilioShortcutError("Each component needs a unique shortcut.");
      return;
    }

    saveTwilioShortcutSettings(twilioShortcutSettings);
    setIsCustomizingTwilioShortcuts(false);
    setTwilioShortcutError(null);
  }, [twilioShortcutSettings]);

  const closeTwilioComponents = useCallback(() => {
    setPendingAction(null);
    setIsCustomizingTwilioShortcuts(false);
    setTwilioShortcutError(null);
    setTwilioShortcutSettings(loadTwilioShortcutSettings());
  }, []);

  useDialogEscape(closeTwilioComponents, pendingAction === "twilio-components");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!initialData || isEditableElement(event.target)) {
        return;
      }

      const opensPalette =
        event.key === "§" ||
        (event.metaKey && event.shiftKey && event.key.toLowerCase() === "t");

      if (opensPalette) {
        event.preventDefault();
        setPendingAction("twilio-components");
        setIsCustomizingTwilioShortcuts(false);
        setTwilioShortcutError(null);
        return;
      }

      const component = findTwilioComponentByShortcut(
        twilioShortcutSettings.shortcuts,
        event.key,
      );
      const isPaletteShortcut =
        pendingAction === "twilio-components" && !isCustomizingTwilioShortcuts;
      const isDirectShortcut =
        pendingAction === null &&
        event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey;

      if (component && isPaletteShortcut) {
        event.preventDefault();
        handleInsertTwilioComponent(component.id);
        return;
      }

      if (component && isDirectShortcut) {
        event.preventDefault();
        handleInsertTwilioComponent(component.id);
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    handleInsertTwilioComponent,
    initialData,
    isCustomizingTwilioShortcuts,
    pendingAction,
    twilioShortcutSettings,
  ]);

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
          <ExportMenu
            disabled={isBusy || !initialData}
            items={[
              {
                id: "excalidraw",
                label: "Excalidraw file",
                description: ".excalidraw",
                onSelect: () => void handleExport(),
              },
              {
                id: "drawio",
                label: "draw.io file",
                description: ".drawio",
                icon: "file-code",
                onSelect: () => void handleExportDrawio(),
              },
            ]}
          />
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
        <main
          className="canvas-wrap"
          onMouseMove={(event) => {
            canvasPointerRef.current = {
              clientX: event.clientX,
              clientY: event.clientY,
            };
          }}
        >
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
          <section
            className="dialog twilio-component-dialog"
            role="dialog"
            aria-label="Twilio components"
          >
            <header className="dialog-header twilio-component-header">
              <div className="twilio-component-title-row">
                <h2>Twilio components</h2>
                <div className="twilio-component-controls">
                  <label className="twilio-component-font">
                    <span>Font</span>
                    <select
                      aria-label="Default component font"
                      value={twilioComponentSettings.fontFamily}
                      onChange={(event) =>
                        updateTwilioComponentFont(
                          Number(event.target.value) as TwilioComponentFontFamily,
                        )
                      }
                    >
                      {TWILIO_COMPONENT_FONT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="secondary-button twilio-shortcuts-button"
                    onClick={() => {
                      setIsCustomizingTwilioShortcuts((isCustomizing) => !isCustomizing);
                      setTwilioShortcutError(null);
                    }}
                  >
                    {isCustomizingTwilioShortcuts ? "Back to palette" : "Customize shortcuts"}
                  </button>
                </div>
              </div>
              {!isCustomizingTwilioShortcuts ? (
                <p className="twilio-component-help">
                  Press a component key to insert it. From the canvas, press Shift plus the key
                  badge to insert a component directly. Cmd+Shift+T reopens this palette.
                </p>
              ) : null}
            </header>
            {isCustomizingTwilioShortcuts ? (
              <section className="twilio-shortcut-settings">
                <p className="settings-help">
                  These keys select components in this palette. From the canvas, use Shift
                  plus a key to insert that component directly.
                </p>
              </section>
            ) : null}
            <div className="twilio-component-groups">
              {TWILIO_COMPONENT_GROUP_COLUMNS.map((groups, columnIndex) => (
                <div
                  className={`twilio-component-column twilio-component-column--${columnIndex + 1}`}
                  key={`column-${columnIndex}`}
                >
                  {groups.map((group) => (
                    <section className="twilio-component-group" key={group.title}>
                      <h3>{group.title}</h3>
                      <div className="twilio-component-grid">
                        {group.componentIds.map((componentId) => {
                          const component = getTwilioComponent(componentId);
                          const colors = getTwilioComponentColors(component);

                          return isCustomizingTwilioShortcuts ? (
                            <label className="twilio-shortcut-option" key={component.id}>
                              <span
                                className="twilio-component-swatch"
                                style={{ backgroundColor: colors.background }}
                                aria-hidden="true"
                              />
                              <span>{component.label}</span>
                              <input
                                aria-label={`Shortcut for ${component.label}`}
                                value={twilioShortcutSettings.shortcuts[component.id].toUpperCase()}
                                onChange={(event) =>
                                  updateTwilioShortcut(component.id, event.target.value)
                                }
                                maxLength={1}
                              />
                            </label>
                          ) : (
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
                              <kbd>{twilioShortcutSettings.shortcuts[component.id].toUpperCase()}</kbd>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ))}
            </div>
            {twilioShortcutError ? (
              <p className="form-error" role="alert">
                {twilioShortcutError}
              </p>
            ) : null}
            <div className="dialog-actions">
              {isCustomizingTwilioShortcuts ? (
                <button
                  type="button"
                  onClick={() => {
                    setTwilioShortcutSettings({
                      shortcuts: { ...DEFAULT_TWILIO_SHORTCUT_SETTINGS.shortcuts },
                    });
                    setTwilioShortcutError(null);
                  }}
                >
                  Reset shortcuts
                </button>
              ) : null}
              <button type="button" onClick={closeTwilioComponents}>
                Cancel
              </button>
              {isCustomizingTwilioShortcuts ? (
                <button type="button" onClick={handleSaveTwilioShortcuts}>
                  Save shortcuts
                </button>
              ) : null}
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
