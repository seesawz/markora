import { useEffect, useRef, useState } from "react";
import { ChevronRight, FileInput, FilePlus, FileText, Folder, FolderOpen, ListTree, RefreshCw } from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { splitFileName } from "../lib/utils";
import type { WorkspaceFile } from "../store/workspaceStore";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { OutlinePanel } from "./OutlinePanel";

const DEFAULT_SIDEBAR_WIDTH = 220;
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 420;

interface FileTreeProps {
  root: string | null;
  tree: WorkspaceFile[] | null;
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onOpenFileDialog: () => void;
  onOpenFolder: () => void;
  onNewFile: () => void;
  onRefresh: () => void;
  onRename: (path: string, newName: string) => void;
  onDelete: (path: string, isDir: boolean) => void;
}

interface Tooltip {
  text: string;
  x: number;
  y: number;
}

interface TreeMenu {
  x: number;
  y: number;
  path: string;
  isDir: boolean;
}

function rootName(root: string): string {
  const parts = root.replace(/[\\/]+$/, "").split(/[\\/]/);
  return parts[parts.length - 1] || root;
}

interface TreeItemProps {
  node: WorkspaceFile;
  depth: number;
  activePath: string | null;
  expanded: Record<string, boolean>;
  renamingPath: string | null;
  onToggle: (path: string, depth: number) => void;
  onOpenFile: (path: string) => void;
  onStartRename: (path: string | null) => void;
  onCommitRename: (path: string, newName: string) => void;
  onContextMenu: (menu: TreeMenu) => void;
}

function TreeItem({ node, depth, activePath, expanded, renamingPath, onToggle, onOpenFile, onStartRename, onCommitRename, onContextMenu }: TreeItemProps) {
  // 未点过的目录沿用默认规则(顶层展开),点过之后以用户状态为准,刷新文件树不丢折叠状态
  const expandedValue = expanded[node.path] ?? depth === 0;
  const renaming = renamingPath === node.path;
  const inputRef = useRef<HTMLInputElement>(null);
  // Obsidian 风格:文件只展示主文件名;目录无扩展名概念,原样展示
  const { base, ext } = node.isDir ? { base: node.name, ext: "" } : splitFileName(node.name);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  const commitRename = () => {
    const value = (inputRef.current?.value ?? "").trim();
    onStartRename(null);
    // 输入的只是主文件名,扩展名自动补回
    if (value && value !== base) onCommitRename(node.path, value + ext);
  };

  if (node.isDir) {
    return (
      <>
        <button
          type="button"
          className="tree-row"
          style={{ paddingLeft: `${6 + depth * 14}px` }}
          onClick={() => onToggle(node.path, depth)}
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu({ x: e.clientX, y: e.clientY, path: node.path, isDir: true });
          }}
          title={node.path}
        >
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform"
            style={{ transform: expandedValue ? "rotate(90deg)" : undefined }}
          />
          {expandedValue ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
          )}
          {renaming ? (
            <input
              ref={inputRef}
              className="tree-rename-input"
              defaultValue={base}
              onClick={(e) => e.stopPropagation()}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") onStartRename(null);
              }}
            />
          ) : (
            <span className="truncate">{base}</span>
          )}
        </button>
        {expandedValue &&
          node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              expanded={expanded}
              renamingPath={renamingPath}
              onToggle={onToggle}
              onOpenFile={onOpenFile}
              onStartRename={onStartRename}
              onCommitRename={onCommitRename}
              onContextMenu={onContextMenu}
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
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu({ x: e.clientX, y: e.clientY, path: node.path, isDir: false });
      }}
      title={node.path}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
      {renaming ? (
        <input
          ref={inputRef}
          className="tree-rename-input"
          defaultValue={base}
          onClick={(e) => e.stopPropagation()}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") onStartRename(null);
          }}
        />
      ) : (
        <span className="truncate">{base}</span>
      )}
    </button>
  );
}

export function FileTree({ root, tree, activePath, onOpenFile, onOpenFileDialog, onOpenFolder, onNewFile, onRefresh, onRename, onDelete }: FileTreeProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [width, setWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [resizing, setResizing] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [menu, setMenu] = useState<TreeMenu | null>(null);

  useEffect(() => {
    if (!resizing) return;

    const resize = (event: PointerEvent) => {
      setWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, event.clientX)));
    };
    const stopResize = () => setResizing(false);

    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize, { once: true });
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", resize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing]);

  const adjustWidth = (delta: number) => {
    setWidth((value) => Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value + delta)));
  };

  const showTooltip = (event: React.MouseEvent<HTMLElement>, text: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(text.length * 13 + 16, 200);
    setTooltip({
      text,
      x: Math.min(rect.right + 8, window.innerWidth - width - 8),
      y: rect.top + rect.height / 2,
    });
  };

  const toggleDir = (path: string, depth: number) => {
    setExpanded((prev) => ({ ...prev, [path]: !(prev[path] ?? depth === 0) }));
  };

  const menuItems: MenuItem[] = menu
    ? [
        { id: "rename", label: "重命名" },
        { id: "delete", label: menu.isDir ? "删除文件夹" : "删除文件" },
        { id: "sep1", separator: true },
        { id: "reveal", label: "在访达中显示" },
      ]
    : [];

  const handleMenuClick = (id: string) => {
    if (!menu) return;
    if (id === "rename") setRenamingPath(menu.path);
    if (id === "delete") onDelete(menu.path, menu.isDir);
    if (id === "reveal") revealItemInDir(menu.path).catch((e) => console.error("reveal failed:", e));
  };

  return (
    <aside className="sidebar" aria-label="文件树" style={{ width }}>
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
        {root && (
          <button
            type="button"
            className="sidebar-icon-btn"
            onClick={onRefresh}
            onMouseEnter={(e) => showTooltip(e, "刷新")}
            onMouseLeave={() => setTooltip(null)}
            aria-label="刷新文件树"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
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
        // 工作区模式：只显示文件树（大纲仅在无工作区时显示）
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              activePath={activePath}
              expanded={expanded}
              renamingPath={renamingPath}
              onToggle={toggleDir}
              onOpenFile={onOpenFile}
              onStartRename={setRenamingPath}
              onCommitRename={onRename}
              onContextMenu={setMenu}
            />
          ))}
        </div>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onItemClick={handleMenuClick}
          onClose={() => setMenu(null)}
        />
      )}

      <div
        className="sidebar-resize-handle"
        data-resizing={resizing || undefined}
        role="separator"
        aria-label="调整侧边栏宽度"
        aria-orientation="vertical"
        aria-valuemin={MIN_SIDEBAR_WIDTH}
        aria-valuemax={MAX_SIDEBAR_WIDTH}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          setResizing(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            adjustWidth(-8);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            adjustWidth(8);
          }
        }}
      />
    </aside>
  );
}
