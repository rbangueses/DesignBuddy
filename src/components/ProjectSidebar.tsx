import { Copy, FolderPlus, Pencil, Trash2 } from "lucide-react";
import type { ProjectSummary } from "../types/designs";

type ProjectSidebarProps = {
  projects: ProjectSummary[];
  selectedProject: string | null;
  onSelectProject: (project: string) => void;
  onCreateProject: () => void;
  onRenameProject: (project: string) => void;
  onDuplicateProject: (project: string) => void;
  onDeleteProject: (project: string) => void;
};

export function ProjectSidebar({
  projects,
  selectedProject,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
}: ProjectSidebarProps) {
  return (
    <aside className="project-sidebar">
      <div className="sidebar-header">
        <h1>BanguesesDraw</h1>
        <button
          type="button"
          className="icon-button"
          onClick={onCreateProject}
          aria-label="Create project"
          title="Create project"
        >
          <FolderPlus size={18} />
        </button>
      </div>
      <nav aria-label="Projects">
        {projects.map((project) => (
          <div
            key={project.name}
            className={
              project.name === selectedProject ? "project-item active" : "project-item"
            }
          >
            <button
              type="button"
              className="project-button"
              onClick={() => onSelectProject(project.name)}
            >
              <span>{project.name}</span>
              <span>{project.designCount}</span>
            </button>
            <div className="row-actions">
              <button
                type="button"
                className="icon-button row-action-button"
                onClick={() => onRenameProject(project.name)}
                aria-label={`Rename ${project.name}`}
                title={`Rename ${project.name}`}
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                className="icon-button row-action-button"
                onClick={() => onDuplicateProject(project.name)}
                aria-label={`Duplicate ${project.name}`}
                title={`Duplicate ${project.name}`}
              >
                <Copy size={16} />
              </button>
              <button
                type="button"
                className="icon-button row-action-button"
                onClick={() => onDeleteProject(project.name)}
                aria-label={`Delete ${project.name}`}
                title={`Delete ${project.name}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
