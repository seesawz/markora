import { useEditorStore } from "../store/editorStore";
import { useAiStore } from "../store/aiStore";
import { useT } from "../lib/i18n";
import { CircleNotch, GearSix, WarningCircle } from "@phosphor-icons/react";

interface StatusBarProps {
  onOpenSettings: () => void;
}

export function StatusBar({ onOpenSettings }: StatusBarProps) {
  // 字段级订阅:避免 store 里无关字段变化时整条状态栏(带 backdrop-filter)重绘
  const isDirty = useEditorStore((s) => s.isDirty);
  const currentFileName = useEditorStore((s) => s.currentFileName);
  const currentFilePath = useEditorStore((s) => s.currentFilePath);
  const cursorLine = useEditorStore((s) => s.cursorLine);
  const cursorColumn = useEditorStore((s) => s.cursorColumn);
  const wordCount = useEditorStore((s) => s.wordCount);
  const charCount = useEditorStore((s) => s.charCount);
  const isGenerating = useAiStore((s) => s.isGenerating);
  const aiError = useAiStore((s) => s.error);

  const tr = useT();

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
        {isGenerating && <CircleNotch size={13} className="animate-spin" aria-label="AI 生成中" />}
        <button
          type="button"
          className="grid place-items-center h-6 w-6 rounded transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          onClick={onOpenSettings}
          title="设置"
          aria-label="设置"
        >
          <GearSix size={13} />
        </button>
        {aiError && (
          <span
            className="flex items-center"
            style={{ color: "#d14343" }}
            title={aiError}
          >
            <WarningCircle size={13} />
          </span>
        )}
        <span style={{ marginLeft: 4 }}>Ln {cursorLine}, Col {cursorColumn}</span>
        <span>{wordCount} {tr.words}</span>
        <span>{charCount} {tr.chars}</span>
      </span>
    </div>
  );
}
