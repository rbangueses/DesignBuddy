import {
  Bot,
  Copy,
  Download,
  FilePlus2,
  Pencil,
  Settings,
  Trash2,
  Upload,
  Workflow,
} from "lucide-react";
import type { DesignSummary } from "../types/designs";

type DesignListProps = {
  project: string | null;
  designs: DesignSummary[];
  totalDesignCount: number;
  filter: string;
  enableMermaid?: boolean;
  onFilterChange: (filter: string) => void;
  onCreateDesign: () => void;
  onCreateMermaidDesign: () => void;
  onCreateAiDesign: () => void;
  onConfigureAi: () => void;
  onImportDesign: () => void;
  onExportDesign: (design: DesignSummary) => void;
  onRenameDesign: (design: DesignSummary) => void;
  onDuplicateDesign: (design: DesignSummary) => void;
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
  onCreateDesign,
  onCreateMermaidDesign,
  onCreateAiDesign,
  onConfigureAi,
  onImportDesign,
  onExportDesign,
  onRenameDesign,
  onDuplicateDesign,
  onDeleteDesign,
  onOpenDesign,
}: DesignListProps) {
  if (!project) {
    return <section className="empty-state">Create a project to start drawing.</section>;
  }

  return (
    <section className="design-panel">
      <header className="design-panel-header">
        <div>
          <p className="eyebrow">Project</p>
          <h2>{project}</h2>
        </div>
        <div className="design-header-actions">
          <button
            type="button"
            className="icon-button"
            onClick={onConfigureAi}
            aria-label="AI settings"
            title="AI settings"
          >
            <Settings size={16} />
          </button>
          <button type="button" onClick={onCreateAiDesign}>
            <Bot size={16} />
            AI diagram
          </button>
          <button type="button" onClick={onImportDesign}>
            <Upload size={16} />
            Import design
          </button>
          {enableMermaid ? (
            <button type="button" onClick={onCreateMermaidDesign}>
              <Workflow size={16} />
              New Mermaid flowchart
            </button>
          ) : null}
          <button type="button" onClick={onCreateDesign}>
            <FilePlus2 size={16} />
            New design
          </button>
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
              className="design-row"
            >
              <button
                type="button"
                className="design-open-button"
                onClick={() => onOpenDesign(design.project, design.fileName)}
              >
                <span className="design-name">{design.name}</span>
                <span className={`design-kind ${design.kind}`}>
                  {design.kind === "mermaid" ? "Mermaid" : "Excalidraw"}
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
