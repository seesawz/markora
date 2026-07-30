import { create } from "zustand";

export type EditorMode = "source" | "preview";
export type SidebarTab = "files" | "outline" | "search";
export type Theme = "light" | "dark";
export type Lang = "zh" | "en";

export interface OutlineItem {
  level: number;
  text: string;
  line: number;
}

interface EditorState {
  // File state
  currentFilePath: string | null;
  currentFileName: string;
  content: string;
  isDirty: boolean;

  // UI state
  sidebarVisible: boolean;
  sidebarWidth: number;
  sidebarTab: SidebarTab;
  editorMode: EditorMode;
  theme: Theme;
  lang: Lang;
  focusMode: boolean;
  statusBarVisible: boolean;

  // Editor info
  cursorLine: number;
  cursorColumn: number;
  wordCount: number;
  charCount: number;

  // Outline
  outline: OutlineItem[];

  // File tree
  fileTreeRoot: string | null;
  searchQuery: string;

  // Actions
  setContent: (content: string) => void;
  setFilePath: (path: string | null) => void;
  setDirty: (dirty: boolean) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setEditorMode: (mode: EditorMode) => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setLang: (lang: Lang) => void;
  toggleFocusMode: () => void;
  setStatusBarVisible: (visible: boolean) => void;
  setCursor: (line: number, column: number) => void;
  setOutline: (outline: OutlineItem[]) => void;
  setFileTreeRoot: (root: string | null) => void;
  setSearchQuery: (query: string) => void;
  updateStats: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  currentFilePath: null,
  currentFileName: "未命名.md",
  content: "",
  isDirty: false,

  sidebarVisible: true,
  sidebarWidth: 260,
  sidebarTab: "files",
  editorMode: "source",
  theme: "light",
  lang: "zh",
  focusMode: false,
  statusBarVisible: true,

  cursorLine: 1,
  cursorColumn: 1,
  wordCount: 0,
  charCount: 0,

  outline: [],
  fileTreeRoot: null,
  searchQuery: "",

  setContent: (content) => {
    set({ content, isDirty: true });
    get().updateStats();
  },

  setFilePath: (path) => {
    const fileName = path
      ? path.split("/").pop() || "未命名.md"
      : "未命名.md";
    set({ currentFilePath: path, currentFileName: fileName, isDirty: false });
  },

  setDirty: (dirty) => set({ isDirty: dirty }),

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),

  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(180, Math.min(500, width)) }),

  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  setEditorMode: (mode) => set({ editorMode: mode }),

  toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
  setTheme: (theme) => set({ theme }),

  setLang: (lang) => set({ lang }),

  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

  setStatusBarVisible: (visible) => set({ statusBarVisible: visible }),

  setCursor: (line, column) => set({ cursorLine: line, cursorColumn: column }),

  setOutline: (outline) => set({ outline }),

  setFileTreeRoot: (root) => set({ fileTreeRoot: root }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  updateStats: () => {
    const content = get().content;
    const charCount = content.length;
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    set({ charCount, wordCount });
  },
}));
