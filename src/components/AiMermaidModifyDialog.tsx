import type { FormEvent } from "react";
import { useId, useRef, useState } from "react";
import {
  AI_MODEL_OPTIONS,
  AI_QUALITY_OPTIONS,
  resolveAiModel,
  type AiModelId,
  type AiQuality,
  type AiSettings,
} from "../lib/aiSettings";
import { modifyMermaidFlowchart } from "../lib/openaiDiagram";
import { useDialogEscape } from "./useDialogEscape";

type AiMermaidModifyDialogProps = {
  settings: AiSettings;
  source: string;
  onCancel: () => void;
  onModified: (source: string) => void;
};

export function AiMermaidModifyDialog({
  settings,
  source,
  onCancel,
  onModified,
}: AiMermaidModifyDialogProps) {
  const [instruction, setInstruction] = useState("");
  const [selectedModel, setSelectedModel] = useState<AiModelId>(
    settings.selectedModel,
  );
  const [customModel, setCustomModel] = useState(settings.customModel);
  const [quality, setQuality] = useState<AiQuality>(settings.quality);
  const [error, setError] = useState<string | null>(null);
  const [isModifying, setIsModifying] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const instructionId = useId();
  const modelId = useId();
  const customModelId = useId();
  const qualityId = useId();
  const errorId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedInstruction = instruction.trim();

    if (!settings.apiKey.trim()) {
      setError("Add your OpenAI API key in AI settings first.");
      return;
    }

    if (!trimmedInstruction) {
      setError("Describe how to modify the diagram.");
      return;
    }

    const model = resolveAiModel({
      ...settings,
      selectedModel,
      customModel,
      quality,
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsModifying(true);
    setError(null);

    try {
      const modifiedSource = await modifyMermaidFlowchart({
        apiKey: settings.apiKey.trim(),
        model,
        quality,
        instruction: trimmedInstruction,
        source,
        signal: abortController.signal,
      });

      onModified(modifiedSource);
    } catch (modifyError) {
      setError(modifyError instanceof Error ? modifyError.message : String(modifyError));
    } finally {
      abortControllerRef.current = null;
      setIsModifying(false);
    }
  }

  function handleCancel() {
    if (isModifying) {
      abortControllerRef.current?.abort();
      return;
    }

    onCancel();
  }

  useDialogEscape(handleCancel);

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="dialog ai-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="AI modify"
      >
        <h2>AI modify</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor={instructionId}>Modification request</label>
          <textarea
            id={instructionId}
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            rows={6}
            autoFocus
          />

          <div className="ai-field-grid">
            <div>
              <label htmlFor={modelId}>Model</label>
              <select
                id={modelId}
                value={selectedModel}
                onChange={(event) =>
                  setSelectedModel(event.target.value as AiModelId)
                }
              >
                {AI_MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={qualityId}>Quality</label>
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
            </div>
          </div>

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

          {error ? (
            <p className="form-error" id={errorId}>
              {error}
            </p>
          ) : null}

          <div className="dialog-actions">
            <button type="button" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" disabled={isModifying}>
              {isModifying ? "Modifying..." : "Modify"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
