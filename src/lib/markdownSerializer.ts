import MarkdownIt from "markdown-it";
import { type JSONContent } from "@tiptap/core";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  // 单换行解析为 <br>,保留原文行结构(否则多行被合并成一个段落,拖动选区跨不了行)
  breaks: true,
});

/**
 * Markdown 文本 → TipTap JSON 文档
 */
export function markdownToTiptap(markdown: string): JSONContent {
  const html = md.render(markdown);
  return htmlToTiptap(html);
}

/**
 * HTML → TipTap JSON（简化版，处理常见标签）
 */
function htmlToTiptap(html: string): JSONContent {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;

  function parseNode(node: Node): JSONContent | JSONContent[] | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (!text.trim()) return null;
      return { type: "text", text };
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    // 块级元素
    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
      const level = parseInt(tag[1]);
      const content = parseChildren(el);
      return {
        type: "heading",
        attrs: { level },
        content: content.length > 0 ? content : [{ type: "text", text: "" }],
      };
    }

    if (tag === "p") {
      const content = parseChildren(el);
      // 如果段落里有 hardBreak,拆成多个独立段落(每行一个),避免选区被限制在单一段落内
      const hasHardBreak = content.some((c) => c.type === "hardBreak");
      if (hasHardBreak) {
        const paragraphs: JSONContent[] = [];
        let current: JSONContent[] = [];
        for (const item of content) {
          if (item.type === "hardBreak") {
            if (current.length > 0) {
              paragraphs.push({ type: "paragraph", content: current });
            }
            current = [];
          } else {
            current.push(item);
          }
        }
        if (current.length > 0) {
          paragraphs.push({ type: "paragraph", content: current });
        }
        return paragraphs;
      }
      return {
        type: "paragraph",
        content: content.length > 0 ? content : [{ type: "text", text: "" }],
      };
    }

    if (tag === "blockquote") {
      const content = parseChildren(el);
      return {
        type: "blockquote",
        content: content.length > 0 ? content : [{ type: "paragraph" }],
      };
    }

    if (tag === "ul") {
      const items = Array.from(el.querySelectorAll(":scope > li")).map((li) => ({
        type: "listItem",
        content: parseListItemChildren(li),
      }));
      return { type: "bulletList", content: items };
    }

    if (tag === "ol") {
      const items = Array.from(el.querySelectorAll(":scope > li")).map((li) => ({
        type: "listItem",
        content: parseListItemChildren(li),
      }));
      return { type: "orderedList", content: items };
    }

    if (tag === "pre") {
      const code = el.querySelector("code");
      const text = code?.textContent || el.textContent || "";
      const lang = code?.className.replace("language-", "") || "";
      return {
        type: "codeBlock",
        attrs: { language: lang || null },
        content: [{ type: "text", text }],
      };
    }

    if (tag === "hr") {
      return { type: "horizontalRule" };
    }

    // 行内元素
    if (tag === "strong" || tag === "b") {
      const content = parseChildren(el);
      return content.map((c) => ({
        ...c,
        marks: [...(c.marks || []), { type: "bold" }],
      }));
    }

    if (tag === "em" || tag === "i") {
      const content = parseChildren(el);
      return content.map((c) => ({
        ...c,
        marks: [...(c.marks || []), { type: "italic" }],
      }));
    }

    if (tag === "s" || tag === "del" || tag === "strike") {
      const content = parseChildren(el);
      return content.map((c) => ({
        ...c,
        marks: [...(c.marks || []), { type: "strike" }],
      }));
    }

    if (tag === "code" && el.parentElement?.tagName.toLowerCase() !== "pre") {
      const content = parseChildren(el);
      return content.map((c) => ({
        ...c,
        marks: [...(c.marks || []), { type: "code" }],
      }));
    }

    if (tag === "a") {
      const href = el.getAttribute("href") || "";
      const content = parseChildren(el);
      return content.map((c) => ({
        ...c,
        marks: [...(c.marks || []), { type: "link", attrs: { href } }],
      }));
    }

    if (tag === "img") {
      const src = el.getAttribute("src") || "";
      const alt = el.getAttribute("alt") || "";
      return {
        type: "image",
        attrs: { src, alt },
      };
    }

    if (tag === "br") {
      return { type: "hardBreak" };
    }

    // 默认递归处理子节点
    return parseChildren(el);
  }

  function parseChildren(el: Element): JSONContent[] {
    const result: JSONContent[] = [];
    for (const child of Array.from(el.childNodes)) {
      const parsed = parseNode(child);
      if (parsed) {
        if (Array.isArray(parsed)) {
          result.push(...parsed);
        } else {
          result.push(parsed);
        }
      }
    }
    return result;
  }

  function parseListItemChildren(el: Element): JSONContent[] {
    const content: JSONContent[] = [];
    let inline: JSONContent[] = [];

    const flushInline = () => {
      if (inline.length === 0) return;
      content.push({ type: "paragraph", content: inline });
      inline = [];
    };

    for (const child of parseChildren(el)) {
      if (child.type === "text" || child.type === "hardBreak") {
        inline.push(child);
      } else {
        flushInline();
        content.push(child);
      }
    }
    flushInline();

    if (content[0]?.type !== "paragraph") content.unshift({ type: "paragraph" });
    return content;
  }

  const content = parseChildren(body);
  return {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}

/**
 * TipTap JSON 文档 → Markdown 文本
 */
export function tiptapToMarkdown(doc: JSONContent): string {
  function serializeNode(node: JSONContent): string {
    const { type, attrs, content, marks, text } = node;

    if (type === "text") {
      let result = text || "";
      if (marks) {
        for (const mark of marks) {
          if (mark.type === "bold") result = `**${result}**`;
          if (mark.type === "italic") result = `*${result}*`;
          if (mark.type === "strike") result = `~~${result}~~`;
          if (mark.type === "code") result = `\`${result}\``;
          if (mark.type === "link") result = `[${result}](${mark.attrs?.href || ""})`;
        }
      }
      return result;
    }

    const children = (content || []).map(serializeNode).join("");

    switch (type) {
      case "doc":
        return children;
      case "paragraph":
        return `${children}\n\n`;
      case "heading": {
        const level = attrs?.level || 1;
        return `${"#".repeat(level)} ${children}\n\n`;
      }
      case "blockquote":
        return children
          .split("\n")
          .filter((l) => l.trim())
          .map((l) => `> ${l}`)
          .join("\n") + "\n\n";
      case "bulletList":
        return children;
      case "orderedList":
        return children;
      case "listItem":
        return `- ${children}\n`;
      case "codeBlock": {
        const lang = attrs?.language || "";
        return `\`\`\`${lang}\n${children}\n\`\`\`\n\n`;
      }
      case "horizontalRule":
        return "---\n\n";
      case "hardBreak":
        return "\n";
      case "image": {
        const src = attrs?.src || "";
        const alt = attrs?.alt || "";
        return `![${alt}](${src})`;
      }
      default:
        return children;
    }
  }

  return serializeNode(doc).replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
