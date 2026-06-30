import { useCallback, useEffect, useRef, useState } from "react";
import { designApi } from "../lib/designApi";
import type { ExcalidrawScene } from "../types/excalidraw";

export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

type UseAutosaveArgs = {
  project: string;
  fileName: string;
  scene: ExcalidrawScene | null;
  enabled: boolean;
};

function serializeScene(scene: ExcalidrawScene) {
  return JSON.stringify(scene);
}

export function useAutosave({
  project,
  fileName,
  scene,
  enabled,
}: UseAutosaveArgs) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef<string | null>(null);
  const pendingTimeout = useRef<number | null>(null);
  const inFlightSave = useRef<Promise<boolean> | null>(null);
  const latestScene = useRef(scene);
  const sceneKey = `${project}/${fileName}`;
  const lastSceneKey = useRef(sceneKey);

  useEffect(() => {
    latestScene.current = scene;
  }, [scene]);

  const clearPendingTimeout = useCallback(() => {
    if (pendingTimeout.current === null) {
      return;
    }

    window.clearTimeout(pendingTimeout.current);
    pendingTimeout.current = null;
  }, []);

  useEffect(() => {
    if (lastSceneKey.current === sceneKey) {
      return;
    }

    clearPendingTimeout();
    lastSceneKey.current = sceneKey;
    lastSaved.current = null;
    setStatus("saved");
    setError(null);
  }, [clearPendingTimeout, sceneKey]);

  const saveNow = useCallback(async () => {
    if (!latestScene.current) {
      return false;
    }

    clearPendingTimeout();

    if (inFlightSave.current) {
      return inFlightSave.current;
    }

    setStatus("saving");
    setError(null);

    const saveRequest = (async () => {
      try {
        while (latestScene.current) {
          const sceneToSave = latestScene.current;
          const serializedScene = serializeScene(sceneToSave);

          if (serializedScene === lastSaved.current) {
            setStatus("saved");
            return true;
          }

          await designApi.writeDesign(project, fileName, sceneToSave);
          lastSaved.current = serializedScene;

          const newestScene = latestScene.current;
          if (!newestScene) {
            break;
          }

          if (serializeScene(newestScene) === lastSaved.current) {
            setStatus("saved");
            return true;
          }

          setStatus("saving");
        }

        setStatus("saved");
        return true;
      } catch (unknownError) {
        setError(String(unknownError));
        setStatus("error");
        return false;
      } finally {
        inFlightSave.current = null;
      }
    })();

    inFlightSave.current = saveRequest;
    return saveRequest;
  }, [clearPendingTimeout, fileName, project]);

  useEffect(() => {
    if (!enabled || !scene) {
      return;
    }

    const serialized = serializeScene(scene);

    if (lastSaved.current === null) {
      lastSaved.current = serialized;
      setStatus("saved");
      return;
    }

    if (serialized === lastSaved.current) {
      return;
    }

    if (inFlightSave.current) {
      setStatus("saving");
      return;
    }

    setStatus("unsaved");

    pendingTimeout.current = window.setTimeout(() => {
      pendingTimeout.current = null;
      void saveNow();
    }, 800);

    return () => {
      clearPendingTimeout();
    };
  }, [clearPendingTimeout, enabled, saveNow, scene]);

  return { status, saveNow, error };
}
