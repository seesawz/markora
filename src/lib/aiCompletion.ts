import { Prec, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, keymap } from "@codemirror/view";

interface GhostValue {
  from: number;
  text: string;
}

const setGhostEffect = StateEffect.define<GhostValue | null>();

class GhostTextWidget extends WidgetType {
  constructor(private readonly text: string) {
    super();
  }

  toDOM(): HTMLElement {
    const element = document.createElement("span");
    element.className = "cm-ai-ghost";
    element.textContent = this.text;
    element.setAttribute("aria-hidden", "true");
    return element;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const ghostField = StateField.define<GhostValue | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setGhostEffect)) return effect.value;
    }
    return transaction.docChanged ? null : value;
  },
  provide: (field) => EditorView.decorations.from(field, (value) => {
    if (!value) return Decoration.none;
    return Decoration.set([
      Decoration.widget({ widget: new GhostTextWidget(value.text), side: 1 }).range(value.from),
    ]);
  }),
});

export function aiGhostTextExtension() {
  return [
    ghostField,
    Prec.high(keymap.of([
      {
        key: "Tab",
        run: (view: EditorView) => acceptAiGhost(view),
      },
      {
        key: "Escape",
        run: (view: EditorView) => clearAiGhost(view),
      },
    ])),
  ];
}

export function showAiGhost(view: EditorView, from: number, text: string): void {
  if (!text) return;
  view.dispatch({ effects: setGhostEffect.of({ from, text }) });
}

export function clearAiGhost(view: EditorView): boolean {
  const ghost = view.state.field(ghostField, false);
  if (!ghost) return false;
  view.dispatch({ effects: setGhostEffect.of(null) });
  return true;
}

function acceptAiGhost(view: EditorView): boolean {
  const ghost = view.state.field(ghostField, false);
  if (!ghost) return false;
  view.dispatch({
    changes: { from: ghost.from, insert: ghost.text },
    selection: { anchor: ghost.from + ghost.text.length },
    effects: setGhostEffect.of(null),
  });
  return true;
}
