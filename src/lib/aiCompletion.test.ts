// @vitest-environment jsdom

import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import { aiGhostTextExtension, clearAiGhost, showAiGhost } from "./aiCompletion";

describe("AI ghost text", () => {
  let view: EditorView | null = null;

  afterEach(() => {
    view?.destroy();
    view = null;
  });

  it("renders ghost text at the requested position", () => {
    const parent = document.createElement("div");
    view = new EditorView({
      state: EditorState.create({ doc: "const answer =", extensions: aiGhostTextExtension() }),
      parent,
    });

    showAiGhost(view, 14, " 42;");

    expect(parent.querySelector(".cm-ai-ghost")?.textContent).toBe(" 42;");
  });

  it("clears ghost text when the document changes", () => {
    const parent = document.createElement("div");
    view = new EditorView({
      state: EditorState.create({ doc: "abc", extensions: aiGhostTextExtension() }),
      parent,
    });
    showAiGhost(view, 3, "def");

    view.dispatch({ changes: { from: 3, insert: "!" } });

    expect(parent.querySelector(".cm-ai-ghost")).toBeNull();
  });

  it("reports whether a ghost suggestion was cleared", () => {
    const parent = document.createElement("div");
    view = new EditorView({
      state: EditorState.create({ doc: "abc", extensions: aiGhostTextExtension() }),
      parent,
    });

    expect(clearAiGhost(view)).toBe(false);
    showAiGhost(view, 3, "def");
    expect(clearAiGhost(view)).toBe(true);
    expect(clearAiGhost(view)).toBe(false);
  });
});
