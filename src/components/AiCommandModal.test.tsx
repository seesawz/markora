// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiCommandModal } from "./AiCommandModal";

describe("AiCommandModal", () => {
  afterEach(cleanup);

  const baseProps = {
    anchor: { x: 120, y: 240 },
    status: "idle" as const,
    error: null as string | null,
  };

  it("submits the instruction with Enter", () => {
    const onSubmit = vi.fn();

    render(<AiCommandModal open {...baseProps} onClose={vi.fn()} onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox", { name: "AI 指令" });
    fireEvent.change(input, { target: { value: "写一个标题" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSubmit).toHaveBeenCalledWith("写一个标题");
  });

  it("closes on Escape without submitting", () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    render(<AiCommandModal open {...baseProps} onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "AI 指令" }), { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not render when closed", () => {
    render(<AiCommandModal open={false} {...baseProps} onClose={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.queryByRole("textbox", { name: "AI 指令" })).toBeNull();
  });

  it("shows the error message and keeps the input editable", () => {
    render(
      <AiCommandModal
        open
        {...baseProps}
        status="error"
        error="AI 请求失败:401"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("AI 请求失败:401")).toBeTruthy();
    const input = screen.getByRole("textbox", { name: "AI 指令" }) as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });

  it("disables the input while generating", () => {
    render(
      <AiCommandModal
        open
        {...baseProps}
        status="generating"
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const input = screen.getByRole("textbox", { name: "AI 指令" }) as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
