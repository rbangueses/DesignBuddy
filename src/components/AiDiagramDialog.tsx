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
import { validateDisplayName } from "../lib/designNames";
import {
  analyzeDiagramPrompt,
  generateExcalidrawScene,
  generateMermaidFlowchart,
  type DiagramPromptAnalysis,
} from "../lib/openaiDiagram";
import {
  AI_OUTPUT_BUDGET_OPTIONS,
  type AiOutputBudget,
  type AiOutputKind,
} from "../lib/aiTokenBudget";
import type { ExcalidrawScene } from "../types/excalidraw";
import { useDialogEscape } from "./useDialogEscape";

type AiDiagramDialogProps = {
  settings: AiSettings;
  onCancel: () => void;
  onGenerated: (
    result:
      | { kind: "excalidraw"; name: string; scene: ExcalidrawScene }
      | { kind: "mermaid"; name: string; source: string },
  ) => Promise<void> | void;
};

export function AiDiagramDialog({
  settings,
  onCancel,
  onGenerated,
}: AiDiagramDialogProps) {
  const [name, setName] = useState("AI Diagram");
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<AiModelId>(
    settings.selectedModel,
  );
  const [customModel, setCustomModel] = useState(settings.customModel);
  const [quality, setQuality] = useState<AiQuality>(settings.quality);
  const [outputBudget, setOutputBudget] =
    useState<AiOutputBudget>("standard");
  const [outputMode, setOutputMode] = useState<AiOutputKind>("excalidraw");
  const enableMermaid = settings.enableMermaid;
  const effectiveOutputMode = enableMermaid ? outputMode : "excalidraw";
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DiagramPromptAnalysis | null>(null);
  const [optimizedPrompt, setOptimizedPrompt] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const nameId = useId();
  const promptId = useId();
  const optimizedPromptId = useId();
  const modelId = useId();
  const customModelId = useId();
  const qualityId = useId();
  const outputBudgetId = useId();
  const errorId = useId();

  function resetAnalysis() {
    setAnalysis(null);
    setOptimizedPrompt("");
  }

  function validateRequest() {
    const trimmedPrompt = prompt.trim();
    const nameValidation = validateDisplayName(name);

    if (nameValidation) {
      setError(nameValidation);
      return;
    }

    if (!settings.apiKey.trim()) {
      setError("Add your OpenAI API key in AI settings first.");
      return;
    }

    if (!trimmedPrompt) {
      setError("Describe the diagram to generate.");
      return null;
    }

    return trimmedPrompt;
  }

  async function handleAnalyzePrompt(sourcePrompt?: string) {
    const trimmedPrompt = validateRequest();
    const promptToAnalyze = sourcePrompt?.trim() || trimmedPrompt;

    if (!promptToAnalyze) {
      return;
    }

    const model = resolveAiModel({
      ...settings,
      selectedModel,
      customModel,
      quality,
    });

    setIsAnalyzing(true);
    setError(null);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const nextAnalysis = await analyzeDiagramPrompt({
        apiKey: settings.apiKey.trim(),
        apiBaseUrl: settings.apiBaseUrl,
        model,
        description: promptToAnalyze,
        preferredKind: effectiveOutputMode,
        signal: abortController.signal,
      });

      setAnalysis(nextAnalysis);
      setOptimizedPrompt(nextAnalysis.optimizedPrompt);
      setQuality(nextAnalysis.recommendedQuality);
      setOutputBudget(nextAnalysis.recommendedBudget);
    } catch (analyzeError) {
      setError(
        analyzeError instanceof Error
          ? analyzeError.message
          : String(analyzeError),
      );
    } finally {
      abortControllerRef.current = null;
      setIsAnalyzing(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!analysis) {
      void handleAnalyzePrompt();
      return;
    }

    void handleConfirmGeneration();
  }

  async function handleConfirmGeneration() {
    const trimmedPrompt = validateRequest();
    const finalPrompt = optimizedPrompt.trim() || trimmedPrompt;

    if (!finalPrompt) {
      setError("Review the optimized prompt before generating.");
      return;
    }

    const model = resolveAiModel({
      ...settings,
      selectedModel,
      customModel,
      quality,
    });

    setIsGenerating(true);
    setError(null);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      if (effectiveOutputMode === "mermaid") {
        const source = await generateMermaidFlowchart({
          apiKey: settings.apiKey.trim(),
          apiBaseUrl: settings.apiBaseUrl,
          model,
          quality,
          description: finalPrompt,
          signal: abortController.signal,
        });

        await onGenerated({ kind: "mermaid", name: name.trim(), source });
      } else {
        const scene = await generateExcalidrawScene({
          apiKey: settings.apiKey.trim(),
          apiBaseUrl: settings.apiBaseUrl,
          model,
          quality,
          outputBudget,
          prompt: finalPrompt,
          signal: abortController.signal,
        });

        await onGenerated({ kind: "excalidraw", name: name.trim(), scene });
      }
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : String(generateError),
      );
    } finally {
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  }

  function handleCancel() {
    if (isGenerating || isAnalyzing) {
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
        aria-label="AI diagram"
      >
        <h2>AI diagram</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor={nameId}>Design name</label>
          <input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />

          <label htmlFor={promptId}>Diagram description</label>
          <textarea
            id={promptId}
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
              resetAnalysis();
            }}
            rows={6}
          />

          {enableMermaid ? (
            <div className="segmented-control" aria-label="Diagram output">
              <button
                type="button"
                className={outputMode === "excalidraw" ? "active" : ""}
                aria-pressed={outputMode === "excalidraw"}
                onClick={() => {
                  setOutputMode("excalidraw");
                }}
              >
                Excalidraw
              </button>
              <button
                type="button"
                className={outputMode === "mermaid" ? "active" : ""}
                aria-pressed={outputMode === "mermaid"}
                onClick={() => {
                  setOutputMode("mermaid");
                }}
              >
                Mermaid
              </button>
            </div>
          ) : null}

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
            {effectiveOutputMode === "excalidraw" ? (
              <div>
                <label htmlFor={outputBudgetId}>Output token budget</label>
                <select
                  id={outputBudgetId}
                  value={outputBudget}
                  onChange={(event) => {
                    setOutputBudget(event.target.value as AiOutputBudget);
                  }}
                >
                  {AI_OUTPUT_BUDGET_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
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

          {analysis ? (
            <section className="ai-recommendation">
              <h3>AI recommendation</h3>
              <dl>
                <div>
                  <dt>Recommended type</dt>
                  <dd>
                    {analysis.recommendedKind === "mermaid"
                      ? "Mermaid"
                      : "Excalidraw"}
                  </dd>
                </div>
                <div>
                  <dt>Expected output</dt>
                  <dd>{analysis.expectedOutputTokenRange}</dd>
                </div>
                <div>
                  <dt>Completion risk</dt>
                  <dd>{analysis.completionRisk}</dd>
                </div>
              </dl>
              <p>{analysis.reason}</p>
              <label htmlFor={optimizedPromptId}>Optimized prompt</label>
              <textarea
                id={optimizedPromptId}
                value={optimizedPrompt}
                onChange={(event) => setOptimizedPrompt(event.target.value)}
                rows={7}
              />
            </section>
          ) : null}

          <div className="dialog-actions">
            <button type="button" onClick={handleCancel}>
              Cancel
            </button>
            {analysis ? (
              <>
                <button
                  type="button"
                  disabled={isAnalyzing || isGenerating}
                  onClick={() => {
                    void handleAnalyzePrompt(optimizedPrompt);
                  }}
                >
                  {isAnalyzing ? "Analyzing..." : "Re-analyze"}
                </button>
                <button type="submit" disabled={isGenerating || isAnalyzing}>
                  {isGenerating ? "Generating..." : "Generate"}
                </button>
              </>
            ) : (
              <button
                type="submit"
                disabled={isGenerating || isAnalyzing}
              >
                {isAnalyzing ? "Analyzing..." : "Analyze prompt"}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
