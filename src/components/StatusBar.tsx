import { useEditorStore } from "../store/editorStore";
import { useAiStore } from "../store/aiStore";
import { useT } from "../lib/i18n";
import { Sparkles, Settings, Loader2, AlertCircle } from "lucide-react";

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

  const aiTitle = isGenerating ? "AI 生成中…" : aiEnabled ? "AI 续写：开" : "AI 续写：关";
  const aiColor = aiEnabled ? "var(--accent)" : "var(--text-tertiary)";

  return (
    <div
      className="flex items-center justify-between select-none"
      style={{
        height: 28,
        padding: "0 12px",
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

      {/* Right: icons + cursor + counts */}
      <span className="flex items-center" style={{ gap: 8, color: "var(--text-tertiary)" }}>
        <button
          type="button"
          className="grid place-items-center h-6 w-6 rounded transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: aiColor }}
          onClick={() => setEnabled(!aiEnabled)}
          title={aiTitle}
          aria-label={aiTitle}
        >
          {isGenerating ? (
            <Loader2 className="h-[13px] w-[13px] animate-spin" />
          ) : (
            <Sparkles className="h-[13px] w-[13px]" />
          )}
        </button>
        <button
          type="button"
          className="grid place-items-center h-6 w-6 rounded transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          onClick={onOpenSettings}
          title="设置"
          aria-label="设置"
        >
          <Settings className="h-[13px] w-[13px]" />
        </button>
        {aiError && (
          <span
            className="flex items-center"
            style={{ color: "#d14343" }}
            title={aiError}
          >
            <AlertCircle className="h-[13px] w-[13px]" />
          </span>
        )}
        <span style={{ marginLeft: 4 }}>Ln {cursorLine}, Col {cursorColumn}</span>
        <span>{wordCount} {tr.words}</span>
        <span>{charCount} {tr.chars}</span>
      </span>
    </div>
  );
}
