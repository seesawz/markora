import { useEffect, useRef, useLayoutEffect, useState } from "react";

export interface MenuItem {
  id: string;
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onItemClick: (id: string) => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onItemClick, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      let nx = x;
      let ny = y;
      if (x + rect.width > window.innerWidth) nx = window.innerWidth - rect.width - 8;
      if (y + rect.height > window.innerHeight) ny = window.innerHeight - rect.height - 8;
      setPos({ x: Math.max(8, nx), y: Math.max(8, ny) });
      ref.current.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    }
  }, [x, y]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        (document.activeElement as HTMLButtonElement | null)?.click();
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
      const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      if (!buttons.length) return;
      e.preventDefault();
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const index = e.key === "Home"
        ? 0
        : e.key === "End"
          ? buttons.length - 1
          : (current + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[index].focus();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", onClose);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="context-menu" role="menu" style={{ left: pos.x, top: pos.y }}>
      {items.map((item) =>
        item.separator ? (
          <div key={item.id} className="context-menu-separator" />
        ) : (
          <button
            key={item.id}
            className="context-menu-item"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) {
                onItemClick(item.id);
                onClose();
              }
            }}
          >
            <span className="context-menu-label">{item.label}</span>
            {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
          </button>
        )
      )}
    </div>
  );
}
