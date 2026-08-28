import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeDiagramPrompt,
  generateExcalidrawScene,
  generateMermaidFlowchart,
} from "../lib/openaiDiagram";
import type { ExcalidrawScene } from "../types/excalidraw";
import { AiDiagramDialog } from "./AiDiagramDialog";

vi.mock("../lib/openaiDiagram", () => ({
  analyzeDiagramPrompt: vi.fn(),
  generateExcalidrawScene: vi.fn(),
  generateMermaidFlowchart: vi.fn(),
}));

const settings = {
  apiKey: "sk-test",
  selectedModel: "gpt-5.4-mini" as const,
  customModel: "",
  quality: "balanced" as const,
  enableMermaid: true,
};

const generatedScene: ExcalidrawScene = {
  type: "excalidraw",
  elements: [{ id: "one", type: "rectangle" }],
  appState: {},
  files: {},
};

describe("AiDiagramDialog", () => {
  beforeEach(() => {
    vi.mocked(analyzeDiagramPrompt).mockReset();
    vi.mocked(generateExcalidrawScene).mockReset();
    vi.mocked(generateMermaidFlowchart).mockReset();
  });

  it("analyzes the prompt, lets the user edit the optimized prompt, then generates", async () => {
    const user = userEvent.setup();
    const onGenerated = vi.fn();
    vi.mocked(analyzeDiagramPrompt).mockResolvedValue({
      recommendedKind: "excalidraw",
      recommendedQuality: "balanced",
      recommendedBudget: "extended",
      expectedOutputTokenRange: "40k-60k",
      completionRisk: "Medium",
      reason: "The request needs grouped visual architecture blocks.",
      optimizedPrompt: "Create a compact Excalidraw diagram with grouped lanes.",
    });
    vi.mocked(generateExcalidrawScene).mockResolvedValue(generatedScene);

    render(
      <AiDiagramDialog
        settings={settings}
        onCancel={vi.fn()}
        onGenerated={onGenerated}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "AI diagram" });
    await user.type(
      within(dialog).getByLabelText("Diagram description"),
      "Draw a contact center flow",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Analyze prompt" }),
    );

    await waitFor(() =>
      expect(analyzeDiagramPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Draw a contact center flow",
          preferredKind: "excalidraw",
        }),
      ),
    );
    expect(generateExcalidrawScene).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText("AI recommendation"),
    ).toBeVisible();
    expect(within(dialog).getByText("40k-60k")).toBeVisible();
    expect(
      within(dialog).getByDisplayValue(
        "Create a compact Excalidraw diagram with grouped lanes.",
      ),
    ).toBeVisible();

    const optimizedPrompt = within(dialog).getByLabelText("Optimized prompt");
    await user.clear(optimizedPrompt);
    await user.type(
      optimizedPrompt,
      "Create an edited compact Excalidraw diagram.",
    );
    expect(within(dialog).getByLabelText("Output token budget")).toHaveValue(
      "extended",
    );
    await user.click(within(dialog).getByRole("button", { name: "Generate" }));

    await waitFor(() =>
      expect(generateExcalidrawScene).toHaveBeenCalledWith(
        expect.objectContaining({
          outputBudget: "extended",
          prompt: "Create an edited compact Excalidraw diagram.",
        }),
      ),
    );
    expect(onGenerated).toHaveBeenCalledWith({
      kind: "excalidraw",
      name: "AI Diagram",
      scene: generatedScene,
    });
  });

  it("keeps an explicit Mermaid selection without Excalidraw budget controls", async () => {
    const user = userEvent.setup();
    vi.mocked(analyzeDiagramPrompt).mockResolvedValue({
      recommendedKind: "mermaid",
      recommendedQuality: "balanced",
      recommendedBudget: "standard",
      expectedOutputTokenRange: "5k-10k",
      completionRisk: "Low",
      reason: "The request can be represented compactly as a flowchart.",
      optimizedPrompt: "Create a compact Mermaid flowchart.",
    });
    vi.mocked(generateMermaidFlowchart).mockResolvedValue(
      "flowchart LR\n  A[Start] --> B[Done]\n",
    );

    render(
      <AiDiagramDialog
        settings={settings}
        onCancel={vi.fn()}
        onGenerated={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "AI diagram" });
    await user.type(
      within(dialog).getByLabelText("Diagram description"),
      "Draw a simple flow",
    );
    await user.click(within(dialog).getByRole("button", { name: "Mermaid" }));
    await user.click(
      within(dialog).getByRole("button", { name: "Analyze prompt" }),
    );

    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Mermaid" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(
      within(dialog).queryByLabelText("Output token budget"),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByText("5k-10k")).toBeVisible();
    expect(analyzeDiagramPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ preferredKind: "mermaid" }),
    );

    await user.click(within(dialog).getByRole("button", { name: "Generate" }));

    await waitFor(() => expect(generateMermaidFlowchart).toHaveBeenCalled());
  });

  it("keeps the selected Excalidraw output when analysis recommends Mermaid", async () => {
    const user = userEvent.setup();
    const onGenerated = vi.fn();
    vi.mocked(analyzeDiagramPrompt).mockResolvedValue({
      recommendedKind: "mermaid",
      recommendedQuality: "balanced",
      recommendedBudget: "standard",
      expectedOutputTokenRange: "5k-10k",
      completionRisk: "Low",
      reason: "The request could be represented compactly as a flowchart.",
      optimizedPrompt: "Create a compact architecture diagram.",
    });
    vi.mocked(generateExcalidrawScene).mockResolvedValue(generatedScene);

    render(
      <AiDiagramDialog
        settings={settings}
        onCancel={vi.fn()}
        onGenerated={onGenerated}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "AI diagram" });
    expect(
      within(dialog).getByRole("button", { name: "Excalidraw" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.type(
      within(dialog).getByLabelText("Diagram description"),
      "Draw a visual architecture map",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Analyze prompt" }),
    );

    expect(analyzeDiagramPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ preferredKind: "excalidraw" }),
    );
    await waitFor(() =>
      expect(within(dialog).getByText("AI recommendation")).toBeVisible(),
    );
    expect(
      within(dialog).getByRole("button", { name: "Excalidraw" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByLabelText("Output token budget")).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: "Generate" }));

    await waitFor(() =>
      expect(generateExcalidrawScene).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Create a compact architecture diagram.",
        }),
      ),
    );
    expect(generateMermaidFlowchart).not.toHaveBeenCalled();
    expect(onGenerated).toHaveBeenCalledWith({
      kind: "excalidraw",
      name: "AI Diagram",
      scene: generatedScene,
    });
  });
});
