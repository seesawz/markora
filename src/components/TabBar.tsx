import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { splitFileName } from "../lib/utils";
import { handleWindowDragMouseDown } from "../lib/windowDrag";
import type { WorkspaceTab } from "../store/workspaceStore";

interface TabBarProps {
  tabs: WorkspaceTab[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onRename: (path: string, newName: string) => void;
  onReorder?: (fromPath: string, toPath: string) => void;
  onNewTab?: () => void;
}

export function TabBar({ tabs, activePath, onSelect, onClose, onRename, onReorder, onNewTab }: TabBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  // 拖拽中的标签路径;拖过其他标签时实时换位(浏览器标签的交互习惯)
  const draggingPath = useRef<string | null>(null);

  // 标签多到溢出时,激活的标签(点击/关闭相邻/Cmd+W 后)始终滚进视野
  useEffect(() => {
    const active = barRef.current?.querySelector(".tab-item-active");
    // jsdom 等环境没有 scrollIntoView 实现
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [activePath, tabs.length]);

  // 进入重命名时聚焦并全选主文件名
  useEffect(() => {
    if (!renamingPath || !inputRef.current) return;
    inputRef.current.focus();
    inputRef.current.select();
  }, [renamingPath]);

  // Obsidian 式标题栏:没有标签时也渲染,整条作为窗口拖拽区
  const commitRename = (tab: WorkspaceTab, base: string, ext: string) => {
    const value = (inputRef.current?.value ?? "").trim();
    setRenamingPath(null);
    // 输入的只是主文件名,扩展名自动补回
    if (value && value !== base) onRename(tab.path, value + ext);
  };

  return (
    <div
      className="tab-bar"
      role="tablist"
      aria-label="打开的文档"
      ref={barRef}
      data-window-drag-region
      onMouseDown={handleWindowDragMouseDown}
    >
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        const renaming = renamingPath === tab.path;
        // Obsidian 风格:界面只展示主文件名,.md 后缀不显示也不参与编辑
        const { base, ext } = splitFileName(tab.name);
        return (
          <div
            key={tab.path}
            role="tab"
            aria-selected={active}
            className={`tab-item ${active ? "tab-item-active" : ""}`}
            draggable={!renaming}
            onDragStart={(event) => {
              draggingPath.current = tab.path;
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(event) => {
              if (!draggingPath.current || draggingPath.current === tab.path) return;
              event.preventDefault();
              onReorder?.(draggingPath.current, tab.path);
            }}
            onDragEnd={() => {
              draggingPath.current = null;
            }}
            onClick={() => onSelect(tab.path)}
            onAuxClick={(event) => {
              // 中键点击关闭(Obsidian/浏览器习惯)
              if (event.button === 1) {
                event.preventDefault();
                onClose(tab.path);
              }
            }}
            title={tab.temporary ? "未保存的新文件" : tab.path}
          >
            {renaming ? (
              // 镜像文本撑开容器,输入框宽度始终贴合文件名(中英文都精确)
              <span className="tab-rename-wrap" data-value={base}>
                <input
                  ref={inputRef}
                  className="tab-rename-input"
                  defaultValue={base}
                  // input 默认自带 20 字符的固有宽度,会顶满镜像网格;压到 1 让镜像文本决定宽度
                  size={1}
                  onInput={(event) => {
                    const wrap = event.currentTarget.parentElement;
                    if (wrap) wrap.dataset.value = event.currentTarget.value;
                  }}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onBlur={() => commitRename(tab, base, ext)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitRename(tab, base, ext);
                    if (event.key === "Escape") setRenamingPath(null);
                  }}
                />
              </span>
            ) : (
              <span
                className="min-w-0 flex-1 truncate text-[12.5px]"
                onDoubleClick={(event) => {
                  if (tab.temporary) return;
                  event.stopPropagation();
                  setRenamingPath(tab.path);
                }}
              >
                {base}
              </span>
            )}
            <button
              type="button"
              className="tab-close"
              aria-label={`关闭 ${tab.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.path);
              }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        );
      })}
      {onNewTab && (
        <button
          type="button"
          className="tab-new"
          onClick={onNewTab}
          title="新建文件"
          aria-label="新建文件"
        >
          <Plus size={20} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
