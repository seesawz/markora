// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OutlinePanel, parseOutline } from "./OutlinePanel";
import { useEditorStore } from "../store/editorStore";

describe("parseOutline", () => {
  it("builds a nested heading tree with positions", () => {
    const content = [
      "# Title",
      "intro",
      "## Section A",
      "text",
      "### Sub",
      "## Section B",
    ].join("\n");

    const outline = parseOutline(content);

    expect(outline).toHaveLength(1);
    expect(outline[0].text).toBe("Title");
    expect(outline[0].pos).toBe(0);
    expect(outline[0].children).toHaveLength(2);
    expect(outline[0].children[0].text).toBe("Section A");
    expect(outline[0].children[0].children).toHaveLength(1);
    expect(outline[0].children[0].children[0].text).toBe("Sub");
    expect(outline[0].children[1].text).toBe("Section B");
  });

  it("skips headings inside fenced code blocks", () => {
    const content = ["```md", "# not a heading", "```", "# real heading"].join("\n");

    const outline = parseOutline(content);

    expect(outline).toHaveLength(1);
    expect(outline[0].text).toBe("real heading");
  });

  it("ignores lines that are not headings", () => {
    const content = ["plain text", "### also fine", "not # a heading"].join("\n");

    const outline = parseOutline(content);

    expect(outline).toHaveLength(1);
    expect(outline[0].text).toBe("also fine");
  });
});

describe("OutlinePanel", () => {
  afterEach(() => {
    cleanup();
    delete (window as any).__cmView;
    delete (window as any).__tiptapEditor;
    useEditorStore.setState({ content: "", cursorLine: 1 });
  });

  const baseProps = {
    onOpenFileDialog: vi.fn(),
    onOpenFolder: vi.fn(),
  };

  it("renders document headings", () => {
    useEditorStore.setState({ content: "# Hello\n## World", cursorLine: 1 });

    render(<OutlinePanel {...baseProps} />);

    expect(screen.getByText("Hello")).toBeTruthy();
    expect(screen.getByText("World")).toBeTruthy();
    expect(document.querySelector(".outline-tree-children")).toBeTruthy();
  });

  it("jumps to the heading position on click", () => {
    const setTextSelection = vi.fn().mockReturnThis();
    const focus = vi.fn().mockReturnThis();
    const run = vi.fn();
    const chain = { setTextSelection, focus, run };
    const editor = {
      state: {
        doc: {
          descendants: vi.fn((callback: (node: any, pos: number) => boolean) => {
            // 模拟找到 "World" 标题
            callback({ type: { name: "heading" }, textContent: "World" }, 8);
          }),
        },
      },
      chain: () => chain,
      view: {
        coordsAtPos: vi.fn(() => ({ top: 100 })),
        dom: { closest: vi.fn(() => ({ scrollTop: 0 })) },
      },
    };
    (window as any).__tiptapEditor = editor;
    useEditorStore.setState({ content: "# Hello\n## World", cursorLine: 1 });

    render(<OutlinePanel {...baseProps} />);

    fireEvent.click(screen.getByText("World"));
    expect(editor.state.doc.descendants).toHaveBeenCalled();
  });

  it("shows a hint when the document has no headings", () => {
    useEditorStore.setState({ content: "just text", cursorLine: 1 });

    render(<OutlinePanel {...baseProps} />);

    expect(screen.getByText("文档里还没有标题")).toBeTruthy();
  });
});
