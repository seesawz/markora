import { create } from "zustand";

export type EditorMode = "source" | "preview";
export type SidebarTab = "files" | "outline" | "search";
export type Theme = "light" | "dark";

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
  setStatusBarVisible: (visible: boolean) => void;
  setCursor: (line: number, column: number) => void;
  setOutline: (outline: OutlineItem[]) => void;
  setFileTreeRoot: (root: string | null) => void;
  setSearchQuery: (query: string) => void;
  updateStats: () => void;
}

const DEFAULT_CONTENT = `# Welcome to Typora Clone

A **minimal** Markdown editor built with Tauri + React.

## Features

- Clean, distraction-free writing environment
- Live preview mode
- Source code mode with syntax highlighting
- File tree sidebar
- Outline navigation
- Dark mode support

## Quick Start

1. Open a folder from the sidebar
2. Create or open a Markdown file
3. Start writing!

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd + S | Save file |
| Cmd + N | New file |
| Cmd + O | Open folder |
| Cmd + / | Toggle source/preview |
| Cmd + B | Bold |
| Cmd + I | Italic |

> "The best way to predict the future is to invent it." — Alan Kay

\`\`\`javascript
function hello(name) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

- [x] Build the UI
- [x] Add markdown editing
- [ ] Add export features
- [ ] Add custom themes

---

Happy writing!
`;

export const useEditorStore = create<EditorState>((set, get) => ({
  currentFilePath: null,
  currentFileName: "Untitled.md",
  content: DEFAULT_CONTENT,
  isDirty: false,

  sidebarVisible: true,
  sidebarWidth: 260,
  sidebarTab: "files",
  editorMode: "source",
  theme: "light",
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
      ? path.split("/").pop() || "Untitled.md"
      : "Untitled.md";
    set({ currentFilePath: path, currentFileName: fileName, isDirty: false });
  },

  setDirty: (dirty) => set({ isDirty: dirty }),

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),

  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(180, Math.min(500, width)) }),

  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  setEditorMode: (mode) => set({ editorMode: mode }),

  toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
  setTheme: (theme) => set({ theme }),

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
