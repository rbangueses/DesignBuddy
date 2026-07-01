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
  generateExcalidrawScene,
  generateMermaidFlowchart,
} from "../lib/openaiDiagram";
import type { ExcalidrawScene } from "../types/excalidraw";

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
  const [outputMode, setOutputMode] = useState<"excalidraw" | "mermaid">(
    "excalidraw",
  );
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const nameId = useId();
  const promptId = useId();
  const modelId = useId();
  const customModelId = useId();
  const qualityId = useId();
  const errorId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
      if (outputMode === "mermaid") {
        const source = await generateMermaidFlowchart({
          apiKey: settings.apiKey.trim(),
          model,
          quality,
          description: trimmedPrompt,
          signal: abortController.signal,
        });

        await onGenerated({ kind: "mermaid", name: name.trim(), source });
      } else {
        const scene = await generateExcalidrawScene({
          apiKey: settings.apiKey.trim(),
          model,
          quality,
          prompt: trimmedPrompt,
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
    if (isGenerating) {
      abortControllerRef.current?.abort();
      return;
    }

    onCancel();
  }

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
            onChange={(event) => setPrompt(event.target.value)}
            rows={6}
          />

          <div className="segmented-control" aria-label="Diagram output">
            <button
              type="button"
              className={outputMode === "excalidraw" ? "active" : ""}
              onClick={() => setOutputMode("excalidraw")}
            >
              Excalidraw
            </button>
            <button
              type="button"
              className={outputMode === "mermaid" ? "active" : ""}
              onClick={() => setOutputMode("mermaid")}
            >
              Mermaid
            </button>
          </div>

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
            <button type="submit" disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Generate"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
