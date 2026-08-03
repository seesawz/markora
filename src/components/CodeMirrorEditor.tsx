import { useEffect, useRef, useState } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import {
  EditorView,
  keymap,
  highlightActiveLine,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightSpecialChars,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  indentUnit,
} from "@codemirror/language";
import { highlightSelectionMatches, search } from "@codemirror/search";
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { useEditorStore } from "../store/editorStore";
import { useAiStore } from "../store/aiStore";
import { wrapSelection, insertLink } from "../lib/editorOps";
import { aiGhostTextExtension, clearAiGhost } from "../lib/aiCompletion";
import { requestInlineCompletion } from "../lib/inlineCompletion";
import { SearchPanel } from "./SearchPanel";
import { imagePreview } from "./imagePreview";
import { wysiwyg } from "./wysiwyg";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";

// ponytail: Rust 端直接读剪贴板图片写文件,不经 JS 传像素(大图不卡)
export async function insertClipboardImage(view: EditorView): Promise<boolean> {
  try {
    const { currentFilePath, currentFileName } = useEditorStore.getState();
    const name = `image-${Date.now()}.png`;

    let targetDir: string;
    let markdownPath: string;
    if (currentFilePath) {
      const base = currentFileName.replace(/\.(md|markdown)$/i, "");
      const sep = currentFilePath.includes("\\") ? "\\" : "/";
      const dir = currentFilePath.substring(0, currentFilePath.lastIndexOf(sep));
      targetDir = `${dir}${sep}${base}.assets`;
      markdownPath = `${base}.assets/${name}`;
    } else {
      const dataDir = await appDataDir();
      targetDir = `${dataDir}images`;
      markdownPath = `${targetDir}/${name}`;
    }

    // 一次 invoke:Rust 读剪贴板→编码 PNG→写文件;剪贴板无图会 reject
    await invoke<string>("save_clipboard_image", { dir: targetDir, name });

    const insert = `![](${markdownPath})`;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
    });
    view.focus();
    return true;
  } catch (e) {
    console.log("[paste] no clipboard image:", e);
    return false; // 剪贴板里没有图片
  }
}


const lightHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: "700", color: "#000000e6" },
  { tag: tags.heading2, fontWeight: "700", color: "#000000e6" },
  { tag: tags.heading3, fontWeight: "650", color: "#000000b3" },
  { tag: tags.heading4, fontWeight: "650", color: "#000000b3" },
  { tag: tags.heading5, fontWeight: "650", color: "#00000099" },
  { tag: tags.heading6, fontWeight: "650", color: "#00000073" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "#1783ff", textDecoration: "underline" },
  { tag: tags.url, color: "#1783ff" },
  { tag: tags.monospace, fontFamily: "'SF Mono', Menlo, Consolas, monospace", fontSize: "0.875em", color: "#986801" },
  { tag: tags.quote, color: "#00000099", fontStyle: "italic" },
  { tag: tags.list, color: "#1783ff" },
  { tag: tags.meta, color: "#00000073" },
  { tag: tags.processingInstruction, color: "#00000073" },
  { tag: tags.contentSeparator, color: "#1783ff" },
]);

const darkHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: "700", color: "#ffffffe6" },
  { tag: tags.heading2, fontWeight: "700", color: "#ffffffe6" },
  { tag: tags.heading3, fontWeight: "650", color: "#ffffffb3" },
  { tag: tags.heading4, fontWeight: "650", color: "#ffffffb3" },
  { tag: tags.heading5, fontWeight: "650", color: "#ffffff99" },
  { tag: tags.heading6, fontWeight: "650", color: "#ffffff73" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "#1783ff", textDecoration: "underline" },
  { tag: tags.url, color: "#1783ff" },
  { tag: tags.monospace, fontFamily: "'SF Mono', Menlo, Consolas, monospace", fontSize: "0.875em", color: "#d9a45c" },
  { tag: tags.quote, color: "#ffffff99", fontStyle: "italic" },
  { tag: tags.list, color: "#1783ff" },
  { tag: tags.meta, color: "#ffffff73" },
  { tag: tags.processingInstruction, color: "#ffffff73" },
  { tag: tags.contentSeparator, color: "#1783ff" },
]);

const editorTheme = EditorView.theme({
  "&": {
    fontSize: "16px",
    height: "100%",
    backgroundColor: "var(--bg-primary)",
  },
  ".cm-scroller": {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, "Noto Sans", Ubuntu, Cantarell, "Helvetica Neue", sans-serif, Arial, "PingFang SC", "Source Han Sans SC", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC"',
    lineHeight: "1.8",
    padding: "56px 64px",
  },
  ".cm-content": {
    caretColor: "var(--accent)",
    userSelect: "text",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--text-tertiary)",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(0, 0, 0, 0.022)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  "&.cm-focused .cm-activeLine": {
    backgroundColor: "rgba(0, 0, 0, 0.03)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--selection) !important",
  },
  "::selection": {
    backgroundColor: "var(--selection)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--accent)",
    borderLeftWidth: "2px",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--code-bg)",
    border: "1px solid var(--border-primary)",
    color: "var(--text-secondary)",
    borderRadius: "6px",
    padding: "0 6px",
    fontSize: "12px",
  },
  ".cm-panels": {
    backgroundColor: "var(--bg-elevated)",
    color: "var(--text-primary)",
    borderTop: "1px solid var(--border-primary)",
  },
  ".cm-searchMatch": {
    backgroundColor: "rgba(245, 158, 11, 0.22)",
    borderRadius: "3px",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "rgba(245, 158, 11, 0.45)",
  },
  ".cm-textfield": {
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-primary)",
    borderRadius: "8px",
    padding: "4px 8px",
  },
  ".cm-button": {
    backgroundColor: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-primary)",
    borderRadius: "8px",
    padding: "4px 12px",
    fontSize: "12px",
  },
  ".cm-button:hover": {
    backgroundColor: "var(--bg-hover)",
  },
});

// ponytail: focus/typewriter mode — dim non-active lines, keep active line centered-ish
const focusTheme = EditorView.theme({
  ".cm-line": { opacity: "0.45", transition: "opacity 120ms ease" },
  ".cm-line.cm-activeLine, .cm-activeLine": { opacity: "1" },
});

export function CodeMirrorEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const completionTimer = useRef<number | null>(null);
  const completionRequestId = useRef(0);
  const highlightComp = useRef(new Compartment());
  const focusComp = useRef(new Compartment());
  const [searchOpen, setSearchOpen] = useState(false);
  const {
    content,
    setContent,
    theme,
    setCursor,
    isDirty,
  } = useEditorStore();

  const isDark = theme === "dark";

  // ponytail: expose view for outline jump-to-line + AI 命令；
  // 在创建 editor 的 effect 里直接赋值，避免 [viewRef.current] 依赖（ref 变化不触发重渲染）
  useEffect(() => {
    if (!editorRef.current) return;

    // 防抖调度内联续写；scheduleCompletion 把自己传给 requestInlineCompletion，
    // 以便结果过期时由后者重新安排下一轮
    const scheduleCompletion = (view: EditorView) => {
      if (completionTimer.current !== null) window.clearTimeout(completionTimer.current);
      const requestId = ++completionRequestId.current;
      completionTimer.current = window.setTimeout(() => {
        void requestInlineCompletion(view, () => requestId === completionRequestId.current, scheduleCompletion);
      }, 800);
    };

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        setContent(update.state.doc.toString());
        clearAiGhost(update.view);
        const ai = useAiStore.getState();
        if (ai.enabled && !ai.isGenerating) {
          scheduleCompletion(update.view);
        } else if (ai.isGenerating) {
          // 请求进行中：作废当前请求，待其结束后由 reschedule 重新触发
          completionRequestId.current += 1;
        } else if (completionTimer.current !== null) {
          window.clearTimeout(completionTimer.current);
        }
      } else if (update.selectionSet) {
        clearAiGhost(update.view);
      }
      // 始终从最新 state 读光标:replaceAll 等事务可能不带 selection 但改变了行列
      const pos = update.state.selection.main.head;
      const line = update.state.doc.lineAt(pos);
      setCursor(line.number, pos - line.from + 1);
    });

    const markdownKeymap = keymap.of([
      {
        key: "Mod-f",
        run: () => {
          setSearchOpen(true);
          return true;
        },
      },
      {
        key: "Mod-h",
        run: () => {
          setSearchOpen(true);
          return true;
        },
      },
      {
        key: "Mod-b",
        run: (view) => wrapSelection(view, "**"),
      },
      {
        key: "Mod-i",
        run: (view) => wrapSelection(view, "*"),
      },
      {
        key: "Mod-k",
        run: (view) => insertLink(view),
      },
    ]);

    const state = EditorState.create({
      doc: content,
      extensions: [
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        indentUnit.of("  "),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        markdownKeymap,
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        search({ top: true }),
        EditorView.lineWrapping,
        wysiwyg(),
        imagePreview(),
        ...aiGhostTextExtension(),
        EditorView.domEventHandlers({
          paste(event, view) {
            // ponytail: 统一走剪贴板插件读图片（webview 里 clipboardData.items 常读不到截图）
            void (async () => {
              const inserted = await insertClipboardImage(view);
              if (inserted) event.preventDefault();
            })();
            return false;
          },
        }),
        updateListener,
        highlightComp.current.of(syntaxHighlighting(isDark ? darkHighlight : lightHighlight)),
        focusComp.current.of(useEditorStore.getState().focusMode ? focusTheme : []),
        editorTheme,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;
    (window as any).__cmView = view;

    return () => {
      if (completionTimer.current !== null) window.clearTimeout(completionTimer.current);
      completionRequestId.current += 1;
      delete (window as any).__cmView;
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (viewRef.current) {
      const currentContent = viewRef.current.state.doc.toString();
      if (currentContent !== content && !isDirty) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: content,
          },
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, isDirty]);

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: highlightComp.current.reconfigure(
          syntaxHighlighting(isDark ? darkHighlight : lightHighlight)
        ),
      });
    }
  }, [isDark]);

  useEffect(() => {
    const unsub = useEditorStore.subscribe((s, prev) => {
      if (s.focusMode !== prev.focusMode && viewRef.current) {
        viewRef.current.dispatch({
          effects: focusComp.current.reconfigure(s.focusMode ? focusTheme : []),
        });
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = useAiStore.subscribe((state, previous) => {
      if (state.enabled !== previous.enabled && !state.enabled && viewRef.current) {
        completionRequestId.current += 1;
        if (completionTimer.current !== null) window.clearTimeout(completionTimer.current);
        clearAiGhost(viewRef.current);
      }
    });
    return unsub;
  }, []);

  return (
    <div
      className="h-full w-full overflow-hidden"
      style={{ background: "var(--bg-primary)", position: "relative" }}
    >
      <div ref={editorRef} className="h-full w-full" />
      {searchOpen && (
        <SearchPanel view={viewRef.current} onClose={() => setSearchOpen(false)} />
      )}
    </div>
  );
}
