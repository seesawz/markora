# Markora

A minimalist Markdown editor built with Tauri + React. Inspired by Typora, refined with modern design.

## Features

- **Clean, distraction-free writing** - Kimi-inspired minimal UI
- **Source & Preview modes** - Toggle between markdown source and rendered preview
- **File tree sidebar** - Browse, create, and open files
- **Outline panel** - Navigate by headings
- **In-document search** - Find and highlight matches
- **Light/Dark theme** - One-click theme toggle
- **macOS native feel** - Traffic light integration, draggable titlebar
- **Syntax highlighting** - CodeMirror 6 with 60+ languages

## Tech Stack

- **Tauri 2** - Lightweight desktop framework (Rust backend)
- **React 19 + TypeScript** - Frontend
- **CodeMirror 6** - Editor engine
- **markdown-it** - Markdown rendering
- **Tailwind CSS 4** - Styling
- **lucide-react** - Icons
- **Zustand** - State management

## Getting Started

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd + S` | Save file |
| `Cmd + \` | Toggle sidebar |
| `Cmd + /` | Toggle source/preview |
| `Cmd + B` | Bold |
| `Cmd + I` | Italic |

## License

MIT
