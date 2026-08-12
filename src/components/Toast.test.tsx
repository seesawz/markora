// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Toast } from "./Toast";
import { showErrorToast } from "../lib/toast";

describe("Toast", () => {
  afterEach(cleanup);

  it("shows file operation errors without blocking the UI", () => {
    render(<Toast />);
    act(() => showErrorToast("刷新工作区", new Error("没有权限")));
    expect(screen.getByRole("alert").textContent).toContain("刷新工作区失败：没有权限");
  });
});
