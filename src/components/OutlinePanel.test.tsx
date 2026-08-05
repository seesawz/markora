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
  });

  it("jumps to the heading position on click", () => {
    const dispatch = vi.fn();
    const focus = vi.fn();
    (window as any).__cmView = { dispatch, focus };
    useEditorStore.setState({ content: "# Hello\n## World", cursorLine: 1 });

    render(<OutlinePanel {...baseProps} />);

    fireEvent.click(screen.getByText("World"));
    expect(dispatch).toHaveBeenCalledWith({ selection: { anchor: 8 }, scrollIntoView: true });
    expect(focus).toHaveBeenCalledOnce();
  });

  it("shows a hint when the document has no headings", () => {
    useEditorStore.setState({ content: "just text", cursorLine: 1 });

    render(<OutlinePanel {...baseProps} />);

    expect(screen.getByText("文档里还没有标题")).toBeTruthy();
  });
});
