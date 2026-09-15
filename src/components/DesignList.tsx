import {
  Bot,
  ChevronDown,
  Copy,
  Download,
  FolderInput,
  FileText,
  FilePlus2,
  Pencil,
  Settings,
  Trash2,
  Upload,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import type { DesignSummary } from "../types/designs";

type DesignListProps = {
  project: string | null;
  designs: DesignSummary[];
  totalDesignCount: number;
  filter: string;
  enableMermaid?: boolean;
  onFilterChange: (filter: string) => void;
  onCreateNote: () => void;
  onCreateDesign: () => void;
  onCreateMermaidDesign: () => void;
  onCreateAiDesign: () => void;
  onConfigureAi: () => void;
  onImportDesign: () => void;
  onExportDesign: (design: DesignSummary) => void;
  onRenameDesign: (design: DesignSummary) => void;
  onDuplicateDesign: (design: DesignSummary) => void;
  onMoveDesign?: (design: DesignSummary) => void;
  onDeleteDesign: (design: DesignSummary) => void;
  onOpenDesign: (project: string, fileName: string) => void;
};

export function DesignList({
  project,
  designs,
  totalDesignCount,
  filter,
  enableMermaid = true,
  onFilterChange,
  onCreateNote,
  onCreateDesign,
  onCreateMermaidDesign,
  onCreateAiDesign,
  onConfigureAi,
  onImportDesign,
  onExportDesign,
  onRenameDesign,
  onDuplicateDesign,
  onMoveDesign,
  onDeleteDesign,
  onOpenDesign,
}: DesignListProps) {
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const kindLabel = (kind: DesignSummary["kind"]) => {
    switch (kind) {
      case "mermaid":
        return "Mermaid";
      case "note":
        return "Note";
      case "excalidraw":
        return "Excalidraw";
    }
  };

  if (!project) {
    return <section className="empty-state">Create a project to start drawing.</section>;
  }

  const shortcutKeycap = (shortcut: string) => (
    <span className="shortcut-keycap" aria-hidden="true">
      {shortcut}
    </span>
  );

  const runCreateAction = (action: () => void) => {
    setIsCreateMenuOpen(false);
    action();
  };

  return (
    <section className="design-panel">
      <header className="design-panel-header">
        <div>
          <p className="eyebrow">Project</p>
          <h2>{project}</h2>
        </div>
        <div className="design-header-actions">
          <div className="toolbar-action-group">
            <button
              type="button"
              className="icon-button"
              onClick={onConfigureAi}
              aria-label="Settings"
              title="Settings"
            >
              <Settings size={16} />
            </button>
            <button
              type="button"
              onClick={onImportDesign}
              aria-label="Import design"
              title="Import design"
            >
              <Upload size={16} />
              Import
            </button>
          </div>
          <div className="toolbar-action-group">
            <button type="button" onClick={onCreateAiDesign}>
              <Bot size={16} />
              AI diagram
            </button>
          </div>
          <div className="toolbar-action-group create-menu-wrap">
            <button
              type="button"
              className="primary-button create-menu-trigger"
              onClick={() => setIsCreateMenuOpen((isOpen) => !isOpen)}
              aria-expanded={isCreateMenuOpen}
              aria-haspopup="menu"
            >
              <FilePlus2 size={16} />
              New
              <ChevronDown size={15} />
            </button>
            {isCreateMenuOpen ? (
              <div className="create-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runCreateAction(onCreateNote)}
                >
                  <FileText size={16} />
                  <span className="create-action-label">Note</span>
                  {shortcutKeycap("1")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runCreateAction(onCreateDesign)}
                >
                  <FilePlus2 size={16} />
                  <span className="create-action-label">Excalidraw</span>
                  {shortcutKeycap("2")}
                </button>
                {enableMermaid ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runCreateAction(onCreateMermaidDesign)}
                  >
                    <Workflow size={16} />
                    <span className="create-action-label">Mermaid</span>
                    {shortcutKeycap("3")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <input
        className="filter-input"
        value={filter}
        onChange={(event) => onFilterChange(event.target.value)}
        placeholder="Filter designs"
        aria-label="Filter designs"
      />
      {designs.length === 0 ? (
        <div className="empty-state">
          {filter.trim() && totalDesignCount > 0
            ? `No designs match "${filter.trim()}".`
            : "No designs in this project yet."}
        </div>
      ) : (
        <div className="design-list">
          {designs.map((design) => (
            <div
              key={design.fileName}
              className={`design-row design-row-${design.kind}`}
            >
              <button
                type="button"
                className="design-open-button"
                onClick={() => onOpenDesign(design.project, design.fileName)}
              >
                <span className="design-name">{design.name}</span>
                <span className={`design-kind ${design.kind}`}>
                  {kindLabel(design.kind)}
                </span>
                <span className="design-updated">
                  {new Date(Number(design.updatedAtMs)).toLocaleString()}
                </span>
              </button>
              <div className="row-actions">
                <button
                  type="button"
                  className="icon-button row-action-button"
                  aria-label={`Export ${design.name}`}
                  title={`Export ${design.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onExportDesign(design);
                  }}
                >
                  <Download size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button row-action-button"
                  aria-label={`Rename ${design.name}`}
                  title={`Rename ${design.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRenameDesign(design);
                  }}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button row-action-button"
                  aria-label={`Duplicate ${design.name}`}
                  title={`Duplicate ${design.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDuplicateDesign(design);
                  }}
                >
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button row-action-button"
                  aria-label={`Move ${design.name}`}
                  title={`Move ${design.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveDesign?.(design);
                  }}
                >
                  <FolderInput size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button row-action-button"
                  aria-label={`Delete ${design.name}`}
                  title={`Delete ${design.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteDesign(design);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
