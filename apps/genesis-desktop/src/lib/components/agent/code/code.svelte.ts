import { Context } from "runed";
import type { CodeRootProps } from "./types";
import { highlighter } from "./shiki";
import createDOMPurify from "dompurify";
import type { HighlighterCore } from "shiki";

type CodeOverflowStateProps = {
  collapsed: {
    current: boolean;
  };
};

const DOMPurify = typeof window !== "undefined" ? createDOMPurify(window) : null;

type CodeRootStateProps = {
  code: { current: string };
  lang: { current: NonNullable<CodeRootProps["lang"]> };
  hideLines: { current: boolean };
  highlight: { current: CodeRootProps["highlight"] };
};

class CodeOverflowState {
  constructor(readonly opts: CodeOverflowStateProps) {
    this.toggleCollapsed = this.toggleCollapsed.bind(this);
  }

  toggleCollapsed() {
    this.opts.collapsed.current = !this.opts.collapsed.current;
  }

  get collapsed() {
    return this.opts.collapsed.current;
  }
}

class CodeRootState {
  highlighter: HighlighterCore | null = $state(null);

  constructor(
    readonly opts: CodeRootStateProps,
    readonly overflow?: CodeOverflowState,
  ) {
    highlighter.then((hl) => (this.highlighter = hl));
  }

  highlight(code: string) {
    return this.highlighter?.codeToHtml(code, {
      lang: this.opts.lang.current,
      themes: {
        light: "github-light-default",
        dark: "github-dark-default",
      },
      transformers: [
        {
          pre: (el) => {
            el.properties.style = "";

            if (!this.opts.hideLines.current) {
              el.properties.class += " line-numbers";
            }

            return el;
          },
          line: (node, line) => {
            if (within(line, this.opts.highlight.current)) {
              node.properties.class = node.properties.class + " line--highlighted";
            }

            return node;
          },
        },
      ],
    });
  }

  get code() {
    return this.opts.code.current;
  }

  highlighted = $derived.by(() => {
    const html = this.highlight(this.code) ?? "";

    if (DOMPurify) {
      return DOMPurify.sanitize(html);
    }

    return html;
  });
}

function within(num: number, range: CodeRootProps["highlight"]) {
  if (!range) return false;

  let within = false;

  for (const r of range) {
    if (typeof r === "number") {
      if (num === r) {
        within = true;
        break;
      }
      continue;
    }

    if (r[0] <= num && num <= r[1]) {
      within = true;
      break;
    }
  }

  return within;
}

class CodeCopyButtonState {
  constructor(readonly root: CodeRootState) {}

  get code() {
    return this.root.opts.code.current;
  }
}

const overflowCtx = new Context<CodeOverflowState>("code-overflow-state");
const ctx = new Context<CodeRootState>("code-root-state");

export function useCodeOverflow(props: CodeOverflowStateProps) {
  return overflowCtx.set(new CodeOverflowState(props));
}

export function useCode(props: CodeRootStateProps) {
  return ctx.set(new CodeRootState(props, overflowCtx.getOr(undefined)));
}

export function useCodeCopyButton() {
  return new CodeCopyButtonState(ctx.get());
}
