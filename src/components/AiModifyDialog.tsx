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
import {
  AI_OUTPUT_BUDGET_OPTIONS,
  type AiOutputBudget,
} from "../lib/aiTokenBudget";
import { modifyExcalidrawScene } from "../lib/openaiDiagram";
import type { ExcalidrawScene } from "../types/excalidraw";
import { AiGenerationEstimate } from "./AiGenerationEstimate";
import { useDialogEscape } from "./useDialogEscape";

type AiModifyDialogProps = {
  settings: AiSettings;
  scene: ExcalidrawScene;
  onCancel: () => void;
  onModified: (scene: ExcalidrawScene) => void;
};

export function AiModifyDialog({
  settings,
  scene,
  onCancel,
  onModified,
}: AiModifyDialogProps) {
  const [instruction, setInstruction] = useState("");
  const [selectedModel, setSelectedModel] = useState<AiModelId>(
    settings.selectedModel,
  );
  const [customModel, setCustomModel] = useState(settings.customModel);
  const [quality, setQuality] = useState<AiQuality>(settings.quality);
  const [outputBudget, setOutputBudget] =
    useState<AiOutputBudget>("standard");
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingEstimate, setIsConfirmingEstimate] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const instructionId = useId();
  const modelId = useId();
  const customModelId = useId();
  const qualityId = useId();
  const outputBudgetId = useId();
  const errorId = useId();

  function validateRequest() {
    const trimmedInstruction = instruction.trim();

    if (!settings.apiKey.trim()) {
      setError("Add your OpenAI API key in AI settings first.");
      return null;
    }

    if (!trimmedInstruction) {
      setError("Describe how to modify the diagram.");
      return null;
    }

    return trimmedInstruction;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedInstruction = validateRequest();

    if (!trimmedInstruction) {
      return;
    }

    setError(null);
    setIsConfirmingEstimate(true);
  }

  async function handleConfirmModify() {
    const trimmedInstruction = validateRequest();

    if (!trimmedInstruction) {
      setIsConfirmingEstimate(false);
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
    setIsConfirmingEstimate(false);
    setIsModifying(true);
    setError(null);

    try {
      const modifiedScene = await modifyExcalidrawScene({
        apiKey: settings.apiKey.trim(),
        apiBaseUrl: settings.apiBaseUrl,
        model,
        quality,
        outputBudget,
        instruction: trimmedInstruction,
        scene,
        signal: abortController.signal,
      });

      onModified(modifiedScene);
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

    if (isConfirmingEstimate) {
      setIsConfirmingEstimate(false);
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
            <div>
              <label htmlFor={outputBudgetId}>Output token budget</label>
              <select
                id={outputBudgetId}
                value={outputBudget}
                onChange={(event) => {
                  setOutputBudget(event.target.value as AiOutputBudget);
                  setIsConfirmingEstimate(false);
                }}
              >
                {AI_OUTPUT_BUDGET_OPTIONS.map((option) => (
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

          {isConfirmingEstimate ? (
            <AiGenerationEstimate
              kind="excalidraw"
              quality={quality}
              outputBudget={outputBudget}
              isModify
              promptLength={instruction.trim().length}
            />
          ) : null}

          <div className="dialog-actions">
            <button type="button" onClick={handleCancel}>
              Cancel
            </button>
            {isConfirmingEstimate ? (
              <button
                type="button"
                disabled={isModifying}
                onClick={() => {
                  void handleConfirmModify();
                }}
              >
                Modify anyway
              </button>
            ) : (
              <button type="submit" disabled={isModifying}>
                {isModifying ? "Modifying..." : "Modify"}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
