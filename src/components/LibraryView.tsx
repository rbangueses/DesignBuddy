import { open, save } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { useDesignLibrary } from "../hooks/useDesignLibrary";
import {
  loadAiSettings,
  saveAiSettings,
  type AiSettings,
} from "../lib/aiSettings";
import type { DesignSummary } from "../types/designs";
import { AiDiagramDialog } from "./AiDiagramDialog";
import { AiSettingsDialog } from "./AiSettingsDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { DesignList } from "./DesignList";
import { ProjectSidebar } from "./ProjectSidebar";
import { RenameDialog } from "./RenameDialog";

type LibraryViewProps = {
  openError?: string | null;
  onOpenDesign: (project: string, fileName: string) => void;
};

type PendingAction =
  | { type: "create-project" }
  | { type: "create-design" }
  | { type: "create-mermaid-design" }
  | { type: "create-ai-design" }
  | { type: "ai-settings" }
  | { type: "rename-project"; project: string }
  | { type: "duplicate-project"; project: string }
  | { type: "delete-project"; project: string }
  | { type: "rename-design"; design: DesignSummary }
  | { type: "duplicate-design"; design: DesignSummary }
  | { type: "delete-design"; design: DesignSummary }
  | null;

export function LibraryView({ openError, onOpenDesign }: LibraryViewProps) {
  const library = useDesignLibrary();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => loadAiSettings());

  const closeDialog = () => setPendingAction(null);
  const designImportFilters = [
    { name: "BanguesesDraw designs", extensions: ["excalidraw", "json", "mmd"] },
  ];

  const handleImportDesign = async () => {
    const sourcePath = await open({
      title: "Import design",
      multiple: false,
      filters: designImportFilters,
    });

    if (typeof sourcePath === "string") {
      await library.importDesign(sourcePath);
    }
  };

  const handleExportDesign = async (design: DesignSummary) => {
    const exportFilters =
      design.kind === "mermaid"
        ? [{ name: "Mermaid", extensions: ["mmd"] }]
        : [{ name: "Excalidraw", extensions: ["excalidraw"] }];
    const targetPath = await save({
      title: "Export design",
      defaultPath: design.fileName,
      filters: exportFilters,
    });

    if (typeof targetPath === "string") {
      await library.exportDesign(design.fileName, targetPath);
    }
  };

  return (
    <div className="library-view">
      <ProjectSidebar
        projects={library.projects}
        selectedProject={library.selectedProject}
        onSelectProject={library.setSelectedProject}
        onCreateProject={() => setPendingAction({ type: "create-project" })}
        onRenameProject={(project) => setPendingAction({ type: "rename-project", project })}
        onDuplicateProject={(project) =>
          setPendingAction({ type: "duplicate-project", project })
        }
        onDeleteProject={(project) => setPendingAction({ type: "delete-project", project })}
      />
      <main className="library-main">
        {openError ? <div className="error-banner">{openError}</div> : null}
        {library.error ? <div className="error-banner">{library.error}</div> : null}
        {library.isLoading || library.isDesignsLoading ? (
          <section className="empty-state">Loading designs...</section>
        ) : (
          <DesignList
            project={library.selectedProject}
            designs={library.filteredDesigns}
            totalDesignCount={library.designs.length}
            filter={library.filter}
            onFilterChange={library.setFilter}
            onCreateDesign={() => setPendingAction({ type: "create-design" })}
            onCreateMermaidDesign={() =>
              setPendingAction({ type: "create-mermaid-design" })
            }
            onCreateAiDesign={() => setPendingAction({ type: "create-ai-design" })}
            onConfigureAi={() => setPendingAction({ type: "ai-settings" })}
            onImportDesign={() => {
              void handleImportDesign().catch(() => undefined);
            }}
            onExportDesign={(design) => {
              void handleExportDesign(design).catch(() => undefined);
            }}
            onRenameDesign={(design) => setPendingAction({ type: "rename-design", design })}
            onDuplicateDesign={(design) =>
              setPendingAction({ type: "duplicate-design", design })
            }
            onDeleteDesign={(design) => setPendingAction({ type: "delete-design", design })}
            onOpenDesign={onOpenDesign}
          />
        )}
      </main>
      {pendingAction?.type === "create-project" ? (
        <RenameDialog
          title="Create project"
          inputLabel="Project name"
          submitLabel="Create"
          onCancel={closeDialog}
          onSubmit={async (name) => {
            await library.createProject(name);
            closeDialog();
          }}
        />
      ) : null}
      {pendingAction?.type === "create-design" ? (
        <RenameDialog
          title="Create design"
          inputLabel="Design name"
          submitLabel="Create"
          onCancel={closeDialog}
          onSubmit={async (name) => {
            const design = await library.createDesign(name);
            closeDialog();
            if (design) {
              onOpenDesign(design.project, design.fileName);
            }
          }}
        />
      ) : null}
      {pendingAction?.type === "create-mermaid-design" ? (
        <RenameDialog
          title="Create Mermaid flowchart"
          inputLabel="Flowchart name"
          submitLabel="Create"
          onCancel={closeDialog}
          onSubmit={async (name) => {
            const design = await library.createDesign(name, "mermaid");
            closeDialog();
            if (design) {
              onOpenDesign(design.project, design.fileName);
            }
          }}
        />
      ) : null}
      {pendingAction?.type === "create-ai-design" ? (
        <AiDiagramDialog
          settings={aiSettings}
          onCancel={closeDialog}
          onGenerated={async (result) => {
            const design =
              result.kind === "mermaid"
                ? await library.createDesign(result.name, "mermaid", {
                    source: result.source,
                  })
                : await library.createDesign(
                    result.name,
                    "excalidraw",
                    result.scene,
                  );
            closeDialog();

            if (design) {
              onOpenDesign(design.project, design.fileName);
            }
          }}
        />
      ) : null}
      {pendingAction?.type === "ai-settings" ? (
        <AiSettingsDialog
          settings={aiSettings}
          onCancel={closeDialog}
          onSave={(settings) => {
            saveAiSettings(settings);
            setAiSettings(settings);
            closeDialog();
          }}
        />
      ) : null}
      {pendingAction?.type === "rename-project" ? (
        <RenameDialog
          title="Rename project"
          inputLabel="Project name"
          initialName={pendingAction.project}
          submitLabel="Rename"
          onCancel={closeDialog}
          onSubmit={async (name) => {
            await library.renameProject(pendingAction.project, name);
            closeDialog();
          }}
        />
      ) : null}
      {pendingAction?.type === "duplicate-project" ? (
        <RenameDialog
          title="Duplicate project"
          inputLabel="Project name"
          initialName={`${pendingAction.project} Copy`}
          submitLabel="Duplicate"
          onCancel={closeDialog}
          onSubmit={async (name) => {
            await library.duplicateProject(pendingAction.project, name);
            closeDialog();
          }}
        />
      ) : null}
      {pendingAction?.type === "rename-design" ? (
        <RenameDialog
          title="Rename design"
          inputLabel="Design name"
          initialName={pendingAction.design.name}
          submitLabel="Rename"
          onCancel={closeDialog}
          onSubmit={async (name) => {
            await library.renameDesign(pendingAction.design.fileName, name);
            closeDialog();
          }}
        />
      ) : null}
      {pendingAction?.type === "duplicate-design" ? (
        <RenameDialog
          title="Duplicate design"
          inputLabel="Design name"
          initialName={`${pendingAction.design.name} Copy`}
          submitLabel="Duplicate"
          onCancel={closeDialog}
          onSubmit={async (name) => {
            await library.duplicateDesign(pendingAction.design.fileName, name);
            closeDialog();
          }}
        />
      ) : null}
      {pendingAction?.type === "delete-project" ? (
        <ConfirmDialog
          title="Delete project"
          body={`Delete "${pendingAction.project}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onCancel={closeDialog}
          onConfirm={async () => {
            await library.deleteProject(pendingAction.project);
            closeDialog();
          }}
        />
      ) : null}
      {pendingAction?.type === "delete-design" ? (
        <ConfirmDialog
          title="Delete design"
          body={`Delete "${pendingAction.design.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onCancel={closeDialog}
          onConfirm={async () => {
            await library.deleteDesign(pendingAction.design.fileName);
            closeDialog();
          }}
        />
      ) : null}
    </div>
  );
}
