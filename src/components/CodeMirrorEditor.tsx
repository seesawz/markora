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
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
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

const typoraLightHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.8em", fontWeight: "700", color: "#1a1a1a" },
  { tag: tags.heading2, fontSize: "1.4em", fontWeight: "700", color: "#1a1a1a" },
  { tag: tags.heading3, fontSize: "1.2em", fontWeight: "600", color: "#333" },
  { tag: tags.heading4, fontSize: "1em", fontWeight: "600", color: "#333" },
  { tag: tags.heading5, fontSize: "0.875em", fontWeight: "600", color: "#333" },
  { tag: tags.heading6, fontSize: "0.85em", fontWeight: "600", color: "#777" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "#4183c4", textDecoration: "underline" },
  { tag: tags.url, color: "#4183c4" },
  { tag: tags.monospace, fontFamily: "'SF Mono', Menlo, Consolas, monospace", fontSize: "0.875em", color: "#c7254e" },
  { tag: tags.quote, color: "#777", fontStyle: "italic" },
  { tag: tags.list, color: "#4183c4" },
  { tag: tags.meta, color: "#999" },
  { tag: tags.processingInstruction, color: "#999" },
  { tag: tags.contentSeparator, color: "#4183c4" },
]);

const typoraDarkHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.8em", fontWeight: "700", color: "#e0e0e0" },
  { tag: tags.heading2, fontSize: "1.4em", fontWeight: "700", color: "#e0e0e0" },
  { tag: tags.heading3, fontSize: "1.2em", fontWeight: "600", color: "#d4d4d4" },
  { tag: tags.heading4, fontSize: "1em", fontWeight: "600", color: "#d4d4d4" },
  { tag: tags.heading5, fontSize: "0.875em", fontWeight: "600", color: "#d4d4d4" },
  { tag: tags.heading6, fontSize: "0.85em", fontWeight: "600", color: "#999" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "#569cd6", textDecoration: "underline" },
  { tag: tags.url, color: "#569cd6" },
  { tag: tags.monospace, fontFamily: "'SF Mono', Menlo, Consolas, monospace", fontSize: "0.875em", color: "#ce9178" },
  { tag: tags.quote, color: "#999", fontStyle: "italic" },
  { tag: tags.list, color: "#569cd6" },
  { tag: tags.meta, color: "#666" },
  { tag: tags.processingInstruction, color: "#666" },
  { tag: tags.contentSeparator, color: "#569cd6" },
]);

const editorTheme = EditorView.theme({
  "&": {
    fontSize: "16px",
    height: "100%",
    backgroundColor: "var(--typora-bg)",
  },
  ".cm-scroller": {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    lineHeight: "1.7",
    padding: "40px 60px",
  },
  ".cm-content": {
    maxWidth: "820px",
    margin: "0 auto",
    caretColor: "var(--typora-accent)",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--typora-text-secondary)",
  },
  ".cm-lineNumbers .cm-gutterCM": {
    minWidth: "2.5em",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(0, 0, 0, 0.03)",
  },
  ":root.dark .cm-activeLine": {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--typora-selection) !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--typora-selection) !important",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--typora-accent)",
    borderLeftWidth: "2px",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--typora-code-bg)",
    border: "1px solid var(--typora-border)",
    color: "var(--typora-text-secondary)",
    borderRadius: "3px",
    padding: "0 4px",
  },
  ".cm-panels": {
    backgroundColor: "var(--typora-sidebar-bg)",
    color: "var(--typora-text)",
  },
  ".cm-searchMatch": {
    backgroundColor: "rgba(255, 213, 0, 0.3)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "rgba(255, 213, 0, 0.6)",
  },
  ".cm-textfield": {
    backgroundColor: "var(--typora-bg)",
    color: "var(--typora-text)",
    border: "1px solid var(--typora-border)",
    borderRadius: "4px",
  },
  ".cm-button": {
    backgroundColor: "var(--typora-sidebar-hover)",
    color: "var(--typora-text)",
    border: "1px solid var(--typora-border)",
    borderRadius: "4px",
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

  // Initialize editor
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
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        EditorView.lineWrapping,
        updateListener,
        themeComp.current.of(isDark ? EditorView.theme({}, { dark: true }) : EditorView.theme({})),
        highlightComp.current.of(syntaxHighlighting(isDark ? typoraDarkHighlight : typoraLightHighlight)),
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

  // Update content when loaded externally
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

  // Theme switch
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: [
          themeComp.current.reconfigure(
            isDark ? EditorView.theme({}, { dark: true }) : EditorView.theme({})
          ),
          highlightComp.current.reconfigure(
            syntaxHighlighting(isDark ? typoraDarkHighlight : typoraLightHighlight)
          ),
        ],
      });
    }
  }, [isDark]);

  return <div ref={editorRef} className="h-full w-full overflow-hidden" />;
}
