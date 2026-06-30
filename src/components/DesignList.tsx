import { FilePlus2 } from "lucide-react";
import type { DesignSummary } from "../types/designs";

type DesignListProps = {
  project: string | null;
  designs: DesignSummary[];
  totalDesignCount: number;
  filter: string;
  onFilterChange: (filter: string) => void;
  onCreateDesign: () => void;
  onOpenDesign: (project: string, fileName: string) => void;
};

export function DesignList({
  project,
  designs,
  totalDesignCount,
  filter,
  onFilterChange,
  onCreateDesign,
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
            <button
              type="button"
              className="design-row"
              key={design.fileName}
              onClick={() => onOpenDesign(design.project, design.fileName)}
            >
              <span>{design.name}</span>
              <span>{new Date(Number(design.updatedAtMs)).toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
