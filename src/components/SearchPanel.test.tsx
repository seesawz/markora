// @vitest-environment jsdom

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SearchHighlight } from "../lib/searchHighlight";
import { SearchPanel } from "./SearchPanel";

describe("SearchPanel", () => {
  let editor: Editor | null = null;

  afterEach(() => {
    cleanup();
    editor?.destroy();
    editor = null;
  });

  it("shows current and total matches and highlights every result", () => {
    editor = new Editor({
      extensions: [StarterKit, SearchHighlight],
      content: "<p>hello world hello</p>",
    });
    render(<SearchPanel editor={editor} onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText("查找"), { target: { value: "hello" } });
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(editor.view.dom.querySelectorAll(".search-match")).toHaveLength(2);

    fireEvent.click(screen.getByTitle("下一个"));
    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(editor.view.dom.querySelectorAll(".search-match-current")).toHaveLength(1);
  });

  it("replaces the displayed current match and advances to the next result", () => {
    editor = new Editor({
      extensions: [StarterKit, SearchHighlight],
      content: "<p>one one one</p>",
    });
    render(<SearchPanel editor={editor} onClose={() => {}} initialShowReplace />);

    fireEvent.change(screen.getByPlaceholderText("查找"), { target: { value: "one" } });
    fireEvent.click(screen.getByTitle("下一个"));
    expect(screen.getByText("2 / 3")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("替换"), { target: { value: "two" } });
    fireEvent.click(screen.getByRole("button", { name: "替换" }));

    expect(editor.getText()).toBe("one two one");
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });
});
