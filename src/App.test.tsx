import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./components/LibraryView", () => ({
  LibraryView: ({
    onOpenDesign,
  }: {
    onOpenDesign: (project: string, fileName: string) => void;
  }) => (
    <section aria-label="Design library">
      <h1>BanguesesDraw</h1>
      <button
        type="button"
        onClick={() => onOpenDesign("App", "Flow.excalidraw")}
      >
        Open sample design
      </button>
    </section>
  ),
}));

describe("App", () => {
  it("starts in the library and returns there after leaving a design", async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByRole("heading", { name: "BanguesesDraw" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Open sample design" }));

    expect(screen.getByText("App / Flow.excalidraw")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByRole("heading", { name: "BanguesesDraw" })).toBeVisible();
  });
});
