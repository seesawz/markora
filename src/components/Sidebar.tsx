import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useEditorStore } from "../store/editorStore";
import type { FileNode } from "../types";
import {
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Search,
  List,
  Files,
  FilePlus,
  X,
} from "lucide-react";

export function Sidebar() {
  const {
    sidebarWidth,
    sidebarTab,
    setSidebarTab,
    content,
    outline,
    cursorLine,
  } = useEditorStore();

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        width: sidebarWidth,
        minWidth: 200,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-secondary)",
      }}
    >
      {/* Tab header */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-2">
        <TabButton
          active={sidebarTab === "files"}
          onClick={() => setSidebarTab("files")}
          icon={<Files size={15} />}
          label="Files"
        />
        <TabButton
          active={sidebarTab === "outline"}
          onClick={() => setSidebarTab("outline")}
          icon={<List size={15} />}
          label="Outline"
        />
        <TabButton
          active={sidebarTab === "search"}
          onClick={() => setSidebarTab("search")}
          icon={<Search size={15} />}
          label="Search"
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {sidebarTab === "files" && <FileTreePanel />}
        {sidebarTab === "outline" && (
          <OutlinePanel outline={outline} cursorLine={cursorLine} content={content} />
        )}
        {sidebarTab === "search" && <SearchPanel />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12px] font-medium transition-all"
      style={{
        background: active ? "var(--bg-elevated)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-tertiary)",
        boxShadow: active ? "var(--shadow-sm)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "var(--bg-hover)";
          e.currentTarget.style.color = "var(--text-secondary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--text-tertiary)";
        }
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ==================== File Tree Panel ====================

function FileTreePanel() {
  const { fileTreeRoot, setFileTreeRoot, setContent, setFilePath } = useEditorStore();
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTree = useCallback(async () => {
    if (!fileTreeRoot) return;
    setLoading(true);
    try {
      const nodes = await invoke<FileNode[]>("read_directory", { path: fileTreeRoot });
      setTree(nodes);
    } catch (e) {
      console.error("Failed to read directory:", e);
    } finally {
      setLoading(false);
    }
  }, [fileTreeRoot]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const handleOpenFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      setFileTreeRoot(selected as string);
    }
  };

  const handleOpenFile = async (path: string) => {
    try {
      const content = await invoke<string>("read_file_content", { path });
      setContent(content);
      setFilePath(path);
      useEditorStore.getState().setDirty(false);
    } catch (e) {
      console.error("Failed to read file:", e);
    }
  };

  const handleNewFile = async () => {
    if (!fileTreeRoot) return;
    const fileName = `untitled-${Date.now()}.md`;
    const filePath = `${fileTreeRoot}/${fileName}`;
    try {
      await invoke("create_new_file", { path: filePath });
      await loadTree();
      setContent("");
      setFilePath(filePath);
    } catch (e) {
      console.error("Failed to create file:", e);
    }
  };

  if (!fileTreeRoot) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
        <div
          className="flex items-center justify-center w-14 h-14 rounded-2xl"
          style={{ background: "var(--bg-tertiary)" }}
        >
          <FolderOpen size={26} style={{ color: "var(--text-tertiary)" }} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
            No folder opened
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            Open a folder to browse files
          </p>
        </div>
        <button
          onClick={handleOpenFolder}
          className="px-4 py-2 rounded-lg text-[12px] font-medium transition-all"
          style={{
            background: "var(--accent)",
            color: "#fff",
            boxShadow: "var(--shadow-sm)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
        >
          Open Folder
        </button>
      </div>
    );
  }

  const rootName = fileTreeRoot.split("/").pop() || fileTreeRoot;

  return (
    <div className="flex flex-col h-full">
      {/* Folder header */}
      <div className="flex items-center justify-between px-3 py-2 mx-2 mt-1 rounded-lg" style={{ background: "var(--bg-tertiary)" }}>
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <span
            className="text-[12px] font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
            title={fileTreeRoot}
          >
            {rootName}
          </span>
        </div>
        <button
          onClick={handleNewFile}
          className="flex items-center justify-center w-6 h-6 rounded-md transition-all"
          title="New File"
          style={{ color: "var(--text-tertiary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-hover)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-tertiary)";
          }}
        >
          <FilePlus size={14} />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1 px-2">
        {loading ? (
          <div className="px-3 py-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            Loading...
          </div>
        ) : (
          tree.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              onOpenFile={handleOpenFile}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FileTreeNode({
  node,
  depth,
  onOpenFile,
}: {
  node: FileNode;
  depth: number;
  onOpenFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const { currentFilePath } = useEditorStore();

  const isActive = currentFilePath === node.path;

  if (node.is_dir) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center w-full gap-1 px-2 py-[5px] rounded-md text-[12px] transition-all"
          style={{
            paddingLeft: `${depth * 14 + 8}px`,
            color: "var(--text-secondary)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {expanded ? (
            <ChevronDown size={13} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
          ) : (
            <ChevronRight size={13} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
          )}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {expanded &&
          node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onOpenFile={onOpenFile}
            />
          ))}
      </div>
    );
  }

  const isMarkdown = node.name.endsWith(".md") || node.name.endsWith(".markdown");

  return (
    <button
      onClick={() => onOpenFile(node.path)}
      className="flex items-center w-full gap-1.5 px-2 py-[5px] rounded-md text-[12px] transition-all"
      style={{
        paddingLeft: `${depth * 14 + 22}px`,
        background: isActive ? "var(--bg-selected)" : "transparent",
        color: isActive ? "var(--accent)" : "var(--text-secondary)",
        fontWeight: isActive ? 500 : 400,
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = "transparent";
      }}
    >
      <FileText
        size={13}
        style={{
          color: isMarkdown ? (isActive ? "var(--accent)" : "var(--text-tertiary)") : "var(--text-tertiary)",
          flexShrink: 0,
        }}
      />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// ==================== Outline Panel ====================

function OutlinePanel({
  outline,
}: {
  outline: { level: number; text: string; line: number }[];
  cursorLine: number;
  content: string;
}) {
  const { content, setOutline } = useEditorStore();

  useEffect(() => {
    const lines = content.split("\n");
    const items: { level: number; text: string; line: number }[] = [];
    let inCodeBlock = false;

    lines.forEach((line, idx) => {
      if (line.trim().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        return;
      }
      if (inCodeBlock) return;

      const match = line.match(/^(#{1,6})\s+(.+)/);
      if (match) {
        items.push({
          level: match[1].length,
          text: match[2].replace(/[#*`_~\[\]]/g, "").trim(),
          line: idx + 1,
        });
      }
    });

    setOutline(items);
  }, [content, setOutline]);

  if (outline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-2xl"
          style={{ background: "var(--bg-tertiary)" }}
        >
          <List size={22} style={{ color: "var(--text-tertiary)" }} />
        </div>
        <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          No headings found
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full py-1 px-2">
      {outline.map((item, idx) => (
        <button
          key={idx}
          onClick={() => {}}
          className="block w-full text-left px-2.5 py-[5px] rounded-md text-[12px] transition-all truncate"
          style={{
            paddingLeft: `${8 + (item.level - 1) * 14}px`,
            color: "var(--text-secondary)",
            fontWeight: item.level <= 2 ? 500 : 400,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          title={item.text}
        >
          {item.text}
        </button>
      ))}
    </div>
  );
}

// ==================== Search Panel ====================

function SearchPanel() {
  const { content } = useEditorStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ line: number; text: string; match: string }[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const lines = content.split("\n");
    const matches: { line: number; text: string; match: string }[] = [];
    const lowerQuery = query.toLowerCase();

    lines.forEach((line, idx) => {
      const lower = line.toLowerCase();
      const pos = lower.indexOf(lowerQuery);
      if (pos !== -1) {
        const start = Math.max(0, pos - 20);
        const end = Math.min(line.length, pos + query.length + 20);
        const text =
          (start > 0 ? "..." : "") + line.substring(start, end) + (end < line.length ? "..." : "");
        matches.push({ line: idx + 1, text, match: line.substring(pos, pos + query.length) });
      }
    });

    setResults(matches);
  }, [query, content]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 pb-2">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-primary)",
          }}
        >
          <Search size={14} style={{ color: "var(--text-tertiary)" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in document..."
            className="flex-1 bg-transparent outline-none text-[12px]"
            style={{ color: "var(--text-primary)" }}
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{ color: "var(--text-tertiary)" }}
              className="hover:opacity-70 transition-opacity"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {query && (
          <p className="text-[11px] mt-2 px-1" style={{ color: "var(--text-tertiary)" }}>
            {results.length} {results.length === 1 ? "match" : "matches"} found
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {results.map((result, idx) => (
          <button
            key={idx}
            onClick={() => {}}
            className="block w-full text-left px-3 py-2 rounded-lg transition-all mb-0.5"
            style={{
              color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div className="text-[11px] font-medium mb-0.5" style={{ color: "var(--text-tertiary)" }}>
              Line {result.line}
            </div>
            <div className="text-[12px] truncate">{result.text}</div>
          </button>
        ))}
        {query && results.length === 0 && (
          <div
            className="flex items-center justify-center h-32 text-[12px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            No matches found
          </div>
        )}
        {!query && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3">
            <div
              className="flex items-center justify-center w-12 h-12 rounded-2xl"
              style={{ background: "var(--bg-tertiary)" }}
            >
              <Search size={22} style={{ color: "var(--text-tertiary)" }} />
            </div>
            <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              Type to search
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
