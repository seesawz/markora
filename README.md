# Markora

一款专注写作的本地优先 Markdown 桌面编辑器。Markora 使用 Tauri 2、React 和 CodeMirror 构建，提供接近 Typora 的 Markdown 输入体验，同时保留 Markdown 文件的可读性与可移植性。

[English](#english)

## 中文

### 特性

- **Typora 式编辑体验**：标题、粗体、斜体、删除线、行内代码等格式在编辑时直接呈现样式，减少 Markdown 标记干扰。
- **自然的格式删除**：删除格式化内容时先删除文字，最后再删除 Markdown 标记。
- **Markdown 编辑器能力**：CodeMirror 6 驱动，支持语法高亮、括号匹配、自动闭合、自动缩进、换行和多种代码语言高亮。
- **文件操作完整**：新建、打开、保存、另存为和导出 HTML；支持 `.md` 与 `.markdown` 文件。
- **系统集成**：支持文件关联、从系统打开 Markdown 文件、拖拽文件到窗口，以及恢复上次打开的文件。
- **图片粘贴**：直接粘贴剪贴板图片，自动保存到文档对应的 `.assets` 目录并插入 Markdown 图片链接。
- **查找与替换**：支持查找、替换、全部替换和匹配项计数。
- **AI 续写与指令**：支持 OpenAI Compatible 和 Anthropic API，可在设置中配置模型，也可使用 AI 指令生成或替换选中内容。
- **明暗主题与专注模式**：提供浅色、深色主题，以及降低非当前行对比度的专注模式。
- **中英文界面**：设置界面和原生菜单支持简体中文与 English。

### 下载

从 [GitHub Releases](https://github.com/seesawz/markora/releases) 下载可用版本。发布页中的安装包以实际构建产物为准，覆盖 macOS、Windows 和 Linux 架构。

macOS 安装包目前使用自签名构建。如果 macOS 提示无法验证开发者，可以在 Finder 中右键点击 Markora，选择“打开”，然后确认打开；也可以前往“系统设置 → 隐私与安全性”允许启动应用。

### 快速开始

1. 启动 Markora，直接开始输入 Markdown。
2. 使用 `⌘/Ctrl + S` 保存文件。
3. 使用 `⌘/Ctrl + O` 打开已有的 `.md` 或 `.markdown` 文件。
4. 通过底部状态栏的 AI 图标启用或关闭 AI 续写。
5. 通过菜单栏或 `⌘/Ctrl + ,` 打开设置。

### 常用快捷键

快捷键中的 `⌘/Ctrl` 表示 macOS 使用 `⌘`，Windows/Linux 使用 `Ctrl`。

| 快捷键 | 功能 |
| --- | --- |
| `⌘/Ctrl + N` | 新建文件 |
| `⌘/Ctrl + O` | 打开文件 |
| `⌘/Ctrl + S` | 保存 |
| `⌘/Ctrl + Shift + S` | 另存为 |
| `⌘/Ctrl + Z` | 撤销 |
| `⌘/Ctrl + Shift + Z` | 重做 |
| `⌘/Ctrl + X` | 剪切 |
| `⌘/Ctrl + C` | 复制 |
| `⌘/Ctrl + V` | 粘贴文本或图片 |
| `⌘/Ctrl + A` | 全选 |
| `⌘/Ctrl + F` | 查找 |
| `⌘/Ctrl + H` | 查找并替换 |
| `⌘/Ctrl + B` | 加粗选中文本 |
| `⌘/Ctrl + I` | 斜体选中文本 |
| `⌘/Ctrl + K` | 插入链接 |
| `⌘/Ctrl + Shift + T` | 切换浅色/深色主题 |
| `⌘/Ctrl + Shift + F` | 切换专注模式 |
| `⌘/Ctrl + Shift + P` | 打开 AI 指令 |
| `⌘/Ctrl + ,` | 打开设置 |
| `Tab` | 插入两个空格缩进 |
| `Tab`（AI 建议可见时） | 接受 AI 续写建议 |

### AI 配置

打开“设置 → AI 续写”，填写以下信息：

- API 格式：`OpenAI Compatible` 或 `Anthropic`
- Base URL
- 模型名称
- API Key

保存前可以使用“测试连接”验证配置。API Key 会保存在应用的本地配置文件中；请勿在共享设备上留下不应公开的密钥。

AI 续写会在停止输入约 0.8 秒后生成建议，按 `Tab` 接受。使用 `⌘/Ctrl + Shift + P` 可以打开 AI 指令，让模型根据当前选区和文档上下文生成内容。

### 项目结构

```text
src/
├── components/       React UI、编辑器和设置组件
├── lib/              Markdown、AI、菜单和编辑操作
├── store/            Zustand 状态管理
└── styles/           全局样式和 Markdown 排版样式

src-tauri/
├── src/              Tauri Rust 命令、文件操作和 AI 请求
└── tauri.conf.json   桌面应用与打包配置
```

### 本地开发

环境要求：Node.js、npm 和 Rust stable。完整桌面开发还需要当前平台对应的 Tauri 构建依赖。

```bash
# 安装锁定版本的前端依赖
npm ci

# 仅启动 Vite 前端，默认端口为 1420
npm run dev

# 启动完整 Tauri 桌面应用（推荐）
npm run tauri dev
```

如果提示 `Port 1420 is already in use`，请先关闭占用该端口的旧开发进程，再重新运行 `npm run tauri dev`。

### 验证与构建

```bash
# 前端单元测试
npm test

# 类型检查并构建前端
npm run build

# 构建桌面应用安装包
npm run tauri build
```

Rust 命令请在 `src-tauri/` 目录执行：

```bash
cargo fmt --all
cargo check
cargo test
```

本地桌面构建产物位于 `src-tauri/target/release/bundle/`。推送 `v*` 标签后，GitHub Actions 会为 macOS（Apple Silicon/Intel）、Windows 和 Linux 构建安装包，并创建草稿 Release。

### 许可证

[MIT License](./LICENSE)

---

<a id="english"></a>

## English

### Features

- **Typora-like editing**: headings, bold, italic, strikethrough, inline code, and other formatting are rendered while you edit, keeping Markdown markers out of the way.
- **Natural formatting deletion**: deleting formatted content removes the text first and leaves the Markdown markers for last.
- **Markdown editor essentials**: powered by CodeMirror 6 with syntax highlighting, bracket matching, auto-closing, indentation, line wrapping, and highlighting for many code languages.
- **Complete file workflow**: create, open, save, save as, and export HTML; supports `.md` and `.markdown` files.
- **Desktop integration**: file associations, opening Markdown files from the operating system, drag-and-drop, and last-session file restoration.
- **Image paste**: paste an image from the clipboard; Markora saves it to the document's `.assets` directory and inserts the Markdown image link.
- **Find and replace**: find, replace, replace all, and match counts.
- **AI completion and commands**: supports OpenAI Compatible and Anthropic APIs, configurable models, inline completion, and instruction-based generation for the current selection or document context.
- **Light, dark, and focus modes**: switch themes or reduce the contrast of non-active lines for focused writing.
- **Bilingual interface**: switch the settings UI and native menus between Simplified Chinese and English.

### Download

Download an available build from [GitHub Releases](https://github.com/seesawz/markora/releases). Platform packages depend on the assets published for each release and currently target macOS, Windows, and Linux.

The macOS packages are currently self-signed. If macOS says that the developer cannot be verified, right-click Markora in Finder, choose “Open”, and confirm. You can also allow the app in “System Settings → Privacy & Security”.

### Quick start

1. Launch Markora and start writing Markdown.
2. Press `⌘/Ctrl + S` to save the document.
3. Press `⌘/Ctrl + O` to open an existing `.md` or `.markdown` file.
4. Use the AI icon in the status bar to enable or disable inline completion.
5. Open settings from the menu or with `⌘/Ctrl + ,`.

### Keyboard shortcuts

`⌘/Ctrl` means `⌘` on macOS and `Ctrl` on Windows/Linux.

| Shortcut | Action |
| --- | --- |
| `⌘/Ctrl + N` | New file |
| `⌘/Ctrl + O` | Open file |
| `⌘/Ctrl + S` | Save |
| `⌘/Ctrl + Shift + S` | Save as |
| `⌘/Ctrl + Z` | Undo |
| `⌘/Ctrl + Shift + Z` | Redo |
| `⌘/Ctrl + X` | Cut |
| `⌘/Ctrl + C` | Copy |
| `⌘/Ctrl + V` | Paste text or image |
| `⌘/Ctrl + A` | Select all |
| `⌘/Ctrl + F` | Find |
| `⌘/Ctrl + H` | Find and replace |
| `⌘/Ctrl + B` | Bold selection |
| `⌘/Ctrl + I` | Italicize selection |
| `⌘/Ctrl + K` | Insert link |
| `⌘/Ctrl + Shift + T` | Toggle light/dark theme |
| `⌘/Ctrl + Shift + F` | Toggle focus mode |
| `⌘/Ctrl + Shift + P` | Open AI command |
| `⌘/Ctrl + ,` | Open settings |
| `Tab` | Insert two-space indentation |
| `Tab` while an AI suggestion is visible | Accept the AI completion |

### Configure AI

Open “Settings → AI Completion” and provide:

- API format: `OpenAI Compatible` or `Anthropic`
- Base URL
- Model name
- API Key

Use “Test connection” to validate the configuration before saving. The API Key is stored in the app's local configuration file; do not leave private keys on shared devices.

Inline completion appears about 0.8 seconds after you stop typing. Press `Tab` to accept it. Use `⌘/Ctrl + Shift + P` to ask the model to generate content from the current selection and document context.

### Project structure

```text
src/
├── components/       React UI, editor, and settings components
├── lib/              Markdown, AI, menu, and editor operations
├── store/            Zustand state management
└── styles/           Global and Markdown presentation styles

src-tauri/
├── src/              Tauri Rust commands, file operations, and AI requests
└── tauri.conf.json   Desktop application and bundling configuration
```

### Local development

Requirements: Node.js, npm, and Rust stable. Full desktop development also requires the Tauri build dependencies for your platform.

```bash
# Install the locked frontend dependencies
npm ci

# Start the Vite frontend only; default port is 1420
npm run dev

# Start the full Tauri desktop app (recommended)
npm run tauri dev
```

If you see `Port 1420 is already in use`, stop the old development process using that port and run `npm run tauri dev` again.

### Validation and builds

```bash
# Frontend unit tests
npm test

# Type-check and build the frontend
npm run build

# Build desktop application bundles
npm run tauri build
```

Run Rust commands from `src-tauri/`:

```bash
cargo fmt --all
cargo check
cargo test
```

Local desktop bundles are written to `src-tauri/target/release/bundle/`. Pushing a `v*` tag triggers GitHub Actions to build macOS (Apple Silicon/Intel), Windows, and Linux packages and create a draft Release.

### License

[MIT License](./LICENSE)
