import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { EditorView } from "./components/EditorView";
import { LibraryView } from "./components/LibraryView";
import { designApi } from "./lib/designApi";
import { isExcalidrawScene } from "./lib/sceneValidation";
import type { ExcalidrawScene } from "./types/excalidraw";

type OpenDesign = {
  project: string;
  fileName: string;
  initialScene: ExcalidrawScene;
};

export default function App() {
  const [openDesign, setOpenDesign] = useState<OpenDesign | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  async function handleOpenDesign(project: string, fileName: string) {
    setOpenError(null);

    try {
      const design = await designApi.readDesign(project, fileName);

      if (!isExcalidrawScene(design.content)) {
        throw new Error("Invalid Excalidraw scene.");
      }

      setOpenDesign({ project, fileName, initialScene: design.content });
    } catch (error) {
      setOpenError(`${fileName}: ${String(error)}`);
    }
  }

  return (
    <AppShell>
      {openDesign ? (
        <EditorView
          project={openDesign.project}
          fileName={openDesign.fileName}
          initialScene={openDesign.initialScene}
          onBack={() => setOpenDesign(null)}
          onDesignMoved={(project, fileName, initialScene) =>
            setOpenDesign({ project, fileName, initialScene })
          }
        />
      ) : (
        <LibraryView
          openError={openError}
          onOpenDesign={(project, fileName) => void handleOpenDesign(project, fileName)}
        />
      )}
    </AppShell>
  );
}
