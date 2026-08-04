# Repository Guidelines

## Project Structure & Module Organization

- `src/`: React 19 and TypeScript UI code. Components live in `src/components/`, shared operations and AI integration in `src/lib/`, and Zustand stores in `src/store/`.
- `src-tauri/`: Rust commands, native file operations, AI HTTP requests, secure key storage, and Tauri configuration.
- `public/`: static assets. `src/styles/` contains global and Typora-style CSS.
- Rust unit tests are colocated in `src-tauri/src/lib.rs`.

## Build, Test, and Development Commands

```bash
npm ci                 # Install the locked frontend dependencies
npm run dev            # Start the Vite frontend development server
npm run tauri dev     # Run the complete desktop app in development
npm run build          # Type-check and create the Vite production bundle
npm test               # Run the Vitest frontend unit tests
npm run tauri build   # Build Tauri application bundles
cargo fmt --all        # Format Rust code
cargo check            # Type-check the Tauri backend
cargo test             # Run Rust unit tests
```

Run Rust commands from `src-tauri/`. Use `npm run tauri dev` for native menus, dialogs, clipboard, or AI requests.

## Coding Style & Naming Conventions

Use two-space indentation in TypeScript/TSX, double quotes, semicolons, and existing formatting. Name React components in PascalCase, functions and variables in camelCase, and stores with a `Store` suffix (for example, `aiStore.ts`). Keep reusable editor behavior in `src/lib/` rather than duplicating it in components. Format Rust with `rustfmt`; follow Rust snake_case naming. Reuse existing CSS variables and Tailwind utilities. No frontend lint script is configured.

## Testing Guidelines

Every new or changed feature must include unit tests for React/TypeScript and Rust. If frontend test infrastructure is missing, add it with the feature; manual checks do not replace tests. Name Rust tests descriptively, such as `builds_provider_endpoints`. Run `npm test` and `cargo test` only immediately before compiling a release version; routine development and non-release builds do not require unit-test execution. Run `npm run build` after TypeScript or CSS changes.

## Commit & Pull Request Guidelines

Recent history uses prefixes such as `feat:`, `fix:`, and `release:`; follow that convention with concise Chinese subjects, for example `feat: 新增 AI 续写`. Pull requests should describe the user-visible change, list validation commands, link related issues when applicable, and include screenshots or a short recording for UI changes.

## Security & Configuration

Never commit API keys, local config files, or generated bundles. AI requests are implemented in Rust, and API keys should remain in the system keychain. Preserve the separation between frontend settings and native secret storage when adding providers or configuration fields.
