import { create } from "zustand";

export type Theme = "light" | "dark";
export type Lang = "zh" | "en";

interface EditorState {
  // File state
  currentFilePath: string | null;
  currentFileName: string;
  content: string;
  isDirty: boolean;

  // UI state
  theme: Theme;
  lang: Lang;
  focusMode: boolean;

  // Editor info
  cursorLine: number;
  cursorColumn: number;
  wordCount: number;
  charCount: number;

  // Actions
  setContent: (content: string) => void;
  setFilePath: (path: string | null) => void;
  setDirty: (dirty: boolean) => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setLang: (lang: Lang) => void;
  toggleFocusMode: () => void;
  setCursor: (line: number, column: number) => void;
  updateStats: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  currentFilePath: null,
  currentFileName: "未命名.md",
  content: "",
  isDirty: false,

  theme: "light",
  lang: "zh",
  focusMode: false,

  cursorLine: 1,
  cursorColumn: 1,
  wordCount: 0,
  charCount: 0,

  setContent: (content) => {
    set({ content, isDirty: true });
    get().updateStats();
  },

  setFilePath: (path) => {
    const fileName = path
      ? path.split(/[\\/]/).pop() || "未命名.md"
      : "未命名.md";
    set({ currentFilePath: path, currentFileName: fileName, isDirty: false });
  },

  setDirty: (dirty) => set({ isDirty: dirty }),

  toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
  setTheme: (theme) => set({ theme }),

  setLang: (lang) => set({ lang }),

  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

  setCursor: (line, column) => set({ cursorLine: line, cursorColumn: column }),

  updateStats: () => {
    const content = get().content;
    const charCount = content.length;
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    set({ charCount, wordCount });
  },
}));
