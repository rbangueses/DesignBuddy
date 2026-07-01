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

type AiSettingsDialogProps = {
  settings: AiSettings;
  onCancel: () => void;
  onSave: (settings: AiSettings) => void;
};

export function AiSettingsDialog({
  settings,
  onCancel,
  onSave,
}: AiSettingsDialogProps) {
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [selectedModel, setSelectedModel] = useState<AiModelId>(
    settings.selectedModel,
  );
  const [customModel, setCustomModel] = useState(settings.customModel);
  const [quality, setQuality] = useState<AiQuality>(settings.quality);
  const [error, setError] = useState<string | null>(null);
  const apiKeyId = useId();
  const modelId = useId();
  const customModelId = useId();
  const qualityId = useId();
  const errorId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextSettings = {
      apiKey: apiKey.trim(),
      selectedModel,
      customModel: customModel.trim(),
      quality,
    };

    if (!resolveAiModel(nextSettings)) {
      setError("Choose a model or enter a custom model id.");
      return;
    }

    setError(null);
    onSave(nextSettings);
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="dialog ai-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="AI settings"
      >
        <h2>AI settings</h2>
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
