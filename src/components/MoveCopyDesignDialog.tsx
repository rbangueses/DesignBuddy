import type { FormEvent } from "react";
import { useEffect, useId, useState } from "react";
import { validateDisplayName } from "../lib/designNames";
import { designApi } from "../lib/designApi";
import type { ProjectSummary } from "../types/designs";
import { useDialogEscape } from "./useDialogEscape";

type MoveCopyDesignDialogProps = {
  mode: "copy" | "move";
  sourceProject: string;
  projects?: ProjectSummary[];
  initialName: string;
  onCancel: () => void;
  onSubmit: (targetProject: string, targetName: string) => Promise<void> | void;
};

export function MoveCopyDesignDialog({
  mode,
  sourceProject,
  projects: suppliedProjects,
  initialName,
  onCancel,
  onSubmit,
}: MoveCopyDesignDialogProps) {
  const [name, setName] = useState(initialName);
  const [targetProject, setTargetProject] = useState(sourceProject);
  const [loadedProjects, setLoadedProjects] = useState([sourceProject]);
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const projectId = useId();
  const errorId = `${nameId}-error`;
  const action = mode === "move" ? "Move" : "Duplicate";

  useDialogEscape(onCancel);

  useEffect(() => {
    if (suppliedProjects) {
      return;
    }
    void designApi.listProjects().then((items) => {
      setLoadedProjects(items.map((project) => project.name));
    }).catch(() => {
      setError("Could not load projects. Please close this dialog and try again.");
    });
  }, [suppliedProjects]);

  const projects = suppliedProjects?.map((project) => project.name) ?? loadedProjects;

  async function submit() {
    const validation = validateDisplayName(name);
    if (validation) {
      setError(validation);
      return;
    }
    if (mode === "move" && targetProject === sourceProject) {
      setError("Choose a different project to move this diagram.");
      return;
    }

    setError(null);
    try {
      await onSubmit(targetProject, name.trim());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog move-copy-dialog" role="dialog" aria-modal="true" aria-label={`${action} design`}>
        <h2>{action} design</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor={nameId}>Design name</label>
          <input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-describedby={error ? errorId : undefined}
            autoFocus
          />
          <label htmlFor={projectId}>{mode === "move" ? "Move to project" : "Copy to project"}</label>
          <select
            id={projectId}
            value={targetProject}
            onChange={(event) => setTargetProject(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project} value={project}>
                {project}{project === sourceProject ? " (current)" : ""}
              </option>
            ))}
          </select>
          {error ? (
            <p className="form-error" id={errorId}>
              {error}
            </p>
          ) : null}
          <div className="dialog-actions">
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit">{action}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
