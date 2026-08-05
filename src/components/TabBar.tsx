import { X } from "lucide-react";
import type { WorkspaceTab } from "../store/workspaceStore";

interface TabBarProps {
  tabs: WorkspaceTab[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export function TabBar({ tabs, activePath, onSelect, onClose }: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="tab-bar" role="tablist" aria-label="打开的文档">
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        return (
          <div
            key={tab.path}
            role="tab"
            aria-selected={active}
            className={`tab-item ${active ? "tab-item-active" : ""}`}
            onClick={() => onSelect(tab.path)}
            title={tab.path}
          >
            <span className="min-w-0 flex-1 truncate text-[12.5px]">{tab.name}</span>
            <button
              type="button"
              className="tab-close"
              aria-label={`关闭 ${tab.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.path);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
