// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenu } from "./ContextMenu";

describe("ContextMenu", () => {
  afterEach(cleanup);

  it("moves focus with arrows and activates the focused item with Enter", () => {
    const onItemClick = vi.fn();
    render(
      <ContextMenu
        x={0}
        y={0}
        items={[{ id: "rename", label: "重命名" }, { id: "delete", label: "删除" }]}
        onItemClick={onItemClick}
        onClose={vi.fn()}
      />
    );

    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "重命名" }));
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "删除" }));
    fireEvent.keyDown(document.activeElement as Element, { key: "Enter" });
    expect(onItemClick).toHaveBeenCalledWith("delete");
  });
});
