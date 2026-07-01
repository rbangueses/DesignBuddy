import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { EditorView } from "./components/EditorView";
import { LibraryView } from "./components/LibraryView";
import { MermaidEditorView } from "./components/MermaidEditorView";
import { designApi } from "./lib/designApi";
import { prepareSceneForExcalidraw } from "./lib/excalidrawScene";
import { normaliseMermaidContent } from "./lib/mermaidSource";
import { isExcalidrawScene } from "./lib/sceneValidation";
import type { ExcalidrawScene } from "./types/excalidraw";

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

export default function App() {
  const [openDesign, setOpenDesign] = useState<OpenDesign | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  async function handleOpenDesign(project: string, fileName: string) {
    setOpenError(null);

    try {
      const design = await designApi.readDesign(project, fileName);

      if (design.kind === "mermaid") {
        const content = normaliseMermaidContent(design.content);
        setOpenDesign({
          kind: "mermaid",
          project,
          fileName,
          initialSource: content.source,
        });
        return;
      }

      if (design.kind !== "excalidraw" || !isExcalidrawScene(design.content)) {
        throw new Error("Invalid Excalidraw scene.");
      }

      setOpenDesign({
        kind: "excalidraw",
        project,
        fileName,
        initialScene: prepareSceneForExcalidraw(design.content),
      });
    } catch (error) {
      setOpenError(`${fileName}: ${String(error)}`);
    }
  }

  return (
    <AppShell>
      {openDesign?.kind === "excalidraw" ? (
        <EditorView
          project={openDesign.project}
          fileName={openDesign.fileName}
          initialScene={openDesign.initialScene}
          onBack={() => setOpenDesign(null)}
          onDesignMoved={(project, fileName, initialScene) =>
            setOpenDesign({ kind: "excalidraw", project, fileName, initialScene })
          }
        />
      ) : openDesign?.kind === "mermaid" ? (
        <MermaidEditorView
          project={openDesign.project}
          fileName={openDesign.fileName}
          initialSource={openDesign.initialSource}
          onBack={() => setOpenDesign(null)}
          onDesignMoved={(project, fileName, initialSource) =>
            setOpenDesign({ kind: "mermaid", project, fileName, initialSource })
          }
          onOpenExcalidraw={(project, fileName, initialScene) =>
            setOpenDesign({ kind: "excalidraw", project, fileName, initialScene })
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
