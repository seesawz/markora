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

  const baseProps = {
    tabs,
    activePath: "/ws/a.md" as string | null,
    onSelect: vi.fn(),
    onClose: vi.fn(),
    onRename: vi.fn(),
  };

  it("renders nothing when there are no tabs", () => {
    const { container } = render(<TabBar {...baseProps} tabs={[]} activePath={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders tab names without the .md extension", () => {
    render(<TabBar {...baseProps} />);

    expect(screen.getByText("a")).toBeTruthy();
    expect(screen.getByText("b")).toBeTruthy();
    expect(screen.queryByText("b.md")).toBeNull();
  });

  it("calls onSelect when a tab is clicked", () => {
    const onSelect = vi.fn();
    render(<TabBar {...baseProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByText("b"));
    expect(onSelect).toHaveBeenCalledWith("/ws/b.md");
  });

  it("calls onClose when the close button is clicked, without selecting", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<TabBar {...baseProps} onSelect={onSelect} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("关闭 b.md"));
    expect(onClose).toHaveBeenCalledWith("/ws/b.md");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("closes a tab on middle-click", () => {
    const onClose = vi.fn();
    render(<TabBar {...baseProps} onClose={onClose} />);

    // fireEvent 没有 auxClick 别名,用通用 MouseEvent 触发 React 的 onAuxClick
    fireEvent(screen.getByText("b"), new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    expect(onClose).toHaveBeenCalledWith("/ws/b.md");
  });

  it("enters rename mode on double-click and commits basename + original extension", () => {
    const onRename = vi.fn();
    render(<TabBar {...baseProps} onRename={onRename} />);

    fireEvent.doubleClick(screen.getByText("b"));
    // 输入框只编辑主文件名,不带扩展名
    const input = screen.getByDisplayValue("b");
    fireEvent.change(input, { target: { value: "renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // 提交时自动补回原扩展名
    expect(onRename).toHaveBeenCalledWith("/ws/b.md", "renamed.md");
    expect(screen.getByText("b")).toBeTruthy();
  });

  it("cancels rename on Escape without calling onRename", () => {
    const onRename = vi.fn();
    render(<TabBar {...baseProps} onRename={onRename} />);

    fireEvent.doubleClick(screen.getByText("b"));
    const input = screen.getByDisplayValue("b");
    fireEvent.change(input, { target: { value: "changed" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onRename).not.toHaveBeenCalled();
  });

  it("does not call onRename when the name is unchanged", () => {
    const onRename = vi.fn();
    render(<TabBar {...baseProps} onRename={onRename} />);

    fireEvent.doubleClick(screen.getByText("b"));
    const input = screen.getByDisplayValue("b");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRename).not.toHaveBeenCalled();
  });
});
