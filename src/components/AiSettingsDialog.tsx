import type { FormEvent } from "react";
import { useId, useState } from "react";
import {
  AI_MODEL_OPTIONS,
  AI_QUALITY_OPTIONS,
  resolveAiModel,
  type AiModelId,
  type AiQuality,
  type AiSettings,
} from "../lib/aiSettings";
import type { BackupSettings } from "../lib/backupSettings";
import { useDialogEscape } from "./useDialogEscape";

type AiSettingsDialogProps = {
  settings: AiSettings;
  backupSettings: BackupSettings;
  onCancel: () => void;
  onChooseBackupFolder: () => Promise<string | null>;
  onBackUpNow: (backupFolderPath: string) => Promise<{
    projectCount: number;
    fileCount: number;
  }>;
  onRestoreFromBackup: () => void;
  onSave: (settings: AiSettings, backupSettings: BackupSettings) => void;
};

export function AiSettingsDialog({
  settings,
  backupSettings,
  onCancel,
  onChooseBackupFolder,
  onBackUpNow,
  onRestoreFromBackup,
  onSave,
}: AiSettingsDialogProps) {
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [selectedModel, setSelectedModel] = useState<AiModelId>(
    settings.selectedModel,
  );
  const [customModel, setCustomModel] = useState(settings.customModel);
  const [quality, setQuality] = useState<AiQuality>(settings.quality);
  const [enableMermaid, setEnableMermaid] = useState(settings.enableMermaid);
  const [backupFolderPath, setBackupFolderPath] = useState(
    backupSettings.backupFolderPath,
  );
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiKeyId = useId();
  const modelId = useId();
  const customModelId = useId();
  const qualityId = useId();
  const errorId = useId();

  useDialogEscape(onCancel);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextSettings = {
      apiKey: apiKey.trim(),
      selectedModel,
      customModel: customModel.trim(),
      quality,
      enableMermaid,
    };

    if (!resolveAiModel(nextSettings)) {
      setError("Choose a model or enter a custom model id.");
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
          <label htmlFor={apiKeyId}>OpenAI API key</label>
          <input
            id={apiKeyId}
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-..."
            autoFocus
          />

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
    </div>
  );
}
