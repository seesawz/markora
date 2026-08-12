import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface SearchMatch {
  from: number;
  to: number;
}

const searchHighlightKey = new PluginKey<DecorationSet>("searchHighlight");

export const SearchHighlight = Extension.create({
  name: "searchHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(transaction, decorations) {
            const next = transaction.getMeta(searchHighlightKey) as DecorationSet | undefined;
            return next ?? decorations.map(transaction.mapping, transaction.doc);
          },
        },
        props: {
          decorations: (state) => searchHighlightKey.getState(state),
        },
      }),
    ];
  },
});

export function setSearchHighlights(editor: Editor, matches: SearchMatch[], currentIndex: number): void {
  const decorations = matches.map((match, index) =>
    Decoration.inline(match.from, match.to, {
      class: index === currentIndex ? "search-match search-match-current" : "search-match",
    })
  );
  editor.view.dispatch(editor.state.tr.setMeta(searchHighlightKey, DecorationSet.create(editor.state.doc, decorations)));
}
