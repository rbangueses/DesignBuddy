import { Copy, FilePlus2, Pencil, Trash2 } from "lucide-react";
import type { DesignSummary } from "../types/designs";

type DesignListProps = {
  project: string | null;
  designs: DesignSummary[];
  totalDesignCount: number;
  filter: string;
  onFilterChange: (filter: string) => void;
  onCreateDesign: () => void;
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
  onFilterChange,
  onCreateDesign,
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
        <button type="button" onClick={onCreateDesign}>
          <FilePlus2 size={16} />
          New design
        </button>
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
                <span>{design.name}</span>
                <span>{new Date(Number(design.updatedAtMs)).toLocaleString()}</span>
              </button>
              <div className="row-actions">
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
