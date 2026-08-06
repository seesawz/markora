import { useState } from "react";
import { ChevronRight, FileInput, FilePlus, FileText, Folder, FolderOpen, ListTree } from "lucide-react";
import type { WorkspaceFile } from "../store/workspaceStore";
import { OutlinePanel } from "./OutlinePanel";

interface FileTreeProps {
  root: string | null;
  tree: WorkspaceFile[] | null;
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onOpenFileDialog: () => void;
  onOpenFolder: () => void;
  onNewFile: () => void;
}

interface Tooltip {
  text: string;
  x: number;
  y: number;
}

function rootName(root: string): string {
  const parts = root.replace(/[\\/]+$/, "").split(/[\\/]/);
  return parts[parts.length - 1] || root;
}

interface TreeItemProps {
  node: WorkspaceFile;
  depth: number;
  activePath: string | null;
  onOpenFile: (path: string) => void;
}

function TreeItem({ node, depth, activePath, onOpenFile }: TreeItemProps) {
  const [expanded, setExpanded] = useState(depth === 0);

  if (node.isDir) {
    return (
      <>
        <button
          type="button"
          className="tree-row"
          style={{ paddingLeft: `${6 + depth * 14}px` }}
          onClick={() => setExpanded((value) => !value)}
          title={node.path}
        >
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform"
            style={{ transform: expanded ? "rotate(90deg)" : undefined }}
          />
          {expanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {expanded &&
          node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onOpenFile={onOpenFile}
            />
          ))}
      </>
    );
  }

  const active = node.path === activePath;
  return (
    <button
      type="button"
      className={`tree-row ${active ? "tree-row-active" : ""}`}
      style={{ paddingLeft: `${6 + depth * 14 + 14}px` }}
      onClick={() => onOpenFile(node.path)}
      title={node.path}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileTree({ root, tree, activePath, onOpenFile, onOpenFileDialog, onOpenFolder, onNewFile }: FileTreeProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const showTooltip = (event: React.MouseEvent<HTMLElement>, text: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(text.length * 13 + 16, 200);
    setTooltip({
      text,
      x: Math.min(rect.right + 8, window.innerWidth - width - 8),
      y: rect.top + rect.height / 2,
    });
  };

  return (
    <aside className="sidebar" aria-label="文件树">
      <div className="flex items-center gap-1 px-3 py-2">
        {root ? (
          <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
        ) : (
          <ListTree className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
        )}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text-primary)]">
          {root ? rootName(root) : "大纲"}
        </span>
        <button
          type="button"
          className="sidebar-icon-btn"
          onClick={onNewFile}
          onMouseEnter={(e) => showTooltip(e, "新建文件")}
          onMouseLeave={() => setTooltip(null)}
          aria-label="新建文件"
        >
          <FilePlus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="sidebar-icon-btn"
          onClick={onOpenFileDialog}
          onMouseEnter={(e) => showTooltip(e, "打开文件")}
          onMouseLeave={() => setTooltip(null)}
          aria-label="打开文件"
        >
          <FileInput className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="sidebar-icon-btn"
          onClick={onOpenFolder}
          onMouseEnter={(e) => showTooltip(e, "打开文件夹")}
          onMouseLeave={() => setTooltip(null)}
          aria-label="打开文件夹"
        >
          <FolderOpen className="h-3.5 w-3.5" />
        </button>
      </div>

      {tooltip && (
        <div className="sidebar-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}

      {!root ? (
        // 单文件模式：展示当前文档的标题目录
        <OutlinePanel onOpenFileDialog={onOpenFileDialog} onOpenFolder={onOpenFolder} />
      ) : !tree || tree.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <p className="text-[12px] leading-relaxed text-[var(--text-tertiary)]">
            这个文件夹里还没有 Markdown 文件
          </p>
          <button
            type="button"
            className="rounded-md border border-[var(--border-primary)] px-3 py-1 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
            onClick={onOpenFolder}
          >
            打开文件夹
          </button>
        </div>
      ) : (
        <div className="overflow-y-auto pb-4">
          {tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              activePath={activePath}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
