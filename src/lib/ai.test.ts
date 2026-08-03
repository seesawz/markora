import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCommandPrompt,
  buildInlinePrompt,
  completeAi,
  getEditorContext,
  normalizeAiText,
} from "./ai";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

function editorView(doc: string, anchor: number, head = anchor): EditorView {
  return {
    state: EditorState.create({ doc, selection: { anchor, head } }),
  } as EditorView;
}

describe("AI prompt helpers", () => {
  it("keeps the selected editor range and context", () => {
    const view = editorView("title\nselected\nend", 6, 14);

    expect(getEditorContext(view)).toEqual({
      from: 6,
      to: 14,
      text: "title\nselected\nend",
    });
  });

  it("builds a command prompt with the instruction and selection", () => {
    const view = editorView("title\nselected\nend", 6, 14);
    const prompt = buildCommandPrompt(view, "改成列表");

    expect(prompt).toContain("用户指令：改成列表");
    expect(prompt).toContain("当前选中的内容：\nselected");
    expect(prompt).toContain("文档上下文：\ntitle\nselected\nend");
  });

  it("builds inline completion context around the cursor", () => {
    const view = editorView("const answer =", 14);
    const prompt = buildInlinePrompt(view);

    expect(prompt).toContain("当前行：const answer =");
    expect(prompt).toContain("光标前内容：\nconst answer =");
    expect(prompt).toContain("只返回光标后的续写内容");
  });
});

describe("AI response normalization", () => {
  it("removes a complete Markdown code fence", () => {
    expect(normalizeAiText("```ts\nconst answer = 42;\n```")).toBe("const answer = 42;");
  });

  it("trims surrounding whitespace without changing content", () => {
    expect(normalizeAiText("  hello\nworld  ")).toBe("hello\nworld");
  });
});

describe("AI invoke wrapper", () => {
  beforeEach(() => invokeMock.mockReset());

  it("invokes the native completion command with the provider config", async () => {
    invokeMock.mockResolvedValue("generated text");

    await expect(completeAi({
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      model: "claude-3-5-sonnet",
      prompt: "写一段话",
    })).resolves.toBe("generated text");

    expect(invokeMock).toHaveBeenCalledWith("complete_ai", {
      request: {
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com",
        model: "claude-3-5-sonnet",
        prompt: "写一段话",
      },
    });
  });
});
