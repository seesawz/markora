// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceStore } from "./workspaceStore";

describe("workspaceStore", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ root: null, tree: null, tabs: [], activeTabPath: null });
  });

  it("opens a tab and activates it", () => {
    useWorkspaceStore.getState().openTab("/a.md", "a.md");

    const state = useWorkspaceStore.getState();
    expect(state.tabs).toEqual([{ path: "/a.md", name: "a.md" }]);
    expect(state.activeTabPath).toBe("/a.md");
  });

  it("does not duplicate an already open tab", () => {
    useWorkspaceStore.getState().openTab("/a.md", "a.md");
    useWorkspaceStore.getState().openTab("/b.md", "b.md");
    useWorkspaceStore.getState().openTab("/a.md", "a.md");

    expect(useWorkspaceStore.getState().tabs).toHaveLength(2);
    expect(useWorkspaceStore.getState().activeTabPath).toBe("/a.md");
  });

  it("closing an inactive tab keeps the active tab", () => {
    useWorkspaceStore.getState().openTab("/a.md", "a.md");
    useWorkspaceStore.getState().openTab("/b.md", "b.md");
    useWorkspaceStore.getState().setActiveTab("/a.md");

    const nextActive = useWorkspaceStore.getState().closeTab("/b.md");

    expect(nextActive).toBe("/a.md");
    expect(useWorkspaceStore.getState().tabs).toEqual([{ path: "/a.md", name: "a.md" }]);
    expect(useWorkspaceStore.getState().activeTabPath).toBe("/a.md");
  });

  it("closing the active tab activates the right neighbor, else the left", () => {
    useWorkspaceStore.getState().openTab("/a.md", "a.md");
    useWorkspaceStore.getState().openTab("/b.md", "b.md");
    useWorkspaceStore.getState().openTab("/c.md", "c.md");

    // 关闭中间激活的 b → 激活右侧 c
    useWorkspaceStore.getState().setActiveTab("/b.md");
    expect(useWorkspaceStore.getState().closeTab("/b.md")).toBe("/c.md");

    // 关闭最后一个 c → 左侧 a
    expect(useWorkspaceStore.getState().closeTab("/c.md")).toBe("/a.md");
  });

  it("closing the last tab returns null and clears the active tab", () => {
    useWorkspaceStore.getState().openTab("/a.md", "a.md");

    const nextActive = useWorkspaceStore.getState().closeTab("/a.md");

    expect(nextActive).toBeNull();
    expect(useWorkspaceStore.getState().tabs).toHaveLength(0);
    expect(useWorkspaceStore.getState().activeTabPath).toBeNull();
  });
});
