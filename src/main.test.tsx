import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rootMocks = vi.hoisted(() => ({
  render: vi.fn(),
  createRoot: vi.fn(),
}));

vi.mock("react-dom/client", () => ({
  default: {
    createRoot: rootMocks.createRoot,
  },
}));

vi.mock("./App", () => ({
  default: () => <div>App</div>,
}));

describe("main app root", () => {
  beforeEach(() => {
    vi.resetModules();
    rootMocks.render.mockReset();
    rootMocks.createRoot.mockReset();
    rootMocks.createRoot.mockReturnValue({ render: rootMocks.render });
    document.body.innerHTML = '<div id="root"></div>';
  });

  it("renders the app without React StrictMode because Excalidraw loops during dev remounts", async () => {
    await import("./main");

    expect(rootMocks.render).toHaveBeenCalledTimes(1);
    const rendered = rootMocks.render.mock.calls[0][0] as React.ReactElement;
    expect(rendered.type).not.toBe(React.StrictMode);
  });
});
