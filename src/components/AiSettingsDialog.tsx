import type { FormEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import {
  AI_MODEL_OPTIONS,
  AI_QUALITY_OPTIONS,
  resolveAiModel,
  validateAiApiBaseUrl,
  type AiModelId,
  type AiQuality,
  type AiSettings,
} from "../lib/aiSettings";
import {
  clearAiDiagnostics,
  downloadAiDiagnostics,
  getAiDiagnosticCount,
} from "../lib/aiDiagnostics";
import type { BackupSettings } from "../lib/backupSettings";
import type { AutomaticBackupResult } from "../types/designs";
import { useDialogEscape } from "./useDialogEscape";
import packageJson from "../../package.json";
import changelog from "../../CHANGELOG.md?raw";

type AiSettingsDialogProps = {
  settings: AiSettings;
  backupSettings: BackupSettings;
  onCancel: () => void;
  onChooseBackupFolder: () => Promise<string | null>;
  onBackUpNow: (backupFolderPath: string) => Promise<{
    projectCount: number;
    fileCount: number;
  }>;
  onBackUpBeforeUpdate: (targetVersion: string) => Promise<AutomaticBackupResult>;
  onRestoreFromBackup: () => void;
  onSave: (settings: AiSettings, backupSettings: BackupSettings) => void;
};

type ChangelogSection = {
  heading: string;
  entries: string[];
};

function parseChangelog(notes: string | undefined): ChangelogSection[] {
  if (!notes?.trim()) {
    return [];
  }

  return notes
    .split(/(?=^## )/m)
    .map((section) => {
      const lines = section
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const heading = lines.shift()?.replace(/^#+\s*/, "");
      if (!heading || (heading === "Changelog" && lines.length === 0)) {
        return null;
      }

      return {
        heading,
        entries: lines.map((line) => line.replace(/^-\s+/, "")),
      };
    })
    .filter((section): section is ChangelogSection => section !== null);
}

export function AiSettingsDialog({
  settings,
  backupSettings,
  onCancel,
  onChooseBackupFolder,
  onBackUpNow,
  onBackUpBeforeUpdate,
  onRestoreFromBackup,
  onSave,
}: AiSettingsDialogProps) {
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [apiBaseUrl, setApiBaseUrl] = useState(settings.apiBaseUrl);
  const [selectedModel, setSelectedModel] = useState<AiModelId>(
    settings.selectedModel,
  );
  const [customModel, setCustomModel] = useState(settings.customModel);
  const [quality, setQuality] = useState<AiQuality>(settings.quality);
  const [enableMermaid, setEnableMermaid] = useState(settings.enableMermaid);
  const [enableDiagnostics, setEnableDiagnostics] = useState(settings.enableDiagnostics);
  const [includeDiagnosticRawResponses, setIncludeDiagnosticRawResponses] = useState(
    settings.includeDiagnosticRawResponses,
  );
  const [diagnosticCount, setDiagnosticCount] = useState(getAiDiagnosticCount);
  const [backupFolderPath, setBackupFolderPath] = useState(
    backupSettings.backupFolderPath,
  );
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [isUpdateReviewOpen, setIsUpdateReviewOpen] = useState(false);
  const [reviewedChangelog, setReviewedChangelog] = useState<string | null>(null);
  const updateRef = useRef<Update | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiKeyId = useId();
  const apiBaseUrlId = useId();
  const modelId = useId();
  const customModelId = useId();
  const qualityId = useId();
  const errorId = useId();

  useDialogEscape(isUpdateReviewOpen ? handleDismissUpdateReview : onCancel);

  useEffect(() => {
    return () => {
      void updateRef.current?.close().catch(() => undefined);
    };
  }, []);

  function replaceAvailableUpdate(update: Update | null) {
    const previousUpdate = updateRef.current;
    updateRef.current = update;
    setAvailableUpdate(update);
    if (previousUpdate && previousUpdate !== update) {
      void previousUpdate.close().catch(() => undefined);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextSettings = {
      apiKey: apiKey.trim(),
      apiBaseUrl: apiBaseUrl.trim(),
      selectedModel,
      customModel: customModel.trim(),
      quality,
      enableMermaid,
      enableDiagnostics,
      includeDiagnosticRawResponses:
        enableDiagnostics && includeDiagnosticRawResponses,
    };

    if (!resolveAiModel(nextSettings)) {
      setError("Choose a model or enter a custom model id.");
      return;
    }

    const apiBaseUrlError = validateAiApiBaseUrl(nextSettings.apiBaseUrl);
    if (apiBaseUrlError) {
      setError(apiBaseUrlError);
      return;
    }

    setError(null);
    onSave(nextSettings, {
      backupFolderPath: backupFolderPath.trim(),
    });
  }

  async function handleChooseBackupFolder() {
    const selectedPath = await onChooseBackupFolder();
    if (!selectedPath) {
      return;
    }

    setBackupFolderPath(selectedPath);
    setBackupStatus(null);
  }

  async function handleBackUpNow() {
    const cleanBackupFolderPath = backupFolderPath.trim();
    if (!cleanBackupFolderPath) {
      setBackupStatus("Choose a backup folder first.");
      return;
    }

    setIsBackingUp(true);
    setBackupStatus(null);
    try {
      const result = await onBackUpNow(cleanBackupFolderPath);
      setBackupStatus(
        `Backed up ${result.fileCount} ${result.fileCount === 1 ? "file" : "files"} across ${result.projectCount} ${
          result.projectCount === 1 ? "project" : "projects"
        }.`,
      );
    } catch (backupError) {
      setBackupStatus(
        backupError instanceof Error
          ? backupError.message
          : String(backupError),
      );
    } finally {
      setIsBackingUp(false);
    }
  }

  async function handleCheckForUpdates() {
    setIsCheckingForUpdates(true);
    setUpdateStatus(null);
    try {
      const update = await check({ timeout: 20_000 });
      replaceAvailableUpdate(update);
      setReviewedChangelog(update?.body || changelog);
      setIsUpdateReviewOpen(true);
      setUpdateStatus(
        update
          ? `Version ${update.version} is ready to review.`
          : "You’re up to date.",
      );
    } catch (updateError) {
      replaceAvailableUpdate(null);
      setUpdateStatus(
        updateError instanceof Error
          ? `Couldn’t check for updates: ${updateError.message}`
          : "Couldn’t check for updates. Try again later.",
      );
    } finally {
      setIsCheckingForUpdates(false);
    }
  }

  function handleDismissUpdateReview() {
    const version = updateRef.current?.version;
    setIsUpdateReviewOpen(false);
    replaceAvailableUpdate(null);
    setReviewedChangelog(null);
    if (version) {
      setUpdateStatus(`Update to ${version} was not installed.`);
    }
  }

  async function handleInstallUpdate() {
    const update = updateRef.current;
    if (!update) return;

    setIsInstallingUpdate(true);
    setUpdateStatus(`Backing up your library before installing ${update.version}…`);

    try {
      const backup = await onBackUpBeforeUpdate(update.version);
      setUpdateStatus(
        `Backup complete (${backup.fileCount} ${backup.fileCount === 1 ? "file" : "files"}). Downloading ${update.version}…`,
      );
      let contentLength = 0;
      let downloadedBytes = 0;
      await update.download((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength ?? 0;
          downloadedBytes = 0;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          if (contentLength > 0) {
            setUpdateStatus(
              `Downloading ${update.version} (${Math.min(100, Math.round((downloadedBytes / contentLength) * 100))}%)…`,
            );
          }
        }
      }, { timeout: 120_000 });
      setUpdateStatus(`Installing ${update.version}…`);
      await update.install();
      replaceAvailableUpdate(null);
      setIsUpdateReviewOpen(false);
      setReviewedChangelog(null);
      setUpdateStatus(
        `Version ${update.version} is installed. Quit and reopen DesignBuddy to start using it.`,
      );
    } catch (updateError) {
      setUpdateStatus(
        updateError instanceof Error
          ? `Update was not installed: ${updateError.message}`
          : "Update was not installed. Your current version is still available.",
      );
    } finally {
      setIsInstallingUpdate(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="dialog ai-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <h2>Settings</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor={apiKeyId}>AI API key</label>
          <input
            id={apiKeyId}
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-..."
            autoFocus
          />

          <label htmlFor={apiBaseUrlId}>AI API base URL</label>
          <input
            id={apiBaseUrlId}
            type="url"
            value={apiBaseUrl}
            onChange={(event) => setApiBaseUrl(event.target.value)}
            placeholder="https://api.openai.com/v1"
          />
          <p className="settings-help">
            Use your LiteLLM proxy URL for a virtual key. The app sends requests to the Responses API.
          </p>

          <label htmlFor={modelId}>Default model</label>
          <select
            id={modelId}
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value as AiModelId)}
          >
            {AI_MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} - {option.description}
              </option>
            ))}
          </select>

          {selectedModel === "custom" ? (
            <>
              <label htmlFor={customModelId}>Custom model</label>
              <input
                id={customModelId}
                value={customModel}
                onChange={(event) => setCustomModel(event.target.value)}
                placeholder="gpt-..."
              />
            </>
          ) : null}

          <label htmlFor={qualityId}>Default quality</label>
          <select
            id={qualityId}
            value={quality}
            onChange={(event) => setQuality(event.target.value as AiQuality)}
          >
            {AI_QUALITY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={enableMermaid}
              onChange={(event) => setEnableMermaid(event.target.checked)}
            />
            Enable Mermaid diagrams
          </label>

          <section className="settings-section ai-diagnostics-section">
            <h3>AI diagnostics</h3>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={enableDiagnostics}
                onChange={(event) => setEnableDiagnostics(event.target.checked)}
              />
              Keep local AI diagnostics
            </label>
            <p className="settings-help">
              Keeps the latest 20 generation summaries on this Mac. It never stores your API key or reference-image data.
            </p>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={includeDiagnosticRawResponses}
                disabled={!enableDiagnostics}
                onChange={(event) => setIncludeDiagnosticRawResponses(event.target.checked)}
              />
              Include raw AI responses in exports
            </label>
            <p className="settings-help">
              Raw responses can contain diagram labels and other sensitive content.
            </p>
            <div className="diagnostics-actions">
              <button
                type="button"
                onClick={downloadAiDiagnostics}
                disabled={diagnosticCount === 0}
              >
                Download diagnostics ({diagnosticCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAiDiagnostics();
                  setDiagnosticCount(0);
                }}
                disabled={diagnosticCount === 0}
              >
                Clear diagnostics
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>Backup</h3>
            <p className="settings-help">
              Copy the local design library to a folder you control, such as a
              Google Drive folder.
            </p>
            <div className="backup-folder-row">
              <span className="backup-folder-path">
                {backupFolderPath.trim() || "No backup folder selected"}
              </span>
              <button type="button" onClick={handleChooseBackupFolder}>
                Choose backup folder
              </button>
            </div>
            <button
              type="button"
              onClick={handleBackUpNow}
              disabled={isBackingUp || !backupFolderPath.trim()}
            >
              {isBackingUp ? "Backing up..." : "Back up now"}
            </button>
            <button type="button" onClick={onRestoreFromBackup} disabled={isBackingUp}>
              Restore from backup
            </button>
            {backupStatus ? (
              <p className="settings-status">{backupStatus}</p>
            ) : null}
          </section>

          <section className="settings-section update-section">
            <h3>Updates</h3>
            <p className="settings-help">
              Updates are downloaded only from DesignBuddy’s signed release channel. Before installation, this Mac automatically saves a restorable copy of your library in Documents/DesignBuddy/Backups.
            </p>
            <div className="update-actions">
              <button
                type="button"
                onClick={handleCheckForUpdates}
                disabled={isCheckingForUpdates || isInstallingUpdate}
              >
                {isCheckingForUpdates ? "Checking for updates..." : "Check for updates"}
              </button>
              {availableUpdate && !isUpdateReviewOpen ? (
                <button
                  type="button"
                  className="update-install-button"
                  onClick={() => setIsUpdateReviewOpen(true)}
                  disabled={isInstallingUpdate}
                >
                  {`Review ${availableUpdate.version}`}
                </button>
              ) : null}
            </div>
            {updateStatus ? (
              <p className="settings-status update-status" role="status" aria-live="polite">
                {updateStatus}
              </p>
            ) : null}
          </section>

          <p className="settings-version">DesignBuddy {packageJson.version}</p>

          {error ? (
            <p className="form-error" id={errorId}>
              {error}
            </p>
          ) : null}

          <div className="dialog-actions">
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit">Save settings</button>
          </div>
        </form>
      </section>
      {isUpdateReviewOpen ? (
        <div className="dialog-backdrop update-review-backdrop" role="presentation">
          <section
            className="dialog update-review-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-review-title"
          >
            <div className="update-review-header">
              <p>{availableUpdate ? "Update available" : "You’re up to date"}</p>
              <h2 id="update-review-title">
                DesignBuddy {availableUpdate?.version ?? packageJson.version}
              </h2>
              <span>
                {availableUpdate
                  ? `Currently installed: ${availableUpdate.currentVersion}`
                  : "You already have the latest available release."}
              </span>
            </div>
            <p className="update-review-intro">
              {availableUpdate
                ? "Review the changes before updating. A dated backup of your local library will be created before any download starts."
                : "Here’s what’s included in your installed version and the releases before it."}
            </p>
            <div className="update-changelog" aria-label="Release notes">
              {parseChangelog(reviewedChangelog ?? changelog).length > 0 ? (
                parseChangelog(reviewedChangelog ?? changelog).map((section) => (
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
            {updateStatus ? (
              <p className="settings-status update-status" role="status" aria-live="polite">
                {updateStatus}
              </p>
            ) : null}
            <div className="dialog-actions update-review-actions">
              <button type="button" onClick={handleDismissUpdateReview} disabled={isInstallingUpdate}>
                {availableUpdate ? "Cancel" : "Close"}
              </button>
              {availableUpdate ? (
                <button
                  type="button"
                  className="update-install-button"
                  onClick={handleInstallUpdate}
                  disabled={isInstallingUpdate}
                >
                  {isInstallingUpdate ? "Updating..." : `Update to ${availableUpdate.version}`}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
