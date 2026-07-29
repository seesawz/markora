import MarkdownIt from "markdown-it";

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
