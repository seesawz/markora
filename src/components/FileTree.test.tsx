// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileTree } from "./FileTree";
import { useEditorStore } from "../store/editorStore";
import type { WorkspaceFile } from "../store/workspaceStore";

const tree: WorkspaceFile[] = [
  {
    name: "docs",
    path: "/ws/docs",
    isDir: true,
    children: [
      { name: "note.md", path: "/ws/docs/note.md", isDir: false, children: [] },
      { name: "other.markdown", path: "/ws/docs/other.markdown", isDir: false, children: [] },
    ],
  },
  { name: "readme.md", path: "/ws/readme.md", isDir: false, children: [] },
];

describe("FileTree", () => {
  afterEach(cleanup);

  const baseProps = {
    root: "/ws",
    tree,
    activePath: null,
    onOpenFile: vi.fn(),
    onOpenFileDialog: vi.fn(),
    onOpenFolder: vi.fn(),
    onNewFile: vi.fn(),
    onRefresh: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
  };

  it("renders the workspace root name and files", () => {
    render(<FileTree {...baseProps} />);

    expect(screen.getByText("ws")).toBeTruthy();
    expect(screen.getByText("docs")).toBeTruthy();
    expect(screen.getByText("readme")).toBeTruthy();
  });

  it("resizes the sidebar by dragging its divider", () => {
    render(<FileTree {...baseProps} />);

    const divider = screen.getByRole("separator", { name: "调整侧边栏宽度" });
    fireEvent.pointerDown(divider);
    fireEvent.pointerMove(window, { clientX: 320 });

    expect(divider.getAttribute("aria-valuenow")).toBe("320");
  });

  it("shows a tooltip with the button name on hover", () => {
    render(<FileTree {...baseProps} />);

    fireEvent.mouseEnter(screen.getByLabelText("新建文件"));
    expect(screen.getByText("新建文件")).toBeTruthy();

    fireEvent.mouseLeave(screen.getByLabelText("新建文件"));
    expect(screen.queryByText("新建文件")).toBeNull();
  });

  it("calls onOpenFileDialog from the open-file button", () => {
    const onOpenFileDialog = vi.fn();
    render(<FileTree {...baseProps} onOpenFileDialog={onOpenFileDialog} />);

    fireEvent.click(screen.getByLabelText("打开文件"));
    expect(onOpenFileDialog).toHaveBeenCalledOnce();
  });

  it("calls onOpenFile when a file is clicked", () => {
    const onOpenFile = vi.fn();
    render(<FileTree {...baseProps} onOpenFile={onOpenFile} />);

    fireEvent.click(screen.getByText("readme"));
    expect(onOpenFile).toHaveBeenCalledWith("/ws/readme.md");
  });

  it("shows folder children when expanded and opens nested files", () => {
    const onOpenFile = vi.fn();
    render(<FileTree {...baseProps} onOpenFile={onOpenFile} />);

    // 第一层目录默认展开 → 直接看到 note(不显示 .md 后缀)
    fireEvent.click(screen.getByText("note"));
    expect(onOpenFile).toHaveBeenCalledWith("/ws/docs/note.md");
  });

  it("collapses and expands folders on click", () => {
    render(<FileTree {...baseProps} />);

    fireEvent.click(screen.getByText("docs"));
    expect(screen.queryByText("note")).toBeNull();
    fireEvent.click(screen.getByText("docs"));
    expect(screen.getByText("note")).toBeTruthy();
  });

  it("shows the empty state when there is no tree", () => {
    render(<FileTree {...baseProps} tree={null} />);

    expect(screen.getByText("打开文件夹")).toBeTruthy();
  });

  it("calls onOpenFolder from the empty state button", () => {
    const onOpenFolder = vi.fn();
    render(<FileTree {...baseProps} tree={null} onOpenFolder={onOpenFolder} />);

    fireEvent.click(screen.getByText("打开文件夹"));
    expect(onOpenFolder).toHaveBeenCalledOnce();
  });

  it("shows the document outline instead of the tree when there is no workspace", () => {
    useEditorStore.setState({ content: "# Hello\n## World", cursorLine: 1 });

    render(<FileTree {...baseProps} root={null} tree={null} />);

    expect(screen.getByText("大纲")).toBeTruthy();
    expect(screen.getByText("Hello")).toBeTruthy();
    expect(screen.getByText("World")).toBeTruthy();
  });

  it("calls onRefresh from the refresh button", () => {
    const onRefresh = vi.fn();
    render(<FileTree {...baseProps} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByLabelText("刷新文件树"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("shows only the tree in workspace mode (no outline)", () => {
    useEditorStore.setState({ content: "# Hello", cursorLine: 1 });

    render(<FileTree {...baseProps} />);

    // 工作区模式下只显示文件树,不显示常驻大纲
    expect(screen.getByText("readme")).toBeTruthy();
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("keeps the collapsed state after the tree data is replaced", () => {
    const { rerender } = render(<FileTree {...baseProps} />);

    fireEvent.click(screen.getByText("docs"));
    expect(screen.queryByText("note")).toBeNull();

    // 模拟重新扫描:换一份内容相同但引用全新的 tree
    rerender(<FileTree {...baseProps} tree={JSON.parse(JSON.stringify(tree))} />);
    expect(screen.queryByText("note")).toBeNull();
  });

  it("opens a context menu on right-click and deletes via it", () => {
    const onDelete = vi.fn();
    render(<FileTree {...baseProps} onDelete={onDelete} />);

    fireEvent.contextMenu(screen.getByText("readme"));
    fireEvent.click(screen.getByText("删除文件"));
    expect(onDelete).toHaveBeenCalledWith("/ws/readme.md", false);
  });

  it("renames a file inline via the context menu", () => {
    const onRename = vi.fn();
    render(<FileTree {...baseProps} onRename={onRename} />);

    fireEvent.contextMenu(screen.getByText("readme"));
    fireEvent.click(screen.getByText("重命名"));

    const input = screen.getByDisplayValue("readme");
    fireEvent.change(input, { target: { value: "renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRename).toHaveBeenCalledWith("/ws/readme.md", "renamed.md");
  });
});
