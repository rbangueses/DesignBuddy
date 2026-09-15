import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { modifyExcalidrawScene } from "../lib/openaiDiagram";
import type { ExcalidrawScene } from "../types/excalidraw";
import { AiModifyDialog } from "./AiModifyDialog";

vi.mock("../lib/openaiDiagram", () => ({
  modifyExcalidrawScene: vi.fn(),
}));

const settings = {
  apiKey: "sk-test",
  apiBaseUrl: "https://api.openai.com/v1",
  selectedModel: "gpt-5.4-mini" as const,
  customModel: "",
  quality: "balanced" as const,
  enableMermaid: true,
};

const scene: ExcalidrawScene = {
  type: "excalidraw",
  elements: [{ id: "existing", type: "rectangle" }],
  appState: {},
  files: {},
};

describe("AiModifyDialog", () => {
  it("confirms the selected token budget before modifying an Excalidraw scene", async () => {
    const user = userEvent.setup();
    const onModified = vi.fn();
    vi.mocked(modifyExcalidrawScene).mockResolvedValue(scene);

    render(
      <AiModifyDialog
        settings={settings}
        scene={scene}
        onCancel={vi.fn()}
        onModified={onModified}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "AI modify" });
    await user.type(
      within(dialog).getByLabelText("Modification request"),
      "Add monitoring",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Output token budget"),
      "maximum",
    );
    await user.click(within(dialog).getByRole("button", { name: "Modify" }));

    expect(modifyExcalidrawScene).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Up to 80,000 tokens")).toBeVisible();

    await user.click(
      within(dialog).getByRole("button", { name: "Modify anyway" }),
    );

    await waitFor(() =>
      expect(modifyExcalidrawScene).toHaveBeenCalledWith(
        expect.objectContaining({
          instruction: "Add monitoring",
          outputBudget: "maximum",
        }),
      ),
    );
    expect(onModified).toHaveBeenCalledWith(scene);
  });
});
