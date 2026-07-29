import { useEditorStore } from "../store/editorStore";

export function StatusBar() {
  const {
    cursorLine,
    cursorColumn,
    wordCount,
    charCount,
    editorMode,
    theme,
  } = useEditorStore();

  return (
    <div
      className="flex items-center justify-between h-6 px-3 text-[11px] select-none"
      style={{
        background: "var(--statusbar-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid var(--border-secondary)",
        color: "var(--text-tertiary)",
      }}
    >
      <div className="flex items-center gap-3">
        <span style={{ color: "var(--text-secondary)" }}>{editorMode === "source" ? "Source" : "Preview"}</span>
        <span>{theme === "light" ? "Light" : "Dark"}</span>
      </div>

      <div className="flex items-center gap-3">
        <span>Ln {cursorLine}, Col {cursorColumn}</span>
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
        <span>UTF-8</span>
        <span>Markdown</span>
      </div>
    </div>
  );
}
