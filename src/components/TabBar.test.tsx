// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabBar } from "./TabBar";

const { startDragging } = vi.hoisted(() => ({ startDragging: vi.fn(() => Promise.resolve()) }));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ startDragging }),
}));

describe("TabBar", () => {
  afterEach(() => {
    cleanup();
    startDragging.mockClear();
  });

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

  it("starts native window dragging from an empty titlebar", () => {
    const { container } = render(<TabBar {...baseProps} tabs={[]} activePath={null} />);
    const bar = container.firstChild as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar.hasAttribute("data-window-drag-region")).toBe(true);
    expect(bar.querySelectorAll('[role="tab"]').length).toBe(0);
    fireEvent.mouseDown(bar, { button: 0 });
    expect(startDragging).toHaveBeenCalledOnce();
  });

  it("does not start window dragging from interactive tab controls", () => {
    render(<TabBar {...baseProps} onNewTab={vi.fn()} />);

    fireEvent.mouseDown(screen.getByRole("tab", { name: /a/ }), { button: 0 });
    fireEvent.mouseDown(screen.getByLabelText("关闭 a.md"), { button: 0 });
    fireEvent.mouseDown(screen.getByLabelText("新建文件"), { button: 0 });
    expect(startDragging).not.toHaveBeenCalled();
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
