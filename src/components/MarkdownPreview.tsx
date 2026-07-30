import { useMemo, useEffect, useRef } from "react";
import { useEditorStore } from "../store/editorStore";
import { renderMarkdown } from "../lib/markdown";
import { convertFileSrc } from "@tauri-apps/api/core";

export function MarkdownPreview() {
  const { content, currentFilePath } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => {
    const raw = renderMarkdown(content);
    // ponytail: 本地图片(绝对或相对路径)转 asset:// URL,webview 才能显示；http/data 不动
    const docDir = currentFilePath
      ? currentFilePath.substring(0, currentFilePath.lastIndexOf("/"))
      : null;
    return raw.replace(/(<img[^>]+src=")([^"]+)(")/g, (_m, pre, src, post) => {
      if (/^(https?:|data:|asset:)/i.test(src)) return `${pre}${src}${post}`;
      const abs = src.startsWith("/") ? src : docDir ? `${docDir}/${src}` : null;
      if (!abs) return `${pre}${src}${post}`;
      return `${pre}${convertFileSrc(abs)}${post}`;
    });
  }, [content, currentFilePath]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [content]);

  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: "var(--bg-primary)" }}>
      <div
        ref={containerRef}
        className="typora-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
