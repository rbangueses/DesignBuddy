import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { EditorView } from "./components/EditorView";
import { LibraryView } from "./components/LibraryView";

type OpenDesign = {
  project: string;
  fileName: string;
};

export default function App() {
  const [openDesign, setOpenDesign] = useState<OpenDesign | null>(null);

  return (
    <AppShell>
      {openDesign ? (
        <EditorView
          project={openDesign.project}
          fileName={openDesign.fileName}
          onBack={() => setOpenDesign(null)}
        />
      ) : (
        <LibraryView
          onOpenDesign={(project, fileName) => setOpenDesign({ project, fileName })}
        />
      )}
    </AppShell>
  );
}
