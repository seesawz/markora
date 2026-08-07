import { Menu, MenuItem, Submenu } from "@tauri-apps/api/menu";
import { emit as emitEvent } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEditorStore } from "../store/editorStore";

// ponytail: JS 单点管理原生菜单；设置页语言变化时整体重建
export async function rebuildMenu() {
  const lang = useEditorStore.getState().lang;
  const zh = lang === "zh";

  const emit = (id: string) => async () => {
    await emitEvent("menu-event", id);
  };

  const L = (z: string, e: string) => (zh ? z : e);

  const fileMenu = await Submenu.new({
    text: L("文件", "File"),
    items: [
      await MenuItem.new({ id: "new_file", text: L("新建文件", "New File"), accelerator: "CmdOrCtrl+N", action: emit("new_file") }),
      await MenuItem.new({ id: "open_file", text: L("打开文件…", "Open File…"), accelerator: "CmdOrCtrl+O", action: emit("open_file") }),
      await MenuItem.new({ id: "open_folder", text: L("打开文件夹…", "Open Folder…"), accelerator: "CmdOrCtrl+Shift+O", action: emit("open_folder") }),
      await MenuItem.new({ text: "-" }),
      await MenuItem.new({ id: "save", text: L("保存", "Save"), accelerator: "CmdOrCtrl+S", action: emit("save") }),
      await MenuItem.new({ id: "save_as", text: L("另存为…", "Save As…"), accelerator: "CmdOrCtrl+Shift+S", action: emit("save_as") }),
      await MenuItem.new({ text: "-" }),
      await MenuItem.new({ id: "close_tab", text: L("关闭标签", "Close Tab"), accelerator: "CmdOrCtrl+W", action: emit("close_tab") }),
      await MenuItem.new({ text: "-" }),
      await MenuItem.new({ id: "export_html", text: L("导出 HTML…", "Export HTML…"), action: emit("export_html") }),
    ],
  });

  const editMenu = await Submenu.new({
    text: L("编辑", "Edit"),
    items: [
      await MenuItem.new({ id: "undo", text: L("撤销", "Undo"), accelerator: "CmdOrCtrl+Z", action: emit("undo") }),
      await MenuItem.new({ id: "redo", text: L("重做", "Redo"), accelerator: "CmdOrCtrl+Shift+Z", action: emit("redo") }),
      await MenuItem.new({ text: "-" }),
      await MenuItem.new({ id: "cut", text: L("剪切", "Cut"), accelerator: "CmdOrCtrl+X", action: emit("cut") }),
      await MenuItem.new({ id: "copy", text: L("复制", "Copy"), accelerator: "CmdOrCtrl+C", action: emit("copy") }),
      await MenuItem.new({ id: "paste", text: L("粘贴", "Paste"), accelerator: "CmdOrCtrl+V", action: emit("paste") }),
      await MenuItem.new({ id: "select_all", text: L("全选", "Select All"), accelerator: "CmdOrCtrl+A", action: emit("select_all") }),
    ],
  });

  const viewMenu = await Submenu.new({
    text: L("视图", "View"),
    items: [
      await MenuItem.new({ id: "toggle_theme", text: L("切换主题", "Toggle Theme"), accelerator: "CmdOrCtrl+Shift+T", action: emit("toggle_theme") }),
      await MenuItem.new({ id: "toggle_focus", text: L("专注模式", "Focus Mode"), accelerator: "CmdOrCtrl+Shift+F", action: emit("toggle_focus") }),
    ],
  });

  const settingsMenu = await Submenu.new({
    text: L("设置", "Settings"),
    items: [
      await MenuItem.new({ id: "ai_command", text: L("AI 指令", "AI Command"), accelerator: "CmdOrCtrl+Shift+P", action: emit("ai_command") }),
      await MenuItem.new({ id: "open_settings", text: L("设置…", "Settings…"), accelerator: "CmdOrCtrl+,", action: emit("open_settings") }),
    ],
  });

  const appMenu = await Submenu.new({
    text: "Markora",
    items: [
      await MenuItem.new({ id: "quit", text: L("退出 Markora", "Quit Markora"), accelerator: "CmdOrCtrl+Q", action: async () => {
        await getCurrentWindow().close();
      } }),
    ],
  });

  const menu = await Menu.new({ items: [appMenu, fileMenu, editMenu, viewMenu, settingsMenu] });
  await menu.setAsAppMenu();
}
