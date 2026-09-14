import { open, save } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { useDesignLibrary } from "../hooks/useDesignLibrary";
import {
  loadAiSettings,
  saveAiSettings,
  type AiSettings,
} from "../lib/aiSettings";
import {
  loadBackupSettings,
  saveBackupSettings,
  type BackupSettings,
} from "../lib/backupSettings";
import { designApi } from "../lib/designApi";
import type { DesignSummary } from "../types/designs";
import type { RestorePreview } from "../types/designs";
import { AiDiagramDialog } from "./AiDiagramDialog";
import { AiSettingsDialog } from "./AiSettingsDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { DesignList } from "./DesignList";
import { ProjectSidebar } from "./ProjectSidebar";
import { RenameDialog } from "./RenameDialog";
import { RestoreBackupDialog } from "./RestoreBackupDialog";

type LibraryViewProps = {
  initialSelectedProject?: string | null;
  openError?: string | null;
  onOpenDesign: (project: string, fileName: string) => void;
};

const PRESENTATION_MODE_STORAGE_KEY = "banguesesdraw.presentationMode";

type PendingAction =
  | { type: "create-project" }
  | { type: "create-note" }
  | { type: "create-design" }
  | { type: "create-mermaid-design" }
  | { type: "create-ai-design" }
  | { type: "ai-settings" }
  | { type: "restore-backup"; sourcePath: string; preview: RestorePreview }
  | { type: "rename-project"; project: string }
  | { type: "duplicate-project"; project: string }
  | { type: "delete-project"; project: string }
  | { type: "rename-design"; design: DesignSummary }
  | { type: "duplicate-design"; design: DesignSummary }
  | { type: "delete-design"; design: DesignSummary }
  | null;

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

export function LibraryView({
  initialSelectedProject,
  openError,
  onOpenDesign,
}: LibraryViewProps) {
  const library = useDesignLibrary(initialSelectedProject);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => loadAiSettings());
  const [backupSettings, setBackupSettings] = useState<BackupSettings>(() =>
    loadBackupSettings(),
  );
  const [presentationMode, setPresentationMode] = useState(
    () => localStorage.getItem(PRESENTATION_MODE_STORAGE_KEY) === "true",
  );

  const closeDialog = () => setPendingAction(null);
  const designImportFilters = [
    {
      name: "DesignBuddy artifacts",
      extensions: aiSettings.enableMermaid
        ? ["excalidraw", "json", "mmd", "bdnote"]
        : ["excalidraw", "json", "bdnote"],
    },
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

  useEffect(() => {
    localStorage.setItem(
      PRESENTATION_MODE_STORAGE_KEY,
      String(presentationMode),
    );
  }, [presentationMode]);

  const togglePresentationMode = useCallback(() => {
    if (!presentationMode && library.selectedProject) {
      const selectedProject = library.projects.find(
        (project) => project.name === library.selectedProject,
      );

      if (selectedProject?.visibleInPresentationMode !== true) {
        void library
          .setProjectVisibility(library.selectedProject, true)
          .catch(() => undefined);
      }
    }

    setPresentationMode((currentMode) => !currentMode);
  }, [library, presentationMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        pendingAction ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTextEntryTarget(event.target)
      ) {
        return;
      }

      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        togglePresentationMode();
      } else if (!library.selectedProject) {
        return;
      } else if (event.key === "1") {
        event.preventDefault();
        setPendingAction({ type: "create-note" });
      } else if (event.key === "2") {
        event.preventDefault();
        setPendingAction({ type: "create-design" });
      } else if (event.key === "3" && aiSettings.enableMermaid) {
        event.preventDefault();
        setPendingAction({ type: "create-mermaid-design" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aiSettings.enableMermaid, pendingAction, togglePresentationMode]);

  const handleExportDesign = async (design: DesignSummary) => {
    const exportFilters =
      design.kind === "mermaid"
        ? [{ name: "Mermaid", extensions: ["mmd"] }]
        : design.kind === "note"
          ? [{ name: "DesignBuddy note", extensions: ["bdnote"] }]
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

  const handleChooseBackupFolder = async () => {
    const selectedPath = await open({
      title: "Choose backup folder",
      directory: true,
      multiple: false,
    });

    return typeof selectedPath === "string" ? selectedPath : null;
  };

  const handleChooseRestoreFolder = async () => {
    const sourcePath = await open({
      title: "Choose backup folder to restore",
      directory: true,
      multiple: false,
    });
    if (typeof sourcePath !== "string") return;
    const preview = await designApi.scanBackup(sourcePath);
    setPendingAction({ type: "restore-backup", sourcePath, preview });
  };

  return (
    <div className="library-view">
      <ProjectSidebar
        projects={library.projects}
        selectedProject={library.selectedProject}
        presentationMode={presentationMode}
        onTogglePresentationMode={togglePresentationMode}
        onSetProjectVisibility={(project, visible) => {
          void library.setProjectVisibility(project, visible).catch(() => undefined);
        }}
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
            enableMermaid={aiSettings.enableMermaid}
            onFilterChange={library.setFilter}
            onCreateNote={() => setPendingAction({ type: "create-note" })}
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
      {pendingAction?.type === "create-note" ? (
        <RenameDialog
          title="Create Note"
          inputLabel="Note name"
          submitLabel="Create"
          onCancel={closeDialog}
          onSubmit={async (name) => {
            const design = await library.createDesign(name, "note");
            closeDialog();
            if (design) {
              onOpenDesign(design.project, design.fileName);
            }
          }}
        />
      ) : null}
      {pendingAction?.type === "create-design" ? (
        <RenameDialog
          title="Create Excalidraw"
          inputLabel="Excalidraw name"
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
          title="Create Mermaid"
          inputLabel="Mermaid name"
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
          backupSettings={backupSettings}
          onCancel={closeDialog}
          onChooseBackupFolder={handleChooseBackupFolder}
          onRestoreFromBackup={() => {
            void handleChooseRestoreFolder().catch(() => undefined);
          }}
          onBackUpNow={designApi.backupLibrary}
          onSave={(settings, nextBackupSettings) => {
            saveAiSettings(settings);
            saveBackupSettings(nextBackupSettings);
            setAiSettings(settings);
            setBackupSettings(nextBackupSettings);
            closeDialog();
          }}
        />
      ) : null}
      {pendingAction?.type === "restore-backup" ? (
        <RestoreBackupDialog
          sourcePath={pendingAction.sourcePath}
          preview={pendingAction.preview}
          onCancel={closeDialog}
          onRestore={async (artifacts) => {
            await designApi.restoreBackup(pendingAction.sourcePath, artifacts);
            await library.refresh();
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
