import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import type { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { normalizeMarkdownSelection, shouldRevealMarkdownMarks, wysiwyg } from "../components/wysiwyg";
import { deleteBackward, deleteForward } from "./editorOps";
import { getFormattedSpans } from "./markdownFormatting";

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

  it("keeps completed marks hidden at a collapsed cursor", () => {
    const state = EditorState.create({
      doc: "### title",
      selection: { anchor: 4 },
      extensions: [markdown({ base: markdownLanguage })],
    });

    expect(shouldRevealMarkdownMarks(state, 0, 9)).toBe(false);
  });

  it("keeps an empty heading visible so the caret remains editable", () => {
    const state = EditorState.create({
      doc: "### ",
      selection: { anchor: 4 },
      extensions: [markdown({ base: markdownLanguage }), wysiwyg()],
    });

    expect(shouldRevealMarkdownMarks(state, 0, 4)).toBe(true);
  });

  it("reveals a newly started format while its content is being typed", () => {
    let state = EditorState.create({
      doc: "### ",
      selection: { anchor: 4 },
      extensions: [markdown({ base: markdownLanguage }), wysiwyg()],
    });

    state = state.update({
      changes: { from: 4, insert: "标" },
      selection: { anchor: 5 },
    }).state;

    expect(shouldRevealMarkdownMarks(state, 0, 5)).toBe(true);
  });

  it("keeps a new heading editable until an explicit commit action", () => {
    let state = EditorState.create({
      doc: "### ",
      selection: { anchor: 4 },
      extensions: [markdown({ base: markdownLanguage }), wysiwyg()],
    });

    state = state.update({
      changes: { from: 4, insert: "标题" },
      selection: { anchor: 6 },
    }).state;
    expect(shouldRevealMarkdownMarks(state, 0, 6)).toBe(true);

    state = state.update({
      changes: { from: 6, insert: "继续" },
      selection: { anchor: 8 },
    }).state;
    expect(shouldRevealMarkdownMarks(state, 0, 8)).toBe(true);
  });

  it("commits a heading when Enter moves to the next line", () => {
    let state = EditorState.create({
      doc: "### ",
      selection: { anchor: 4 },
      extensions: [markdown({ base: markdownLanguage }), wysiwyg()],
    });

    state = state.update({
      changes: { from: 4, insert: "标题" },
      selection: { anchor: 6 },
    }).state;
    state = state.update({
      changes: { from: 6, insert: "\n" },
      selection: { anchor: 7 },
    }).state;

    expect(shouldRevealMarkdownMarks(state, 0, 6)).toBe(false);
  });

  it("commits a heading before showing a text selection", () => {
    let state = EditorState.create({
      doc: "### ",
      selection: { anchor: 4 },
      extensions: [markdown({ base: markdownLanguage }), wysiwyg()],
    });

    state = state.update({
      changes: { from: 4, insert: "标题" },
      selection: { anchor: 6 },
    }).state;
    state = state.update({ selection: { anchor: 4, head: 6 } }).state;

    expect(shouldRevealMarkdownMarks(state, 0, 6)).toBe(false);
  });

  it("commits inline formatting when typing continues outside it", () => {
    let state = EditorState.create({
      doc: "**bold",
      selection: { anchor: 6 },
      extensions: [markdown({ base: markdownLanguage }), wysiwyg()],
    });

    state = state.update({
      changes: { from: 6, insert: "**" },
      selection: { anchor: 8 },
    }).state;
    expect(shouldRevealMarkdownMarks(state, 0, 8)).toBe(true);

    state = state.update({
      changes: { from: 8, insert: "x" },
      selection: { anchor: 9 },
    }).state;
    expect(shouldRevealMarkdownMarks(state, 0, 8)).toBe(false);
  });

  it("moves a heading selection start past the hidden prefix", () => {
    const state = EditorState.create({
      doc: "### title",
      selection: { anchor: 0, head: 9 },
      extensions: [markdown({ base: markdownLanguage })],
    });

    expect(normalizeMarkdownSelection(state)).toEqual({ anchor: 4, head: 9 });
  });

  it("normalizes reverse selections without exposing inline marks", () => {
    const state = EditorState.create({
      doc: "**bold**",
      selection: { anchor: 8, head: 0 },
      extensions: [markdown({ base: markdownLanguage })],
    });

    expect(normalizeMarkdownSelection(state)).toEqual({ anchor: 6, head: 2 });
  });

  it("finds all supported complete inline formats", () => {
    const state = EditorState.create({
      doc: "**bold** *italic* ~~strike~~ `code`",
      extensions: [markdown({ base: markdownLanguage })],
    });

    expect(getFormattedSpans(state).map((span) => span.kind)).toEqual([
      "strong",
      "emphasis",
      "strike",
      "code",
    ]);
  });

  it("builds WYSIWYG decorations for mixed formatted content", () => {
    expect(() => EditorState.create({
      doc: "[link](url)\n### **title**\n***nested***",
      extensions: [markdown({ base: markdownLanguage }), wysiwyg()],
    })).not.toThrow();
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
    expect(heading.read().doc.toString()).toBe("### ");
    expect(deleteBackward(heading.view)).toBe(true);
    expect(heading.read().doc.toString()).toBe("");

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

  it("deletes Unicode graphemes before inline marks", () => {
    const { view, read } = testView("**你🙂**", 5);

    expect(deleteBackward(view)).toBe(true);
    expect(read().doc.toString()).toBe("**你**");
    expect(deleteBackward(view)).toBe(true);
    expect(read().doc.toString()).toBe("****");
  });
});
