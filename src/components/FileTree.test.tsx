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
  };

  it("renders the workspace root name and files", () => {
    render(<FileTree {...baseProps} />);

    expect(screen.getByText("ws")).toBeTruthy();
    expect(screen.getByText("docs")).toBeTruthy();
    expect(screen.getByText("readme.md")).toBeTruthy();
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

    fireEvent.click(screen.getByText("readme.md"));
    expect(onOpenFile).toHaveBeenCalledWith("/ws/readme.md");
  });

  it("shows folder children when expanded and opens nested files", () => {
    const onOpenFile = vi.fn();
    render(<FileTree {...baseProps} onOpenFile={onOpenFile} />);

    // 第一层目录默认展开 → 直接看到 note.md
    fireEvent.click(screen.getByText("note.md"));
    expect(onOpenFile).toHaveBeenCalledWith("/ws/docs/note.md");
  });

  it("collapses and expands folders on click", () => {
    render(<FileTree {...baseProps} />);

    fireEvent.click(screen.getByText("docs"));
    expect(screen.queryByText("note.md")).toBeNull();
    fireEvent.click(screen.getByText("docs"));
    expect(screen.getByText("note.md")).toBeTruthy();
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
});
