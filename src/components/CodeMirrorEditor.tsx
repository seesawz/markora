import { useEffect, useRef } from "react";
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
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from "@codemirror/search";
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
import { invoke } from "@tauri-apps/api/core";
import { appConfigDir } from "@tauri-apps/api/path";

async function saveImagePaste(view: EditorView, file: File): Promise<void> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = (file.type.split("/")[1] || "png").toLowerCase().replace("jpeg", "jpg");
    const name = `image-${Date.now()}.${ext}`;

    const { currentFilePath } = useEditorStore.getState();
    let targetDir: string;
    let markdownPath: string;
    if (currentFilePath) {
      const sep = currentFilePath.includes("\\") ? "\\" : "/";
      const dir = currentFilePath.substring(0, currentFilePath.lastIndexOf(sep));
      targetDir = `${dir}${sep}images`;
      markdownPath = `images/${name}`;
    } else {
      const cfg = await appConfigDir();
      targetDir = `${cfg}${cfg.endsWith("/") ? "" : "/"}images`;
      markdownPath = `${targetDir}/${name}`;
    }

    try { await invoke("create_new_dir", { path: targetDir }); } catch { /* ok if exists */ }
    const sep = targetDir.includes("\\") ? "\\" : "/";
    const fullPath = `${targetDir}${sep}${name}`;
    await invoke("write_binary_file", { path: fullPath, data: Array.from(bytes) });

    const insert = `![](${markdownPath})`;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
    });
  } catch (e) {
    console.error("Failed to paste image:", e);
  }
}


const lightHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.8em", fontWeight: "700", color: "#1f2328" },
  { tag: tags.heading2, fontSize: "1.4em", fontWeight: "700", color: "#1f2328" },
  { tag: tags.heading3, fontSize: "1.2em", fontWeight: "600", color: "#2d333b" },
  { tag: tags.heading4, fontSize: "1em", fontWeight: "600", color: "#2d333b" },
  { tag: tags.heading5, fontSize: "0.875em", fontWeight: "600", color: "#444c56" },
  { tag: tags.heading6, fontSize: "0.85em", fontWeight: "600", color: "#6a737d" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "#667eea", textDecoration: "underline" },
  { tag: tags.url, color: "#667eea" },
  { tag: tags.monospace, fontFamily: "'SF Mono', Menlo, Consolas, monospace", fontSize: "0.875em", color: "#e36209" },
  { tag: tags.quote, color: "#6a737d", fontStyle: "italic" },
  { tag: tags.list, color: "#667eea" },
  { tag: tags.meta, color: "#959da5" },
  { tag: tags.processingInstruction, color: "#959da5" },
  { tag: tags.contentSeparator, color: "#667eea" },
]);

const darkHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.8em", fontWeight: "700", color: "#e4e6eb" },
  { tag: tags.heading2, fontSize: "1.4em", fontWeight: "700", color: "#e4e6eb" },
  { tag: tags.heading3, fontSize: "1.2em", fontWeight: "600", color: "#d0d7de" },
  { tag: tags.heading4, fontSize: "1em", fontWeight: "600", color: "#d0d7de" },
  { tag: tags.heading5, fontSize: "0.875em", fontWeight: "600", color: "#adbac7" },
  { tag: tags.heading6, fontSize: "0.85em", fontWeight: "600", color: "#8b949e" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "#818cf8", textDecoration: "underline" },
  { tag: tags.url, color: "#818cf8" },
  { tag: tags.monospace, fontFamily: "'SF Mono', Menlo, Consolas, monospace", fontSize: "0.875em", color: "#f97316" },
  { tag: tags.quote, color: "#9ba3ae", fontStyle: "italic" },
  { tag: tags.list, color: "#818cf8" },
  { tag: tags.meta, color: "#6b7280" },
  { tag: tags.processingInstruction, color: "#6b7280" },
  { tag: tags.contentSeparator, color: "#818cf8" },
]);

const editorTheme = EditorView.theme({
  "&": {
    fontSize: "16px",
    height: "100%",
    backgroundColor: "var(--bg-primary)",
  },
  ".cm-scroller": {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Helvetica, Arial, sans-serif',
    lineHeight: "1.75",
    padding: "48px 64px",
  },
  ".cm-content": {
    maxWidth: "760px",
    margin: "0 auto",
    caretColor: "var(--accent)",
    userSelect: "text",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--text-tertiary)",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(0, 0, 0, 0.03)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  "&.cm-focused .cm-activeLine": {
    backgroundColor: "rgba(0, 0, 0, 0.04)",
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
    borderRadius: "4px",
    padding: "0 6px",
    fontSize: "12px",
  },
  ".cm-panels": {
    backgroundColor: "var(--bg-elevated)",
    color: "var(--text-primary)",
    borderTop: "1px solid var(--border-primary)",
  },
  ".cm-searchMatch": {
    backgroundColor: "rgba(255, 213, 0, 0.25)",
    borderRadius: "2px",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "rgba(255, 160, 0, 0.45)",
  },
  ".cm-textfield": {
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-primary)",
    borderRadius: "6px",
    padding: "4px 8px",
  },
  ".cm-button": {
    backgroundColor: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-primary)",
    borderRadius: "6px",
    padding: "4px 12px",
    fontSize: "12px",
  },
  ".cm-button:hover": {
    backgroundColor: "var(--bg-hover)",
  },
});

export function CodeMirrorEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeComp = useRef(new Compartment());
  const highlightComp = useRef(new Compartment());
  const {
    content,
    setContent,
    theme,
    setCursor,
    isDirty,
  } = useEditorStore();

  const isDark = theme === "dark";

  // ponytail: expose view for outline jump-to-line
  useEffect(() => {
    (window as any).__cmView = viewRef.current;
    return () => { delete (window as any).__cmView; };
  }, [viewRef.current]);

  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        setContent(update.state.doc.toString());
      }
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        setCursor(line.number, pos - line.from + 1);
      }
    });

    const markdownKeymap = keymap.of([
      {
        key: "Mod-Alt-f",
        run: (view) => {
          openSearchPanel(view);
          return true;
        },
      },
      {
        key: "Mod-h",
        run: (view) => {
          openSearchPanel(view);
          return true;
        },
      },
      {
        key: "Mod-b",
        run: (view) => {
          const { from, to } = view.state.selection.main;
          if (from === to) return false;
          const selected = view.state.doc.sliceString(from, to);
          view.dispatch({
            changes: { from, to, insert: `**${selected}**` },
            selection: { anchor: from + 2, head: to + 2 },
          });
          return true;
        },
      },
      {
        key: "Mod-i",
        run: (view) => {
          const { from, to } = view.state.selection.main;
          if (from === to) return false;
          const selected = view.state.doc.sliceString(from, to);
          view.dispatch({
            changes: { from, to, insert: `*${selected}*` },
            selection: { anchor: from + 1, head: to + 1 },
          });
          return true;
        },
      },
      {
        key: "Mod-k",
        run: (view) => {
          const { from, to } = view.state.selection.main;
          const selected = view.state.doc.sliceString(from, to) || "text";
          view.dispatch({
            changes: { from, to, insert: `[${selected}](url)` },
            selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
          });
          return true;
        },
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
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        EditorView.lineWrapping,
        EditorView.domEventHandlers({
          paste(event, view) {
            const items = event.clipboardData?.items;
            if (!items) return false;
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (item.kind === "file" && item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file) {
                  event.preventDefault();
                  void saveImagePaste(view, file);
                  return true;
                }
              }
            }
            return false;
          },
        }),
        updateListener,
        themeComp.current.of(isDark ? EditorView.theme({}, { dark: true }) : EditorView.theme({})),
        highlightComp.current.of(syntaxHighlighting(isDark ? darkHighlight : lightHighlight)),
        editorTheme,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
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
        effects: [
          themeComp.current.reconfigure(
            isDark ? EditorView.theme({}, { dark: true }) : EditorView.theme({})
          ),
          highlightComp.current.reconfigure(
            syntaxHighlighting(isDark ? darkHighlight : lightHighlight)
          ),
        ],
      });
    }
  }, [isDark]);

  return <div ref={editorRef} className="h-full w-full overflow-hidden" style={{ background: "var(--bg-primary)" }} />;
}
