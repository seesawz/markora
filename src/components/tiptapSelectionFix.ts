import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * 修复 TipTap 在混合节点类型下的光标/选区渲染问题
 * 使用 Decoration 绘制自定义选区背景,替代浏览器原生选区
 */
export const SelectionFix = Extension.create({
  name: "selectionFix",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("selectionFix"),
        props: {
          decorations(state) {
            const { selection } = state;
            const { from, to, empty } = selection;

            if (empty) {
              // 光标:在行首/行尾/节点边界时绘制自定义光标
              const $pos = state.doc.resolve(from);
              const parent = $pos.parent;

              // 只在特定节点类型下绘制自定义光标(避免重复)
              if (parent.type.name === "paragraph" || parent.type.name === "heading") {
                return DecorationSet.create(state.doc, [
                  Decoration.widget(from, () => {
                    const span = document.createElement("span");
                    span.className = "tiptap-cursor-fix";
                    return span;
                  }, { side: 0 }),
                ]);
              }
              return null;
            }

            // 选区:绘制背景色
            const decorations: Decoration[] = [];
            state.doc.nodesBetween(from, to, (node, pos) => {
              if (node.isText) {
                const start = Math.max(from, pos);
                const end = Math.min(to, pos + node.nodeSize);
                if (start < end) {
                  decorations.push(
                    Decoration.inline(start, end, {
                      class: "tiptap-selection-fix",
                    })
                  );
                }
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
