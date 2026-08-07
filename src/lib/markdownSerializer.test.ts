// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { markdownToTiptap } from "./markdownSerializer";

describe("markdownToTiptap", () => {
  it("wraps formatted list text in paragraphs for character-level selection", () => {
    const doc = markdownToTiptap([
      "- **作为**医药代表，**我希望**查看任务摘要，**以便**优先处理事项。",
      "- **作为**医药代表，**我希望**保存草稿，**以便**断续填写。",
    ].join("\n"));

    const list = doc.content?.[0];
    expect(list?.type).toBe("bulletList");
    expect(list?.content).toHaveLength(2);
    for (const item of list?.content || []) {
      expect(item.type).toBe("listItem");
      expect(item.content?.[0]?.type).toBe("paragraph");
      expect(item.content?.[0]?.content?.some((node) => node.marks?.some((mark) => mark.type === "bold"))).toBe(true);
    }
  });
});
