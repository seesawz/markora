import { useEffect, useRef, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { useT } from "../lib/i18n";

interface Props {
  editor: Editor | null;
  onClose: () => void;
  initialQuery?: string;
  initialShowReplace?: boolean;
}

export function SearchPanel({ editor, onClose, initialQuery = "", initialShowReplace = false }: Props) {
  const tr = useT();
  const [query, setQuery] = useState(initialQuery);
  const [replace, setReplace] = useState("");
  const [showReplace, setShowReplace] = useState(initialShowReplace);
  const [matchCount, setMatchCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    if (initialQuery) applyQuery(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyQuery = useCallback(
    (q: string) => {
      if (!editor) return;
      if (!q) {
        setMatchCount(0);
        return;
      }
      // 简单计数：遍历文档文本
      const text = editor.getText();
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const matches = text.match(regex);
      setMatchCount(matches?.length ?? 0);
    },
    [editor]
  );

  const onQueryChange = (v: string) => { setQuery(v); applyQuery(v); };
  const onReplaceChange = (v: string) => { setReplace(v); };

  const findNext = () => {
    if (!editor || !query) return;
    const { from } = editor.state.selection;
    const text = editor.getText();
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    regex.lastIndex = from;
    const match = regex.exec(text);
    if (match) {
      editor.chain().focus().setTextSelection({ from: match.index, to: match.index + match[0].length }).run();
    } else {
      // 循环到开头
      regex.lastIndex = 0;
      const firstMatch = regex.exec(text);
      if (firstMatch) {
        editor.chain().focus().setTextSelection({ from: firstMatch.index, to: firstMatch.index + firstMatch[0].length }).run();
      }
    }
  };

  const findPrevious = () => {
    if (!editor || !query) return;
    const { from } = editor.state.selection;
    const text = editor.getText();
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let lastMatch: RegExpExecArray | null = null;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index >= from) break;
      lastMatch = match;
    }
    if (lastMatch) {
      editor.chain().focus().setTextSelection({ from: lastMatch.index, to: lastMatch.index + lastMatch[0].length }).run();
    } else {
      // 循环到末尾
      regex.lastIndex = 0;
      let last: RegExpExecArray | null = null;
      while ((match = regex.exec(text)) !== null) {
        last = match;
      }
      if (last) {
        editor.chain().focus().setTextSelection({ from: last.index, to: last.index + last[0].length }).run();
      }
    }
  };

  const replaceNext = () => {
    if (!editor || !query) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);
    if (selectedText.toLowerCase() === query.toLowerCase()) {
      editor.chain().focus().insertContent(replace).run();
      findNext();
    } else {
      findNext();
    }
  };

  const replaceAll = () => {
    if (!editor || !query) return;
    const text = editor.getText();
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const newText = text.replace(regex, replace);
    // 注意：这会丢失格式，仅用于纯文本场景
    editor.commands.setContent(newText);
    setMatchCount(0);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) findPrevious(); else findNext();
    }
  };

  const btn = (label: string, fn: () => void, title?: string) => (
    <button
      key={label}
      title={title || label}
      onClick={fn}
      style={{
        padding: "3px 8px", fontSize: 12, borderRadius: 6, border: "none",
        background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {label}
    </button>
  );

  return (
    <div
      className="search-panel"
      style={{
        position: "absolute", top: 12, right: 16, zIndex: 50,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-primary)",
        borderRadius: 12,
        boxShadow: "var(--shadow-lg)",
        padding: "8px",
        display: "flex", flexDirection: "column", gap: 6,
        minWidth: 300,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={() => setShowReplace(!showReplace)}
          title={tr.replace}
          style={{
            width: 22, height: 22, border: "none", borderRadius: 5, cursor: "pointer",
            background: showReplace ? "var(--bg-active)" : "transparent",
            color: "var(--text-tertiary)", fontSize: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {showReplace ? "▾" : "▸"}
        </button>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={tr.findPlaceholder}
          style={{
            flex: 1, padding: "5px 9px", fontSize: 13, border: "1px solid var(--border-primary)",
            borderRadius: 7, background: "var(--bg-primary)", color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", minWidth: 34, textAlign: "center" }}>
          {query ? (matchCount > 0 ? matchCount : tr.noResults) : ""}
        </span>
        {btn("↑", findPrevious, tr.prev)}
        {btn("↓", findNext, tr.next)}
        {btn("✕", onClose, tr.close)}
      </div>

      {showReplace && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 28 }}>
          <input
            value={replace}
            onChange={(e) => onReplaceChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder={tr.replacePlaceholder}
            style={{
              flex: 1, padding: "5px 9px", fontSize: 13, border: "1px solid var(--border-primary)",
              borderRadius: 7, background: "var(--bg-primary)", color: "var(--text-primary)",
              outline: "none",
            }}
          />
          {btn(tr.replace, replaceNext)}
          {btn(tr.replaceAll, replaceAll)}
        </div>
      )}
    </div>
  );
}
