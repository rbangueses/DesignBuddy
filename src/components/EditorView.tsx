import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  PointerDownState,
} from "@excalidraw/excalidraw/types";
import { save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ArrowLeft,
  Bot,
  Copy,
  FolderInput,
  MousePointer2,
  Pencil,
  Save,
  Shapes,
  StickyNote,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAutosave } from "../hooks/useAutosave";
import { loadAiSettings, type AiSettings } from "../lib/aiSettings";
import {
  loadBoxSelectionSettings,
  overlapsBoxSelection,
  saveBoxSelectionSettings,
  type BoxSelectionMode,
} from "../lib/boxSelection";
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
import { MoveCopyDesignDialog } from "./MoveCopyDesignDialog";
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

type PendingAction = "rename" | "duplicate" | "move" | "ai-modify" | "twilio-components" | null;

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
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [notesStatus, setNotesStatus] = useState<"loading" | "saved" | "saving" | "unsaved" | "error">("loading");
  const [notesError, setNotesError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isFileActionRunning, setIsFileActionRunning] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [sceneRevision, setSceneRevision] = useState(0);
  const [aiSettings] = useState<AiSettings>(() => loadAiSettings());
  const [twilioShortcutSettings, setTwilioShortcutSettings] =
    useState<TwilioShortcutSettings>(() => loadTwilioShortcutSettings());
  const [twilioComponentSettings, setTwilioComponentSettings] =
    useState<TwilioComponentSettings>(() => loadTwilioComponentSettings());
  const [boxSelectionMode, setBoxSelectionMode] = useState<BoxSelectionMode>(
    () => loadBoxSelectionSettings().mode,
  );
  const [isCustomizingTwilioShortcuts, setIsCustomizingTwilioShortcuts] =
    useState(false);
  const [twilioShortcutError, setTwilioShortcutError] = useState<string | null>(
    null,
  );
  const latestSceneRef = useRef<ExcalidrawScene | null>(null);
  const savedNotesRef = useRef("");
  const latestNotesRef = useRef("");
  const canvasPointerRef = useRef<CanvasPointerPosition | null>(null);
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const isClosingRef = useRef(false);
  const sceneKey = `${project}/${fileName}`;
  const [loadedSceneKey, setLoadedSceneKey] = useState<string | null>(null);
  const autosave = useAutosave({
    project,
    fileName,
    scene: autosaveScene,
    enabled: Boolean(autosaveScene) && loadedSceneKey === sceneKey,
  });

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      try {
        const appWindow = getCurrentWindow();
        const removeListener = await appWindow.onCloseRequested(async (event) => {
          if (isClosingRef.current || !latestSceneRef.current) {
            return;
          }

          event.preventDefault();
          setIsLeaving(true);

          const didSave = await autosave.saveNow();
          if (didSave) {
            isClosingRef.current = true;
            await appWindow.close();
          } else {
            setIsLeaving(false);
          }
        });
        if (disposed) {
          removeListener();
        } else {
          unlisten = removeListener;
        }
      } catch {
        // The browser-based test environment does not provide a Tauri window.
      }
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [autosave.saveNow]);

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

  useEffect(() => {
    let cancelled = false;
    savedNotesRef.current = "";
    latestNotesRef.current = "";
    setNotesText("");
    setNotesStatus("loading");
    setNotesError(null);

    void designApi
      .readDiagramNotes(project, fileName)
      .then((notes) => {
        if (cancelled) return;
        savedNotesRef.current = notes.text;
        latestNotesRef.current = notes.text;
        setNotesText(notes.text);
        setNotesStatus("saved");
      })
      .catch((error) => {
        if (!cancelled) {
          setNotesStatus("error");
          setNotesError(String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fileName, project]);

  useEffect(() => {
    if (
      notesStatus === "loading" ||
      notesStatus === "saving" ||
      notesText === savedNotesRef.current
    ) {
      return;
    }

    setNotesStatus("unsaved");
    const timeoutId = window.setTimeout(() => {
      const textToSave = notesText;
      setNotesStatus("saving");
      void designApi
        .writeDiagramNotes(project, fileName, textToSave)
        .then((notes) => {
          savedNotesRef.current = notes.text;
          if (latestNotesRef.current === notes.text) {
            setNotesStatus("saved");
          } else {
            setNotesStatus("unsaved");
          }
        })
        .catch((error) => {
          setNotesStatus("error");
          setNotesError(String(error));
        });
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [fileName, notesStatus, notesText, project]);

  const handleNotesChange = useCallback((text: string) => {
    latestNotesRef.current = text;
    setNotesText(text);
  }, []);

  const title = useMemo(() => fileName.replace(/\.excalidraw$/, ""), [fileName]);

  const handleBack = useCallback(async () => {
    if (isLeaving) {
      return;
    }

    if (!latestSceneRef.current) {
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

  const handleBoxSelectionModeChange = useCallback((mode: BoxSelectionMode) => {
    setBoxSelectionMode(mode);
    saveBoxSelectionSettings({ mode });
  }, []);

  const handleExcalidrawApi = useCallback((api: ExcalidrawImperativeAPI) => {
    excalidrawApiRef.current = api;
  }, []);

  const handleExcalidrawPointerUp = useCallback(
    (
      activeTool: { type: string },
      pointerDownState: PointerDownState,
    ) => {
      if (
        boxSelectionMode !== "overlap" ||
        activeTool.type !== "selection" ||
        !pointerDownState.boxSelection.hasOccurred
      ) {
        return;
      }

      // Excalidraw completes its native wrap selection in the same pointer-up
      // event. Run after it, then add every editable element the marquee touched.
      window.setTimeout(() => {
        const api = excalidrawApiRef.current;
        if (!api) return;

        const selectedElementIds = {
          ...api.getAppState().selectedElementIds,
        };
        const selection = {
          x1: pointerDownState.origin.x,
          y1: pointerDownState.origin.y,
          x2: pointerDownState.lastCoords.x,
          y2: pointerDownState.lastCoords.y,
        };

        for (const element of api.getSceneElements()) {
          if (overlapsBoxSelection(element, selection)) {
            selectedElementIds[element.id] = true;
          }
        }

        api.updateScene({ appState: { selectedElementIds } });
      }, 0);
    },
    [boxSelectionMode],
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
    async (targetProject: string, name: string) => {
      setIsFileActionRunning(true);

      try {
        const latestScene = await getLatestSavedScene();
        const design = targetProject === project
          ? await designApi.duplicateDesign(project, fileName, name)
          : await designApi.copyDesign(project, fileName, targetProject, name);
        setPendingAction(null);
        onDesignMoved(design.project, design.fileName, latestScene);
      } finally {
        setIsFileActionRunning(false);
      }
    },
    [fileName, getLatestSavedScene, onDesignMoved, project],
  );

  const handleMove = useCallback(
    async (targetProject: string, name: string) => {
      setIsFileActionRunning(true);

      try {
        const latestScene = await getLatestSavedScene();
        const design = await designApi.moveDesign(project, fileName, targetProject, name);
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

      const isNotesShortcut =
        pendingAction === null &&
        event.key.toLowerCase() === "n" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        (event.target === document.body ||
          (event.target instanceof HTMLElement &&
            event.target.closest(".canvas-wrap") !== null));

      if (isNotesShortcut) {
        event.preventDefault();
        setIsNotesOpen((isOpen) => !isOpen);
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
  const saveStatusLabel =
    autosave.status === "error"
      ? "Save failed"
      : autosave.status === "unsaved"
        ? "Changes not saved"
        : autosave.isSaveDelayed
          ? "Saving is taking longer than expected"
          : autosave.status;

  return (
    <div className="editor-view">
      <header className="editor-header">
        <button
          type="button"
          className="icon-button editor-header-tooltip"
          onClick={() => void handleBack()}
          aria-label="Back to library"
          data-tooltip="Return to the library."
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
            className={`selection-mode-toggle ${boxSelectionMode === "overlap" ? "is-overlap" : "is-wrap"}`}
            onClick={() =>
              handleBoxSelectionModeChange(
                boxSelectionMode === "contain" ? "overlap" : "contain",
              )
            }
            aria-label={
              boxSelectionMode === "contain"
                ? "Selection mode: wrap"
                : "Selection mode: overlap"
            }
            data-tooltip={
              boxSelectionMode === "contain"
                ? "Wrap: select only elements fully inside the box. Click to select elements the box touches."
                : "Overlap: select elements the box touches. Click to require elements fully inside the box."
            }
            aria-pressed={boxSelectionMode === "overlap"}
            disabled={isBusy || !initialData}
          >
            <MousePointer2 size={16} />
            <span>
              <span className="selection-mode-label">Selection</span>
              <strong>{boxSelectionMode === "overlap" ? "Overlap" : "Wrap"}</strong>
            </span>
          </button>
          <button
            type="button"
            className="icon-button editor-header-tooltip"
            onClick={() => setIsNotesOpen((isOpen) => !isOpen)}
            aria-label={isNotesOpen ? "Hide diagram notes" : "Show diagram notes"}
            data-tooltip={
              isNotesOpen
                ? "Hide notes. Shortcut: N."
                : "Show notes for assumptions, questions, and decisions. Shortcut: N."
            }
            aria-pressed={isNotesOpen}
            disabled={isBusy || !initialData}
          >
            <StickyNote size={16} />
          </button>
          <button
            type="button"
            className="icon-button editor-header-tooltip"
            onClick={() => setPendingAction("twilio-components")}
            aria-label="Twilio components"
            data-tooltip="Add a Twilio component to the canvas."
            disabled={isBusy || !initialData}
          >
            <Shapes size={16} />
          </button>
          <button
            type="button"
            className="icon-button editor-header-tooltip"
            onClick={() => setPendingAction("ai-modify")}
            aria-label="AI modify"
            data-tooltip="Ask AI to update this diagram."
            disabled={isBusy || !initialData}
          >
            <Bot size={16} />
          </button>
          <button
            type="button"
            className="icon-button editor-header-tooltip"
            onClick={() => setPendingAction("rename")}
            aria-label="Rename design"
            data-tooltip="Rename this diagram."
            disabled={isBusy || !initialData}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-button editor-header-tooltip"
            onClick={() => setPendingAction("duplicate")}
            aria-label="Duplicate design"
            data-tooltip="Copy this diagram to this or another project."
            disabled={isBusy || !initialData}
          >
            <Copy size={16} />
          </button>
          <button
            type="button"
            className="icon-button editor-header-tooltip"
            onClick={() => setPendingAction("move")}
            aria-label="Move design"
            data-tooltip="Move this diagram to another project."
            disabled={isBusy || !initialData}
          >
            <FolderInput size={16} />
          </button>
          <ExportMenu
            disabled={isBusy || !initialData}
            tooltip="Export this diagram as an Excalidraw or draw.io file."
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
          <span className={`save-status ${autosave.status}`} aria-live="polite">
            {saveStatusLabel}
          </span>
          <button
            type="button"
            className="save-button editor-header-tooltip"
            onClick={() => void autosave.saveNow()}
            data-tooltip="Save changes now."
            disabled={isBusy || autosave.status === "saving"}
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </header>
      {autosave.status === "error" ? (
        <section className="save-alert" role="alert">
          <div>
            <strong>Changes are not saved</strong>
            <p>{autosave.error ?? "DesignBuddy could not write this diagram to disk."}</p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => void autosave.saveNow()}
            disabled={isBusy}
          >
            Retry save
          </button>
        </section>
      ) : autosave.isSaveDelayed ? (
        <section className="save-alert save-alert-warning" role="status" aria-live="polite">
          <div>
            <strong>Still saving your changes</strong>
            <p>Keep DesignBuddy open until saving finishes. This should normally take only a moment.</p>
          </div>
        </section>
      ) : null}
      {loadError ? (
        <main className="empty-state">{loadError}</main>
      ) : initialData ? (
        <main
          className={`canvas-wrap${isNotesOpen ? " notes-open" : ""}`}
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
            excalidrawAPI={handleExcalidrawApi}
            onPointerUp={handleExcalidrawPointerUp}
            aiEnabled={false}
          />
          {isNotesOpen ? (
            <aside className="diagram-notes-panel" aria-label="Diagram notes">
              <header className="diagram-notes-header">
                <div>
                  <h2>Notes</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setIsNotesOpen(false)}
                  aria-label="Hide diagram notes"
                  title="Hide notes (N)"
                >
                  ×
                </button>
              </header>
              <textarea
                value={notesText}
                onChange={(event) => handleNotesChange(event.target.value)}
                placeholder="Add notes for this diagram…"
                aria-label="Diagram notes"
                disabled={notesStatus === "loading"}
              />
              <footer className={`diagram-notes-status ${notesStatus}`}>
                {notesError ?? (notesStatus === "saving" ? "Saving…" : notesStatus === "unsaved" ? "Unsaved changes" : "Saved with this diagram")}
              </footer>
            </aside>
          ) : null}
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
        <MoveCopyDesignDialog
          mode="copy"
          sourceProject={project}
          initialName={`${title} Copy`}
          onCancel={() => setPendingAction(null)}
          onSubmit={handleDuplicate}
        />
      ) : null}
      {pendingAction === "move" ? (
        <MoveCopyDesignDialog
          mode="move"
          sourceProject={project}
          initialName={title}
          onCancel={() => setPendingAction(null)}
          onSubmit={handleMove}
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
