// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiCommandModal } from "./AiCommandModal";

describe("AiCommandModal", () => {
  afterEach(cleanup);

  it("submits the instruction with Enter", () => {
    const onSubmit = vi.fn();

    render(<AiCommandModal open onClose={vi.fn()} onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox", { name: "AI 指令" });
    fireEvent.change(input, { target: { value: "写一个标题" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSubmit).toHaveBeenCalledWith("写一个标题");
  });

  it("closes on Escape without submitting", () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    render(<AiCommandModal open onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "AI 指令" }), { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not render when closed", () => {
    render(<AiCommandModal open={false} onClose={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.queryByRole("textbox", { name: "AI 指令" })).toBeNull();
  });
});
