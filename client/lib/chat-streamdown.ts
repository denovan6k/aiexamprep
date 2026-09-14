import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";

/** Inline `$...$` and display `$$...$$` / `\[...\]` for study chat. */
export const chatMathPlugin = createMathPlugin({
  singleDollarTextMath: true
});

export const chatStreamdownPlugins = {
  cjk,
  code,
  math: chatMathPlugin,
  mermaid
};
