import { useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import type { ProjectSummary } from "../types/designs";

type ProjectSidebarProps = {
  projects: ProjectSummary[];
  selectedProject: string | null;
  presentationMode: boolean;
  onTogglePresentationMode: () => void;
  onSetProjectVisibility: (project: string, visible: boolean) => void;
  onSelectProject: (project: string) => void;
  onCreateProject: () => void;
  onRenameProject: (project: string) => void;
  onDuplicateProject: (project: string) => void;
  onDeleteProject: (project: string) => void;
};

function isVisibleInPresentationMode(project: ProjectSummary) {
  return project.visibleInPresentationMode === true;
}

export function ProjectSidebar({
  projects,
  selectedProject,
  presentationMode,
  onTogglePresentationMode,
  onSetProjectVisibility,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
}: ProjectSidebarProps) {
  const [projectFilter, setProjectFilter] = useState("");
  const [openProjectActions, setOpenProjectActions] = useState<string | null>(null);
  const visibleProjectsBeforeSearch = presentationMode
    ? projects.filter(
        (project) =>
          project.name === selectedProject || isVisibleInPresentationMode(project),
      )
    : projects;
  const visibleProjects = projectFilter.trim()
    ? visibleProjectsBeforeSearch.filter((project) =>
        project.name.toLowerCase().includes(projectFilter.trim().toLowerCase()),
      )
    : visibleProjectsBeforeSearch;
  const hiddenProjectCount = presentationMode
    ? projects.length - visibleProjectsBeforeSearch.length
    : 0;
  const presentationModeTitle = presentationMode
    ? "Stop presentation mode"
    : "Start presentation mode";
  const presentationModeTooltip = `${presentationModeTitle}. Press H to focus the selected project or show all projects.`;
  const runProjectAction = (action: () => void) => {
    setOpenProjectActions(null);
    action();
  };

  return (
    <aside className="project-sidebar">
      <div className="sidebar-header">
        <h1>DesignBuddy</h1>
        <div className="sidebar-header-actions">
          <button
            type="button"
            className={`icon-button ${presentationMode ? "privacy-active" : ""}`}
            onClick={onTogglePresentationMode}
            aria-label={presentationModeTitle}
            title={presentationModeTooltip}
          >
            {presentationMode ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
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
      </div>
      {hiddenProjectCount > 0 ? (
        <p className="privacy-hidden-count">
          {hiddenProjectCount} private{" "}
          {hiddenProjectCount === 1 ? "project" : "projects"} hidden
        </p>
      ) : null}
      <label className="project-search">
        <Search size={15} aria-hidden="true" />
        <span className="visually-hidden">Search projects</span>
        <input
          type="search"
          value={projectFilter}
          onChange={(event) => setProjectFilter(event.target.value)}
          placeholder="Search projects"
          aria-label="Search projects"
        />
      </label>
      <nav aria-label="Projects">
        {visibleProjects.map((project) => (
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
            <button
              type="button"
              className="icon-button row-action-button project-visibility-button"
              onClick={() =>
                onSetProjectVisibility(
                  project.name,
                  !isVisibleInPresentationMode(project),
                )
              }
              aria-label={
                isVisibleInPresentationMode(project)
                  ? `Hide ${project.name} in presentation mode`
                  : `Show ${project.name} in presentation mode`
              }
              title={
                isVisibleInPresentationMode(project)
                  ? `Hide ${project.name} in presentation mode`
                  : `Show ${project.name} in presentation mode`
              }
            >
              {isVisibleInPresentationMode(project) ? (
                <Eye size={16} />
              ) : (
                <EyeOff size={16} />
              )}
            </button>
            <div className="project-actions-menu-wrap">
              <button
                type="button"
                className="icon-button row-action-button"
                onClick={() =>
                  setOpenProjectActions((openProject) =>
                    openProject === project.name ? null : project.name,
                  )
                }
                aria-label={`Project actions for ${project.name}`}
                aria-haspopup="menu"
                aria-expanded={openProjectActions === project.name}
                title={`Project actions for ${project.name}`}
              >
                <MoreHorizontal size={16} />
              </button>
              {openProjectActions === project.name ? (
                <div className="project-actions-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runProjectAction(() => onRenameProject(project.name))}
                  >
                    <Pencil size={16} />
                    Rename
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      runProjectAction(() => onDuplicateProject(project.name))
                    }
                  >
                    <Copy size={16} />
                    Duplicate
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runProjectAction(() => onDeleteProject(project.name))}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
