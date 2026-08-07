import { beforeEach, describe, expect, it, vi } from "vitest";
import { rebuildMenu } from "./menu";

const { emitEventMock, menuItemNewMock } = vi.hoisted(() => ({
  emitEventMock: vi.fn(),
  menuItemNewMock: vi.fn(async (options) => options),
}));

vi.mock("@tauri-apps/api/event", () => ({ emit: emitEventMock }));
vi.mock("@tauri-apps/api/menu", () => ({
  MenuItem: { new: menuItemNewMock },
  Submenu: { new: vi.fn(async (options) => options) },
  Menu: { new: vi.fn(async () => ({ setAsAppMenu: vi.fn() })) },
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({ close: vi.fn() })),
}));

describe("rebuildMenu", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forwards clipboard menu actions through the channel observed by App", async () => {
    await rebuildMenu();

    for (const id of ["cut", "copy", "paste"]) {
      const options = menuItemNewMock.mock.calls.find(([item]) => item.id === id)?.[0];
      expect(options).toBeDefined();
      await options.action();
      expect(emitEventMock).toHaveBeenCalledWith("menu-event", id);
    }
  });
});
