import { useMemo, useEffect, useRef } from "react";
import { useEditorStore } from "../store/editorStore";
import { renderMarkdown } from "../lib/markdown";

export function MarkdownPreview() {
  const { content } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => renderMarkdown(content), [content]);

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
