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
      className="flex items-center justify-between h-6 px-3 text-xs select-none border-t"
      style={{
        background: "var(--typora-statusbar-bg)",
        borderColor: "var(--typora-border)",
        color: "var(--typora-text-secondary)",
      }}
    >
      <div className="flex items-center gap-4">
        <span>{editorMode === "source" ? "Source" : "Preview"}</span>
        <span>{theme === "light" ? "Light" : "Dark"}</span>
      </div>

      <div className="flex items-center gap-4">
        <span>Ln {cursorLine}, Col {cursorColumn}</span>
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
        <span>UTF-8</span>
        <span>Markdown</span>
      </div>
    </div>
  );
}
