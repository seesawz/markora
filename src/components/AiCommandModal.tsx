import { useEffect, useRef, useState } from "react";

interface AiCommandModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (instruction: string) => void;
}

export function AiCommandModal({ open, onClose, onSubmit }: AiCommandModalProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const instruction = value.trim();
    if (!instruction) return;
    onSubmit(instruction);
  };

  return (
    <div className="ai-modal-backdrop" onMouseDown={onClose}>
      <div className="ai-command-modal" onMouseDown={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
            if (event.key === "Escape") onClose();
          }}
          placeholder="告诉 AI 你想写什么…"
          aria-label="AI 指令"
        />
        <button type="button" onClick={submit} disabled={!value.trim()}>
          确定
        </button>
      </div>
    </div>
  );
}
