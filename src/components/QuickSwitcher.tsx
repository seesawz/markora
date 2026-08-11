import { useEffect, useMemo, useRef, useState } from "react";
import { FileText } from "@phosphor-icons/react";
import { splitFileName } from "../lib/utils";

export interface QuickFile {
  path: string;
  name: string;
  /** 相对工作区根目录的展示路径 */
  rel: string;
}

interface QuickSwitcherProps {
  files: QuickFile[];
  onSelect: (path: string) => void;
  onClose: () => void;
}

/** 匹配打分:文件名前缀 > 文件名包含 > 路径包含;不匹配返回 -1 */
function score(file: QuickFile, query: string): number {
  const q = query.toLowerCase();
  const name = file.name.toLowerCase();
  if (name.startsWith(q)) return 0;
  if (name.includes(q)) return 1;
  if (file.rel.toLowerCase().includes(q)) return 2;
  return -1;
}

/** ⌘P 按文件名模糊跳转(Obsidian 式 Quick Switcher) */
export function QuickSwitcher({ files, onSelect, onClose }: QuickSwitcherProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matches = useMemo(() => {
    if (!query.trim()) return files.slice(0, 50);
    return files
      .map((f) => ({ f, s: score(f, query.trim()) }))
      .filter((m) => m.s >= 0)
      .sort((a, b) => a.s - b.s || a.f.rel.localeCompare(b.f.rel))
      .slice(0, 50)
      .map((m) => m.f);
  }, [files, query]);

  // 结果集变化时选中项回到第一条
  useEffect(() => {
    setIndex(0);
  }, [query]);

  // 选中项滚进视野
  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]');
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [index, matches]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = matches[index];
      if (target) onSelect(target.path);
    }
  };

  return (
    <div className="quick-switcher-overlay" onMouseDown={onClose}>
      <div className="quick-switcher" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="quick-switcher-input"
          value={query}
          placeholder="输入文件名跳转…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
        />
        <div className="quick-switcher-list" ref={listRef}>
          {matches.length === 0 ? (
            <div className="quick-switcher-empty">没有匹配的文件</div>
          ) : (
            matches.map((file, i) => (
              <button
                key={file.path}
                type="button"
                data-active={i === index || undefined}
                className={`quick-switcher-item ${i === index ? "quick-switcher-item-active" : ""}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => onSelect(file.path)}
              >
                <FileText size={14} className="shrink-0 text-[var(--text-tertiary)]" />
                <span className="truncate">{splitFileName(file.name).base}</span>
                <span className="quick-switcher-rel truncate">{file.rel}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
