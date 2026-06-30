import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./lib/designApi", () => ({
  designApi: {
    readDesign: vi.fn(),
  },
}));

const { designApi } = await import("./lib/designApi");

vi.mock("./components/LibraryView", () => ({
  LibraryView: ({
    openError,
    onOpenDesign,
  }: {
    openError?: string | null;
    onOpenDesign: (project: string, fileName: string) => void;
  }) => (
    <section aria-label="Design library">
      <h1>BanguesesDraw</h1>
      {openError ? <div>{openError}</div> : null}
      <button
        type="button"
        onClick={() => onOpenDesign("App", "Flow.excalidraw")}
      >
        Open sample design
      </button>
    </section>
  ),
}));

vi.mock("./components/EditorView", () => ({
  EditorView: ({
    project,
    fileName,
    onDesignMoved,
    onBack,
  }: {
    project: string;
    fileName: string;
    onDesignMoved: (
      project: string,
      fileName: string,
      content: {
        type: "excalidraw";
        elements: unknown[];
        appState: Record<string, unknown>;
        files: Record<string, unknown>;
      },
    ) => void;
    onBack: () => void;
  }) => (
    <section aria-label="Editor">
      <p>
        {project} / {fileName}
      </p>
      <button
        type="button"
        onClick={() =>
          onDesignMoved("App", "Renamed.excalidraw", {
            type: "excalidraw",
            elements: [],
            appState: {},
            files: {},
          })
        }
      >
        Rename in editor
      </button>
      <button type="button" onClick={onBack}>
        Back
      </button>
    </section>
  ),
}));

describe("App", () => {
  beforeEach(() => {
    vi.mocked(designApi.readDesign).mockReset();
    vi.mocked(designApi.readDesign).mockResolvedValue({
      project: "App",
      name: "Flow",
      fileName: "Flow.excalidraw",
      content: { type: "excalidraw", elements: [], appState: {}, files: {} },
    });
  });

  it("starts in the library and returns there after leaving a design", async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByRole("heading", { name: "BanguesesDraw" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Open sample design" }));

    expect(screen.getByText("App / Flow.excalidraw")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByRole("heading", { name: "BanguesesDraw" })).toBeVisible();
  });

  it("stays in the library and names the file when opening a design fails", async () => {
    const user = userEvent.setup();
    vi.mocked(designApi.readDesign).mockRejectedValue(new Error("Permission denied"));

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open sample design" }));

    expect(await screen.findByText("Flow.excalidraw: Error: Permission denied")).toBeVisible();
    expect(screen.getByRole("heading", { name: "BanguesesDraw" })).toBeVisible();
    expect(screen.queryByLabelText("Editor")).not.toBeInTheDocument();
  });

  it("keeps the editor open on the moved design after an editor rename or duplicate", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open sample design" }));
    await user.click(await screen.findByRole("button", { name: "Rename in editor" }));

    expect(screen.getByText("App / Renamed.excalidraw")).toBeVisible();
  });
});
