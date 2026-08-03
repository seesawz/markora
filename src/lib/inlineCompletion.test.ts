// @vitest-environment jsdom

import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiGhostTextExtension } from "./aiCompletion";
import { requestInlineCompletion } from "./inlineCompletion";
import { useAiStore } from "../store/aiStore";

const { completeAiMock } = vi.hoisted(() => ({ completeAiMock: vi.fn() }));

vi.mock("./ai", () => ({
  completeAi: completeAiMock,
  buildInlinePrompt: vi.fn().mockReturnValue("prompt"),
  normalizeAiText: (s: string) => s.trim(),
  getAiConfig: vi.fn(),
  saveAiConfig: vi.fn(),
  testAiConnection: vi.fn(),
  getEditorContext: vi.fn(),
  buildCommandPrompt: vi.fn(),
}));

function makeView(doc: string): EditorView {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  return new EditorView({
    state: EditorState.create({ doc, selection: { anchor: doc.length }, extensions: aiGhostTextExtension() }),
    parent,
  });
}

describe("requestInlineCompletion", () => {
  let view: EditorView;

  beforeEach(() => {
    vi.clearAllMocks();
    useAiStore.setState({
      provider: "openai",
      baseUrl: "https://example.com",
      model: "gpt",
      apiKeyConfigured: true,
      enabled: true,
      isGenerating: false,
      error: null,
    });
    view = makeView("const x =");
  });

  afterEach(() => {
    view?.destroy();
    view.dom.remove();
  });

  it("shows ghost text when the request succeeds and the cursor stayed put", async () => {
    completeAiMock.mockResolvedValue(" 42");
    const reschedule = vi.fn();

    await requestInlineCompletion(view, () => true, reschedule);

    expect(view.dom.querySelector(".cm-ai-ghost")?.textContent).toBe("42");
    expect(reschedule).not.toHaveBeenCalled();
    expect(useAiStore.getState().isGenerating).toBe(false);
  });

  it("discards and reschedules when the document changed during the request", async () => {
    completeAiMock.mockResolvedValue("42");
    const reschedule = vi.fn();

    await requestInlineCompletion(view, () => false, reschedule);

    expect(view.dom.querySelector(".cm-ai-ghost")).toBeNull();
    expect(reschedule).toHaveBeenCalledOnce();
  });

  it("discards and reschedules when the cursor moved during the request", async () => {
    let resolveRequest!: (value: string) => void;
    completeAiMock.mockReturnValue(new Promise<string>((r) => { resolveRequest = r; }));
    const reschedule = vi.fn();

    const pending = requestInlineCompletion(view, () => true, reschedule);
    // 模拟请求在途时用户移动了光标（文档未变）
    view.dispatch({ selection: { anchor: 0 } });
    resolveRequest("42");
    await pending;

    expect(view.dom.querySelector(".cm-ai-ghost")).toBeNull();
    expect(reschedule).toHaveBeenCalledOnce();
  });

  it("does not reschedule when the request fails", async () => {
    completeAiMock.mockRejectedValue(new Error("network"));
    const reschedule = vi.fn();

    await requestInlineCompletion(view, () => true, reschedule);

    expect(reschedule).not.toHaveBeenCalled();
    expect(useAiStore.getState().error).toContain("network");
  });
});
