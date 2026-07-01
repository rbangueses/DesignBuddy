import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { modifyMermaidFlowchart } from "../lib/openaiDiagram";
import { AiMermaidModifyDialog } from "./AiMermaidModifyDialog";

vi.mock("../lib/openaiDiagram", () => ({
  modifyMermaidFlowchart: vi.fn(),
}));

const settings = {
  apiKey: "sk-test",
  selectedModel: "gpt-5.4-mini" as const,
  customModel: "",
  quality: "draft" as const,
};

describe("AiMermaidModifyDialog", () => {
  it("modifies Mermaid source", async () => {
    const onModified = vi.fn();
    vi.mocked(modifyMermaidFlowchart).mockResolvedValue(
      "flowchart LR\n  A[Start] --> B[Done]\n",
    );

    render(
      <AiMermaidModifyDialog
        settings={settings}
        source={"flowchart LR\n  A[Start]\n"}
        onCancel={vi.fn()}
        onModified={onModified}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "AI modify" });
    await userEvent.type(
      within(dialog).getByLabelText("Modification request"),
      "add done",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Modify" }));

    await waitFor(() =>
      expect(onModified).toHaveBeenCalledWith(
        "flowchart LR\n  A[Start] --> B[Done]\n",
      ),
    );
    expect(modifyMermaidFlowchart).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "sk-test",
        source: "flowchart LR\n  A[Start]\n",
        instruction: "add done",
      }),
    );
  });
});
