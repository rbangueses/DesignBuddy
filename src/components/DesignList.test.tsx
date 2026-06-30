import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DesignList } from "./DesignList";

describe("DesignList", () => {
  it("shows filtered-empty copy when the project has designs but none match the query", () => {
    render(
      <DesignList
        project="App"
        designs={[]}
        totalDesignCount={2}
        filter="site"
        onFilterChange={vi.fn()}
        onCreateDesign={vi.fn()}
        onOpenDesign={vi.fn()}
      />,
    );

    expect(screen.getByText('No designs match "site".')).toBeVisible();
    expect(screen.queryByText("No designs in this project yet.")).not.toBeInTheDocument();
  });

  it("shows the project-empty copy when there are no designs yet", () => {
    render(
      <DesignList
        project="App"
        designs={[]}
        totalDesignCount={0}
        filter=""
        onFilterChange={vi.fn()}
        onCreateDesign={vi.fn()}
        onOpenDesign={vi.fn()}
      />,
    );

    expect(screen.getByText("No designs in this project yet.")).toBeVisible();
  });
});
