import { useEditorStore } from "../store/editorStore";
import { useT } from "../lib/i18n";

export function StatusBar() {
  const {
    isDirty,
    currentFileName,
    currentFilePath,
    cursorLine,
    cursorColumn,
    wordCount,
    charCount,
  } = useEditorStore();

  const tr = useT();

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
        {isDirty ? currentFileName : currentFilePath ? tr.saved : tr.unsaved}
      </span>

      {/* Right: cursor + counts */}
      <span
        className="flex items-center"
        style={{ gap: 14, color: "var(--text-tertiary)" }}
      >
        <span>Ln {cursorLine}, Col {cursorColumn}</span>
        <span>{wordCount} {tr.words}</span>
        <span>{charCount} {tr.chars}</span>
      </span>
    </div>
  );
}
