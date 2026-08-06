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
}

const MAX_TABS = 20;

interface WorkspaceState {
  root: string | null;
  tree: WorkspaceFile[] | null;
  tabs: WorkspaceTab[];
  activeTabPath: string | null;

  setRoot: (root: string | null) => void;
  setTree: (tree: WorkspaceFile[] | null) => void;
  openTab: (path: string, name: string) => void;
  /** 文件重命名后同步标签路径 */
  renameTab: (oldPath: string, newPath: string, newName: string) => void;
  /** 关闭标签，返回新的激活路径（null 表示没有剩余标签） */
  closeTab: (path: string) => string | null;
  setActiveTab: (path: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  root: null,
  tree: null,
  tabs: [],
  activeTabPath: null,

  setRoot: (root) => set({ root }),

  setTree: (tree) => set({ tree }),

  openTab: (path, name) => {
    const { tabs } = get();
    if (!tabs.some((tab) => tab.path === path)) {
      const next = [...tabs, { path, name }];
      set({ tabs: next.length > MAX_TABS ? next.slice(next.length - MAX_TABS) : next });
    }
    set({ activeTabPath: path });
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
}));
