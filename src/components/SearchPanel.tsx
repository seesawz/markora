import { useEffect, useRef, useState, useCallback } from "react";
import type { EditorView } from "@codemirror/view";
import { SearchQuery, setSearchQuery, findNext, findPrevious, replaceNext, replaceAll } from "@codemirror/search";
import { useT } from "../lib/i18n";

interface Props {
  view: EditorView | null;
  onClose: () => void;
  initialQuery?: string;
  initialShowReplace?: boolean;
}

export function SearchPanel({ view, onClose, initialQuery = "", initialShowReplace = false }: Props) {
  const tr = useT();
  const [query, setQuery] = useState(initialQuery);
  const [replace, setReplace] = useState("");
  const [showReplace, setShowReplace] = useState(initialShowReplace);
  const [matchCount, setMatchCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    // 挂载时应用预选词(.Cmd+F 带入当前选中文本)
    if (initialQuery) applyQuery(initialQuery, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyQuery = useCallback(
    (q: string, r: string) => {
      if (!view) return;
      const search = new SearchQuery({ search: q, replace: r, caseSensitive: false });
      view.dispatch({ effects: setSearchQuery.of(search) });
      if (!q) { setMatchCount(0); return; }
      // count matches
      let count = 0;
      const cursor = search.getCursor(view.state);
      while (!cursor.next().done) { count++; if (count > 9999) break; }
      setMatchCount(count);
    },
    [view]
  );

  const onQueryChange = (v: string) => { setQuery(v); applyQuery(v, replace); };
  const onReplaceChange = (v: string) => { setReplace(v); applyQuery(query, v); };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    if (e.key === "Enter") {
      e.preventDefault();
      if (!view) return;
      if (e.shiftKey) findPrevious(view); else findNext(view);
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
      {/* Find row */}
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
        {btn("↑", () => view && findPrevious(view), tr.prev)}
        {btn("↓", () => view && findNext(view), tr.next)}
        {btn("✕", onClose, tr.close)}
      </div>

      {/* Replace row */}
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
          {btn(tr.replace, () => view && replaceNext(view))}
          {btn(tr.replaceAll, () => view && replaceAll(view))}
        </div>
      )}
    </div>
  );
}
