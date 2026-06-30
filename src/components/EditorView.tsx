import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAutosave } from "../hooks/useAutosave";
import { designApi } from "../lib/designApi";
import { isExcalidrawScene } from "../lib/sceneValidation";
import type { ExcalidrawScene } from "../types/excalidraw";

type EditorViewProps = {
  project: string;
  fileName: string;
  onBack: () => void;
};

export function EditorView({ project, fileName, onBack }: EditorViewProps) {
  const [scene, setScene] = useState<ExcalidrawScene | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  }, [fileName, project, sceneKey]);

  const title = useMemo(() => fileName.replace(/\.excalidraw$/, ""), [fileName]);

  return (
    <div className="editor-view">
      <header className="editor-header">
        <button
          type="button"
          className="icon-button"
          onClick={onBack}
          aria-label="Back to library"
          title="Back to library"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="editor-title">
          <span>{project}</span>
          <strong>{title}</strong>
        </div>
        <div className="save-cluster">
          <span className={`save-status ${autosave.status}`}>{autosave.status}</span>
          <button type="button" className="save-button" onClick={() => void autosave.saveNow()}>
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
    </div>
  );
}
