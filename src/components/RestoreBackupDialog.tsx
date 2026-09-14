import { useMemo, useState } from "react";
import type {
  RestoreArtifact,
  RestoreConflictResolution,
  RestorePreview,
} from "../types/designs";
import { useDialogEscape } from "./useDialogEscape";

type Props = {
  sourcePath: string;
  preview: RestorePreview;
  onCancel: () => void;
  onRestore: (artifacts: RestoreArtifact[]) => Promise<void>;
};

export function RestoreBackupDialog({ sourcePath, preview, onCancel, onRestore }: Props) {
  const [selected, setSelected] = useState(() => new Set(preview.artifacts.map((item) => `${item.project}/${item.fileName}`)));
  const [resolutions, setResolutions] = useState<Record<string, RestoreConflictResolution>>({});
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDialogEscape(onCancel, !isRestoring);
  const projects = useMemo(() => [...new Set(preview.artifacts.map((item) => item.project))], [preview]);
  const keyFor = (project: string, fileName: string) => `${project}/${fileName}`;
  const toggle = (key: string) => setSelected((current) => {
    const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next;
  });
  const setProject = (project: string, checked: boolean) => setSelected((current) => {
    const next = new Set(current);
    preview.artifacts.filter((item) => item.project === project).forEach((item) => checked ? next.add(keyFor(item.project, item.fileName)) : next.delete(keyFor(item.project, item.fileName)));
    return next;
  });
  async function restore() {
    setError(null); setIsRestoring(true);
    try {
      await onRestore(preview.artifacts.filter((item) => selected.has(keyFor(item.project, item.fileName))).map((item) => ({
        project: item.project, fileName: item.fileName,
        conflictResolution: resolutions[keyFor(item.project, item.fileName)] ?? "copy",
      })));
    } catch (restoreError) { setError(restoreError instanceof Error ? restoreError.message : String(restoreError)); }
    finally { setIsRestoring(false); }
  }
  return <div className="dialog-backdrop" role="presentation">
    <section className="dialog restore-dialog" role="dialog" aria-modal="true" aria-label="Restore backup">
      <h2>Restore backup</h2>
      <p className="settings-help">Choose the drawings to import from <span className="backup-folder-path">{sourcePath}</span>. Existing files are kept by default and the backup is added as a copy.</p>
      <div className="restore-actions"><button type="button" onClick={() => setSelected(new Set(preview.artifacts.map((item) => keyFor(item.project, item.fileName))))}>Select all</button><button type="button" onClick={() => setSelected(new Set())}>Deselect all</button></div>
      {projects.map((project) => {
        const artifacts = preview.artifacts.filter((item) => item.project === project);
        const projectSelected = artifacts.every((item) => selected.has(keyFor(item.project, item.fileName)));
        return <fieldset className="restore-project" key={project}>
          <legend><label><input type="checkbox" checked={projectSelected} onChange={(event) => setProject(project, event.target.checked)} /> {project}</label></legend>
          {artifacts.map((item) => { const key = keyFor(item.project, item.fileName); return <div className="restore-artifact" key={key}>
            <label><input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} /> {item.fileName}</label>
            {item.conflictsWithExisting ? <label className="restore-conflict">Conflict <select aria-label={`Resolution for ${item.fileName}`} value={resolutions[key] ?? "copy"} onChange={(event) => setResolutions((current) => ({ ...current, [key]: event.target.value as RestoreConflictResolution }))}><option value="copy">Keep both (add copy)</option><option value="replace">Replace local file</option><option value="skip">Skip if local exists</option></select></label> : null}
          </div>; })}
        </fieldset>;
      })}
      {preview.artifacts.length === 0 ? <p>No valid DesignBuddy artifacts were found.</p> : null}
      {preview.invalidFileCount > 0 ? <p className="form-error">{preview.invalidFileCount} invalid file(s) will be ignored.</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <div className="dialog-actions"><button type="button" onClick={onCancel} disabled={isRestoring}>Cancel</button><button type="button" className="primary-button" onClick={() => void restore()} disabled={isRestoring || selected.size === 0}>{isRestoring ? "Restoring..." : `Restore ${selected.size} selected`}</button></div>
    </section>
  </div>;
}
