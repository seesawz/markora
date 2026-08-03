import type { EditorView } from "@codemirror/view";
import { buildInlinePrompt, completeAi, normalizeAiText } from "./ai";
import { showAiGhost } from "./aiCompletion";
import { useAiStore } from "../store/aiStore";

// 请求一次内联续写。isCurrent() 用来判断这次请求是否仍然对应最新编辑状态；
// reschedule 在结果因文档/光标变化而过期时被调用，触发下一轮续写。
export async function requestInlineCompletion(
  view: EditorView,
  isCurrent: () => boolean,
  reschedule: (view: EditorView) => void,
): Promise<void> {
  const ai = useAiStore.getState();
  if (!ai.enabled || !ai.apiKeyConfigured || ai.isGenerating) return;
  if (view.state.selection.main.from !== view.state.selection.main.to) return;

  const source = view.state.doc.toString();
  const from = view.state.selection.main.head;
  ai.setGenerating(true);
  ai.setError(null);
  let stale = false;
  try {
    const raw = await completeAi({
      provider: ai.provider,
      baseUrl: ai.baseUrl,
      model: ai.model,
      prompt: buildInlinePrompt(view),
    });
    const sel = view.state.selection.main;
    // 文档变化、光标移动或已有选区，都意味着建议已过期
    if (!isCurrent() || view.state.doc.toString() !== source || sel.head !== from || sel.from !== sel.to) {
      stale = true;
    } else {
      const text = normalizeAiText(raw);
      if (text) showAiGhost(view, from, text);
    }
  } catch (error) {
    ai.setError(String(error));
  } finally {
    useAiStore.getState().setGenerating(false);
    // 过期且仍启用：安排下一轮续写，这样用户在请求期间继续打字也能拿到结果
    if (stale && useAiStore.getState().enabled) reschedule(view);
  }
}
