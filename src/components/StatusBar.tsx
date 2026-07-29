import { useEditorStore } from "../store/editorStore";

export function StatusBar() {
  const {
    isDirty,
    currentFileName,
    currentFilePath,
    editorMode,
    setEditorMode,
    cursorLine,
    cursorColumn,
    wordCount,
    charCount,
  } = useEditorStore();

  return (
    <div
      className="flex items-center justify-between select-none"
      style={{
        height: 28,
        padding: "0 20px",
        background: "var(--statusbar-bg)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderTop: "1px solid var(--border-secondary)",
        fontSize: 11,
        color: "var(--text-tertiary)",
        fontWeight: 500,
      }}
    >
      {/* Left: file status */}
      <span
        className="flex items-center"
        style={{ gap: 5, color: isDirty ? "var(--accent)" : "var(--text-tertiary)" }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: isDirty ? "var(--accent)" : "var(--text-tertiary)",
            opacity: isDirty ? 1 : 0.4,
            display: "inline-block",
          }}
        />
        {isDirty ? currentFileName : currentFilePath ? "Saved" : "Unsaved"}
      </span>

      {/* Center: cursor + counts */}
      <span
        className="flex items-center"
        style={{ gap: 14, color: "var(--text-tertiary)" }}
      >
        {editorMode === "source" && (
          <span>Ln {cursorLine}, Col {cursorColumn}</span>
        )}
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
      </span>

      {/* Right: mode toggle */}
      <div
        className="flex items-center"
        style={{
          background: "var(--bg-secondary)",
          borderRadius: 6,
          padding: 2,
          gap: 1,
        }}
      >
        <button
          onClick={() => setEditorMode("source")}
          title="Edit"
          style={{
            width: 22,
            height: 18,
            borderRadius: 4,
            border: "none",
            background: editorMode === "source" ? "var(--bg-elevated)" : "transparent",
            color: editorMode === "source" ? "var(--text-primary)" : "var(--text-tertiary)",
            cursor: "pointer",
            boxShadow: editorMode === "source" ? "var(--shadow-sm)" : "none",
            transition: "all 150ms ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 0,
            lineHeight: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </button>
        <button
          onClick={() => setEditorMode("preview")}
          title="Preview"
          style={{
            width: 22,
            height: 18,
            borderRadius: 4,
            border: "none",
            background: editorMode === "preview" ? "var(--bg-elevated)" : "transparent",
            color: editorMode === "preview" ? "var(--text-primary)" : "var(--text-tertiary)",
            cursor: "pointer",
            boxShadow: editorMode === "preview" ? "var(--shadow-sm)" : "none",
            transition: "all 150ms ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 0,
            lineHeight: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
