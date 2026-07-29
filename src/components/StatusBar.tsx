import { useEditorStore } from "../store/editorStore";

export function StatusBar() {
  const { isDirty, currentFileName, currentFilePath, editorMode } = useEditorStore();

  return (
    <div
      className="flex items-center justify-between select-none"
      style={{
        height: 24,
        padding: "0 16px",
        background: "var(--statusbar-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid var(--border-secondary)",
        fontSize: 11,
        color: "var(--text-tertiary)",
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

      {/* Right: mode */}
      <span>{editorMode === "source" ? "Source" : "Preview"}</span>
    </div>
  );
}
