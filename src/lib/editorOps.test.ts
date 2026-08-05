import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import type { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { normalizeMarkdownSelection, shouldRevealMarkdownMarks } from "../components/wysiwyg";
import { deleteBackward, deleteForward } from "./editorOps";

function testView(doc: string, position: number) {
  let state = EditorState.create({
    doc,
    selection: { anchor: position },
    extensions: [markdown({ base: markdownLanguage })],
  });
  const view = {
    get state() {
      return state;
    },
    dispatch(spec: Parameters<EditorView["dispatch"]>[0]) {
      state = state.update(spec).state;
    },
  } as unknown as EditorView;
  return { view, read: () => state };
}

describe("Typora-like formatted text deletion", () => {
  it("keeps Markdown marks hidden while text is selected", () => {
    const state = EditorState.create({
      doc: "### title",
      selection: { anchor: 4, head: 9 },
      extensions: [markdown({ base: markdownLanguage })],
    });

    expect(shouldRevealMarkdownMarks(state, 0, 9)).toBe(false);
  });

  it("moves a heading selection start past the hidden prefix", () => {
    const state = EditorState.create({
      doc: "### title",
      selection: { anchor: 0, head: 9 },
      extensions: [markdown({ base: markdownLanguage })],
    });

    expect(normalizeMarkdownSelection(state)).toEqual({ anchor: 4, head: 9 });
  });

  it("deletes bold text before its delimiters", () => {
    const { view, read } = testView("**hello**", 9);

    for (const expected of ["**hell**", "**hel**", "**he**", "**h**", "****", ""]) {
      expect(deleteBackward(view)).toBe(true);
      expect(read().doc.toString()).toBe(expected);
    }
  });

  it("keeps heading and bold styles after deleting a selected line", () => {
    const heading = testView("### title", 0);
    heading.view.dispatch({ selection: { anchor: 0, head: 9 } });
    expect(deleteBackward(heading.view)).toBe(true);
    expect(heading.read().doc.toString()).toBe("###");

    const bold = testView("**hello**", 0);
    bold.view.dispatch({ selection: { anchor: 0, head: 9 } });
    expect(deleteBackward(bold.view)).toBe(true);
    expect(bold.read().doc.toString()).toBe("****");
    expect(deleteBackward(bold.view)).toBe(true);
    expect(bold.read().doc.toString()).toBe("");
  });

  it("deletes inline-code text before its delimiters with Delete", () => {
    const { view, read } = testView("`hello`", 1);

    for (const expected of ["`ello`", "`llo`", "`lo`", "`o`", "``", ""]) {
      expect(deleteForward(view)).toBe(true);
      expect(read().doc.toString()).toBe(expected);
    }
  });
});
