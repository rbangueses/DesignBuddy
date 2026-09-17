import type { AiQuality } from "../lib/aiSettings";
import {
  estimateCompletionRisk,
  formatTokenBudget,
  getExcalidrawMaxOutputTokens,
  getMermaidMaxOutputTokens,
  type AiOutputBudget,
  type AiOutputKind,
} from "../lib/aiTokenBudget";

type AiGenerationEstimateProps = {
  kind: AiOutputKind;
  quality: AiQuality;
  outputBudget?: AiOutputBudget;
  customMaxOutputTokens?: number;
  isModify?: boolean;
  promptLength?: number;
};

export function AiGenerationEstimate({
  kind,
  quality,
  outputBudget = "standard",
  customMaxOutputTokens,
  isModify = false,
  promptLength = 0,
}: AiGenerationEstimateProps) {
  const maxOutputTokens =
    kind === "mermaid"
      ? getMermaidMaxOutputTokens(quality)
      : getExcalidrawMaxOutputTokens(
          quality,
          outputBudget,
          customMaxOutputTokens,
        );
  const completionRisk = estimateCompletionRisk({
    kind,
    quality,
    outputBudget,
    isModify,
    promptLength,
  });

  return (
    <div className="ai-estimate" role="status">
      <h3>Generation size estimate</h3>
      <dl>
        <div>
          <dt>Output type</dt>
          <dd>{kind === "mermaid" ? "Mermaid" : "Excalidraw"}</dd>
        </div>
        <div>
          <dt>Output token budget</dt>
          <dd>{formatTokenBudget(maxOutputTokens)}</dd>
        </div>
        <div>
          <dt>Completion risk</dt>
          <dd>{completionRisk}</dd>
        </div>
      </dl>
      <p>
        Large Excalidraw JSON diagrams can still fail if the response is too
        large. Mermaid usually completes more reliably because it is compact.
      </p>
    </div>
  );
}
