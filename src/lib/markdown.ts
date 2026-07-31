import MarkdownIt from "markdown-it";
import { convertFileSrc } from "@tauri-apps/api/core";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
});

md.core.ruler.after("inline", "task-list-checkbox", (state) => {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (
      tokens[i].type === "inline" &&
      tokens[i].content &&
      tokens[i + 1].type === "paragraph_close"
    ) {
      const content = tokens[i].content;
      if (/^\[[ xX]\]\s/.test(content)) {
        tokens[i].content = content.replace(/^\[[ xX]\]\s/, "");
      }
    }
  }
});

export function renderMarkdown(source: string): string {
  const processed = source.replace(
    /^(- \[([ xX])\])/gm,
    (_match, _prefix, check) => {
      const checked = check === "x" || check === "X";
      return `- <input type="checkbox" ${checked ? "checked" : ""} disabled> `;
    }
  );
  const rendered = md.render(processed);
  return rendered.replace(
    /<li>(<input type="checkbox"[^>]*>)/g,
    '<li class="task-list-item">$1'
  );
}

// 本地图片(绝对或相对路径)转 asset:// URL,webview/导出的 iframe 才能显示;http/data 不动
export function resolveLocalImages(html: string, currentFilePath: string | null): string {
  const docDir = currentFilePath
    ? currentFilePath.substring(0, currentFilePath.replace(/\\/g, "/").lastIndexOf("/"))
    : null;
  return html.replace(/(<img[^>]+src=")([^"]+)(")/g, (_m, pre, src, post) => {
    if (/^(https?:|data:|asset:)/i.test(src)) return `${pre}${src}${post}`;
    // markdown-it 已对中文/特殊字符 URL 编码一次,先解码回原始路径,避免 convertFileSrc 二次编码 404
    let decoded = src;
    try { decoded = decodeURIComponent(src); } catch { /* 含未编码字符时用原值 */ }
    const abs = decoded.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(decoded)
      ? decoded
      : docDir ? `${docDir}/${decoded}` : null;
    if (!abs) return `${pre}${src}${post}`;
    return `${pre}${convertFileSrc(abs)}${post}`;
  });
}
