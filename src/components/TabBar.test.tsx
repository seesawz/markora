// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabBar } from "./TabBar";

describe("TabBar", () => {
  afterEach(cleanup);

  const tabs = [
    { path: "/ws/a.md", name: "a.md" },
    { path: "/ws/b.md", name: "b.md" },
  ];

  it("renders nothing when there are no tabs", () => {
    const { container } = render(<TabBar tabs={[]} activePath={null} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders all open tabs", () => {
    render(<TabBar tabs={tabs} activePath="/ws/a.md" onSelect={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText("a.md")).toBeTruthy();
    expect(screen.getByText("b.md")).toBeTruthy();
  });

  it("calls onSelect when a tab is clicked", () => {
    const onSelect = vi.fn();
    render(<TabBar tabs={tabs} activePath="/ws/a.md" onSelect={onSelect} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText("b.md"));
    expect(onSelect).toHaveBeenCalledWith("/ws/b.md");
  });

  it("calls onClose when the close button is clicked, without selecting", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<TabBar tabs={tabs} activePath="/ws/a.md" onSelect={onSelect} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("关闭 b.md"));
    expect(onClose).toHaveBeenCalledWith("/ws/b.md");
    expect(onSelect).not.toHaveBeenCalled();
  });
});
