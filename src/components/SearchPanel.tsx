import { useEffect, useRef, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { useT } from "../lib/i18n";
import { setSearchHighlights, type SearchMatch } from "../lib/searchHighlight";

interface Props {
  editor: Editor | null;
  onClose: () => void;
  initialQuery?: string;
  initialShowReplace?: boolean;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 遍历文本块计算匹配的真实 ProseMirror 位置。
// 文本块内 inline 偏移与文本下标一致:非文本 inline 节点(图片/硬换行)按 nodeSize 用占位符补齐,
// 既保持对齐又阻断跨节点误匹配;加粗等 mark 边界的相邻文本节点位置连续,跨边界匹配仍然正确。
export function findMatches(editor: Editor, query: string): SearchMatch[] {
  const results: SearchMatch[] = [];
  if (!query) return results;
  const regex = new RegExp(escapeRegExp(query), "gi");
  editor.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = "";
    node.content.forEach((child) => {
      text += child.isText && child.text ? child.text : "\u0000".repeat(child.nodeSize);
    });
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      if (m[0].length === 0) break;
      results.push({ from: pos + 1 + m.index, to: pos + 1 + m.index + m[0].length });
    }
    return false;
  });
  return results;
}

export function SearchPanel({ editor, onClose, initialQuery = "", initialShowReplace = false }: Props) {
  const tr = useT();
  const [query, setQuery] = useState(initialQuery);
  const [replace, setReplace] = useState("");
  const [showReplace, setShowReplace] = useState(initialShowReplace);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    if (initialQuery) updateMatches(initialQuery);
    return () => {
      if (editor) setSearchHighlights(editor, [], -1);
    };
    // editor only changes when the panel is recreated
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMatches = useCallback(
    (q: string, preferredIndex = 0) => {
      if (!editor) return;
      const next = q ? findMatches(editor, q) : [];
      const nextIndex = next.length ? Math.min(preferredIndex, next.length - 1) : -1;
      setMatches(next);
      setCurrentIndex(nextIndex);
      setSearchHighlights(editor, next, nextIndex);
    },
    [editor]
  );

  useEffect(() => {
    if (!editor) return;
    const refresh = () => updateMatches(query);
    editor.on("update", refresh);
    return () => {
      editor.off("update", refresh);
    };
  }, [editor, query, updateMatches]);

  const onQueryChange = (v: string) => { setQuery(v); updateMatches(v); };
  const onReplaceChange = (v: string) => { setReplace(v); };

  const selectMatch = (index: number) => {
    if (!editor || !matches.length) return;
    const nextIndex = (index + matches.length) % matches.length;
    setCurrentIndex(nextIndex);
    setSearchHighlights(editor, matches, nextIndex);
    editor.chain().focus().setTextSelection(matches[nextIndex]).scrollIntoView().run();
  };

  const findNext = () => selectMatch(currentIndex + 1);
  const findPrevious = () => selectMatch(currentIndex - 1);

  const replaceNext = () => {
    if (!editor || !query || currentIndex < 0) return;
    const target = matches[currentIndex];
    const selectedText = editor.state.doc.textBetween(target.from, target.to);
    if (selectedText.toLowerCase() !== query.toLowerCase()) {
      updateMatches(query, currentIndex);
      return;
    }
    const chain = editor.chain().focus();
    if (replace) chain.insertContentAt(target, replace).run();
    else chain.deleteRange(target).run();

    const next = findMatches(editor, query);
    const nextIndex = next.length ? currentIndex % next.length : -1;
    setMatches(next);
    setCurrentIndex(nextIndex);
    setSearchHighlights(editor, next, nextIndex);
    if (nextIndex >= 0) editor.chain().focus().setTextSelection(next[nextIndex]).scrollIntoView().run();
  };

  const replaceAll = () => {
    if (!editor || !query) return;
    const matches = findMatches(editor, query);
    if (!matches.length) return;
    // 从后往前替换,前面的位置不会因替换而失效;逐个替换保留周围格式
    let chain = editor.chain().focus();
    for (const m of [...matches].reverse()) {
      chain = replace ? chain.insertContentAt({ from: m.from, to: m.to }, replace) : chain.deleteRange(m);
    }
    chain.run();
    updateMatches(query);
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
          {query ? (matches.length > 0 ? `${currentIndex + 1} / ${matches.length}` : tr.noResults) : ""}
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
