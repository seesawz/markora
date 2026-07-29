import { useMemo, useEffect, useRef } from "react";
import MarkdownIt from "markdown-it";
import { useEditorStore } from "../store/editorStore";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
});

// Render task list checkboxes
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

export function MarkdownPreview() {
  const { content } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => {
    // Process task lists
    let processed = content.replace(
      /^(- \[([ xX])\])/gm,
      (_match, _prefix, check) => {
        const checked = check === "x" || check === "X";
        return `- <input type="checkbox" ${checked ? "checked" : ""} disabled> `;
      }
    );

    const rendered = md.render(processed);

    // Add task-list-item class
    return rendered.replace(
      /<li>(<input type="checkbox"[^>]*>)/g,
      '<li class="task-list-item">$1'
    );
  }, [content]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [content]);

  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: "var(--typora-bg)" }}>
      <div
        ref={containerRef}
        className="typora-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
