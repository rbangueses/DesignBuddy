import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { save } from "@tauri-apps/plugin-dialog";
import { NoteEditorView } from "./NoteEditorView";

vi.mock("../lib/designApi", () => ({
  designApi: {
    copyDesign: vi.fn(),
    listProjects: vi.fn(),
    moveDesign: vi.fn(),
    writeDesign: vi.fn(),
    renameDesign: vi.fn(),
    duplicateDesign: vi.fn(),
    exportDesign: vi.fn(),
  },
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
}));

const { designApi } = await import("../lib/designApi");

describe("NoteEditorView", () => {
  it("renders rich text controls and saves a note document", async () => {
    const user = userEvent.setup();
    vi.mocked(designApi.writeDesign).mockResolvedValue({
      project: "App",
      name: "Notes",
      fileName: "Notes.bdnote",
      kind: "note",
      content: {
        type: "banguesesdraw-note",
        version: 1,
        content: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
        },
      },
    });

    render(
      <NoteEditorView
        project="App"
        fileName="Notes.bdnote"
        initialContent={{
          type: "banguesesdraw-note",
          version: 1,
          content: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
          },
        }}
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Bold" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Italic" })).toBeVisible();
    expect(screen.getByText("Hello")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(designApi.writeDesign).toHaveBeenCalledWith(
        "App",
        "Notes.bdnote",
        expect.objectContaining({
          type: "banguesesdraw-note",
          content: expect.objectContaining({ type: "doc" }),
        }),
      ),
    );
  });

  it("exports a note from the shared export menu", async () => {
    const user = userEvent.setup();

    vi.mocked(save).mockResolvedValue("/tmp/Notes.bdnote");
    vi.mocked(designApi.exportDesign).mockResolvedValue(undefined);

    render(
      <NoteEditorView
        project="App"
        fileName="Notes.bdnote"
        initialContent={{
          type: "banguesesdraw-note",
          version: 1,
          content: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
          },
        }}
        onBack={vi.fn()}
        onDesignMoved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("menuitem", { name: /DesignBuddy note/i }));

    await waitFor(() =>
      expect(designApi.exportDesign).toHaveBeenCalledWith(
        "App",
        "Notes.bdnote",
        "/tmp/Notes.bdnote",
      ),
    );
    expect(save).toHaveBeenCalledWith({
      title: "Export DesignBuddy note",
      defaultPath: "Notes.bdnote",
      filters: [{ name: "DesignBuddy note", extensions: ["bdnote"] }],
    });
  });
});
