import { useState } from "react";
import { useDesignLibrary } from "../hooks/useDesignLibrary";
import { DesignList } from "./DesignList";
import { ProjectSidebar } from "./ProjectSidebar";
import { RenameDialog } from "./RenameDialog";

type LibraryViewProps = {
  onOpenDesign: (project: string, fileName: string) => void;
};

export function LibraryView({ onOpenDesign }: LibraryViewProps) {
  const library = useDesignLibrary();
  const [dialog, setDialog] = useState<"project" | "design" | null>(null);

  return (
    <div className="library-view">
      <ProjectSidebar
        projects={library.projects}
        selectedProject={library.selectedProject}
        onSelectProject={library.setSelectedProject}
        onCreateProject={() => setDialog("project")}
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
            onCreateDesign={() => setDialog("design")}
            onOpenDesign={onOpenDesign}
          />
        )}
      </main>
      {dialog === "project" ? (
        <RenameDialog
          title="Create project"
          inputLabel="Project name"
          submitLabel="Create"
          onCancel={() => setDialog(null)}
          onSubmit={async (name) => {
            await library.createProject(name);
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === "design" ? (
        <RenameDialog
          title="Create design"
          inputLabel="Design name"
          submitLabel="Create"
          onCancel={() => setDialog(null)}
          onSubmit={async (name) => {
            const design = await library.createDesign(name);
            setDialog(null);
            if (design) {
              onOpenDesign(design.project, design.fileName);
            }
          }}
        />
      ) : null}
    </div>
  );
}
