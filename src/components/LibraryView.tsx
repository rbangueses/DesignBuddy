import { useState } from "react";
import { useDesignLibrary } from "../hooks/useDesignLibrary";
import type { DesignSummary } from "../types/designs";
import { ConfirmDialog } from "./ConfirmDialog";
import { DesignList } from "./DesignList";
import { ProjectSidebar } from "./ProjectSidebar";
import { RenameDialog } from "./RenameDialog";

type LibraryViewProps = {
  onOpenDesign: (project: string, fileName: string) => void;
};

type PendingAction =
  | { type: "create-project" }
  | { type: "create-design" }
  | { type: "rename-project"; project: string }
  | { type: "duplicate-project"; project: string }
  | { type: "delete-project"; project: string }
  | { type: "rename-design"; design: DesignSummary }
  | { type: "duplicate-design"; design: DesignSummary }
  | { type: "delete-design"; design: DesignSummary }
  | null;

export function LibraryView({ onOpenDesign }: LibraryViewProps) {
  const library = useDesignLibrary();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const closeDialog = () => setPendingAction(null);

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
