import { useEditorStore } from "../store/editorStore";
import { useAiStore } from "../store/aiStore";
import { useT } from "../lib/i18n";

interface StatusBarProps {
  onOpenSettings: () => void;
}

export function StatusBar({ onOpenSettings }: StatusBarProps) {
  const {
    isDirty,
    currentFileName,
    currentFilePath,
    cursorLine,
    cursorColumn,
    wordCount,
    charCount,
  } = useEditorStore();
  const { enabled: aiEnabled, isGenerating, error: aiError, setEnabled } = useAiStore();

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
        style={{ gap: 10, color: "var(--text-tertiary)" }}
      >
        <button
          type="button"
          className="statusbar-button"
          style={{ color: aiEnabled ? "var(--accent)" : "var(--text-tertiary)" }}
          onClick={() => setEnabled(!aiEnabled)}
          title="开启或关闭 AI 续写"
        >
          {isGenerating ? "AI 生成中…" : aiEnabled ? "AI 续写：开" : "AI 续写：关"}
        </button>
        <button type="button" className="statusbar-button" onClick={onOpenSettings} title="AI 设置">设置</button>
        {aiError && <span className="statusbar-error" title={aiError}>AI：{aiError}</span>}
        <span>Ln {cursorLine}, Col {cursorColumn}</span>
        <span>{wordCount} {tr.words}</span>
        <span>{charCount} {tr.chars}</span>
      </span>
    </div>
  );
}
