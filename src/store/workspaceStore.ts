import { create } from "zustand";

export interface WorkspaceFile {
  name: string;
  path: string;
  isDir: boolean;
  children: WorkspaceFile[];
}

export interface WorkspaceTab {
  path: string;
  name: string;
  temporary?: boolean;
  content?: string;
  dirty?: boolean;
}

const MAX_TABS = 20;

interface WorkspaceState {
  root: string | null;
  tree: WorkspaceFile[] | null;
  tabs: WorkspaceTab[];
  activeTabPath: string | null;

  setRoot: (root: string | null) => void;
  setTree: (tree: WorkspaceFile[] | null) => void;
  openTab: (path: string, name: string, temporary?: boolean) => void;
  updateTemporaryTab: (path: string, content: string, dirty: boolean) => void;
  /** 文件重命名后同步标签路径 */
  renameTab: (oldPath: string, newPath: string, newName: string) => void;
  /** 关闭标签，返回新的激活路径（null 表示没有剩余标签） */
  closeTab: (path: string) => string | null;
  setActiveTab: (path: string | null) => void;
  /** 拖拽排序:把 fromPath 标签移动到 toPath 标签的位置 */
  moveTab: (fromPath: string, toPath: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  root: null,
  tree: null,
  tabs: [],
  activeTabPath: null,

  setRoot: (root) => set({ root }),

  setTree: (tree) => set({ tree }),

  openTab: (path, name, temporary = false) => {
    const { tabs } = get();
    if (!tabs.some((tab) => tab.path === path)) {
      const next = [...tabs, { path, name, ...(temporary ? { temporary: true } : {}) }];
      set({ tabs: next.length > MAX_TABS ? next.slice(next.length - MAX_TABS) : next });
    }
    set({ activeTabPath: path });
  },

  updateTemporaryTab: (path, content, dirty) => {
    set(({ tabs }) => ({
      tabs: tabs.map((tab) => (tab.path === path && tab.temporary ? { ...tab, content, dirty } : tab)),
    }));
  },

  renameTab: (oldPath, newPath, newName) => {
    const { tabs, activeTabPath } = get();
    set({
      tabs: tabs.map((tab) => (tab.path === oldPath ? { path: newPath, name: newName } : tab)),
      activeTabPath: activeTabPath === oldPath ? newPath : activeTabPath,
    });
  },

  closeTab: (path) => {
    const { tabs, activeTabPath } = get();
    const index = tabs.findIndex((tab) => tab.path === path);
    if (index === -1) return activeTabPath;

    const next = tabs.filter((tab) => tab.path !== path);
    let newActive = activeTabPath;
    if (activeTabPath === path) {
      if (next.length === 0) {
        newActive = null;
      } else {
        // 优先激活右侧相邻标签，否则激活左侧
        newActive = next[Math.min(index, next.length - 1)].path;
      }
    }
    set({ tabs: next, activeTabPath: newActive });
    return newActive;
  },

  setActiveTab: (path) => set({ activeTabPath: path }),

  moveTab: (fromPath, toPath) => {
    const { tabs } = get();
    const fromIdx = tabs.findIndex((tab) => tab.path === fromPath);
    const toIdx = tabs.findIndex((tab) => tab.path === toPath);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const next = [...tabs];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    set({ tabs: next });
  },
}));
