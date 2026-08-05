import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type AiCommandStatus = "idle" | "generating" | "error";

interface AiCommandModalProps {
  open: boolean;
  /** 编辑器光标（head）的视口坐标，输入框会贴在这个位置附近弹出 */
  anchor: { x: number; y: number } | null;
  status: AiCommandStatus;
  error: string | null;
  onClose: () => void;
  onSubmit: (instruction: string) => void;
}

const POPOVER_WIDTH = 360;

export function AiCommandModal({ open, anchor, status, error, onClose, onSubmit }: AiCommandModalProps) {
  const [value, setValue] = useState("");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 每次打开时清空输入并聚焦
  useEffect(() => {
    if (!open) return;
    setValue("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // 定位:优先光标正下方,空间不足时移到上方,并钳制在视口内
  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const el = rootRef.current;
    if (!el) return;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const height = el.getBoundingClientRect().height;
    let x = anchor.x;
    if (x + POPOVER_WIDTH > vw - margin) x = vw - margin - POPOVER_WIDTH;
    if (x < margin) x = margin;
    let y = anchor.y + 6;
    if (y + height > vh - margin) y = anchor.y - height - 6;
    if (y < margin) y = margin;
    setPos({ x, y });
  }, [open, anchor, status, error]);

  // 点击输入框外部时关闭
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [open, onClose]);

  if (!open) return null;

  const generating = status === "generating";

  const submit = () => {
    const instruction = value.trim();
    if (!instruction || generating) return;
    onSubmit(instruction);
  };

  const style = pos
    ? { left: pos.x, top: pos.y }
    : anchor
      ? { left: anchor.x, top: anchor.y + 6 }
      : undefined;

  return (
    <div
      ref={rootRef}
      className="ai-command-popover"
      style={style}
      role="dialog"
      aria-label="AI 指令"
    >
      <div className="ai-command-row">
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
            if (event.key === "Escape") onClose();
          }}
          placeholder={generating ? "AI 生成中…" : "告诉 AI 你想写什么…"}
          aria-label="AI 指令"
          disabled={generating}
        />
        <button type="button" onClick={submit} disabled={!value.trim() || generating}>
          生成
        </button>
      </div>
      {status === "error" && error && <div className="ai-command-error">{error}</div>}
    </div>
  );
}
