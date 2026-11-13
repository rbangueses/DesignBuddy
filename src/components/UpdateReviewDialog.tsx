import type { Update } from "@tauri-apps/plugin-updater";
import packageJson from "../../package.json";
import changelog from "../../CHANGELOG.md?raw";
import { parseChangelog } from "../lib/changelog";

type UpdateReviewDialogProps = {
  update: Update | null;
  releaseNotes?: string | null;
  status?: string | null;
  isInstalling?: boolean;
  onCancel: () => void;
  onInstall: () => void;
};

export function UpdateReviewDialog({
  update,
  releaseNotes,
  status,
  isInstalling = false,
  onCancel,
  onInstall,
}: UpdateReviewDialogProps) {
  const sections = parseChangelog(releaseNotes ?? changelog);

  return (
    <div className="dialog-backdrop update-review-backdrop" role="presentation">
      <section
        className="dialog update-review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-review-title"
      >
        <div className="update-review-header">
          <p>{update ? "Update available" : "You’re up to date"}</p>
          <h2 id="update-review-title">
            DesignBuddy {update?.version ?? packageJson.version}
          </h2>
          <span>
            {update
              ? `Currently installed: ${update.currentVersion}`
              : "You already have the latest available release."}
          </span>
        </div>
        <p className="update-review-intro">
          {update
            ? "Review the changes before updating. A dated backup of your local library will be created before any download starts."
            : "Here’s what’s included in your installed version and the releases before it."}
        </p>
        <div className="update-changelog" aria-label="Release notes">
          {sections.length > 0 ? (
            sections.map((section) => (
              <section className="update-changelog-section" key={section.heading}>
                <h3>{section.heading}</h3>
                {section.entries.length > 0 ? (
                  <ul>
                    {section.entries.map((entry, index) => (
                      <li key={`${section.heading}-${index}`}>{entry}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))
          ) : (
            <p>Release notes are unavailable for this update.</p>
          )}
        </div>
        {status ? (
          <p className="settings-status update-status" role="status" aria-live="polite">
            {status}
          </p>
        ) : null}
        <div className="dialog-actions update-review-actions">
          <button type="button" onClick={onCancel} disabled={isInstalling}>
            {update ? "Cancel" : "Close"}
          </button>
          {update ? (
            <button
              type="button"
              className="update-install-button"
              onClick={onInstall}
              disabled={isInstalling}
            >
              {isInstalling ? "Updating..." : `Update to ${update.version}`}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
