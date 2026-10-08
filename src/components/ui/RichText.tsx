import { Fragment, type ReactNode } from "react";

/**
 * EN: Tiny markup used by the design copy and the content editor:
 *     *word* → <em> (italic, gold where the section styles it) · **word** → <strong> · line break → <br>.
 *     Only these three; everything else is plain text (no HTML injection possible).
 * PT: Marcação mínima usada nos textos do design e no editor de conteúdo:
 *     *palavra* → <em> · **palavra** → <strong> · quebra de linha → <br>. Nada mais: sem risco de HTML.
 */
export function RichText({ text }: { text: string }): ReactNode {
  return text.split("\n").map((line, lineIndex) => (
    <Fragment key={lineIndex}>
      {lineIndex > 0 && <br />}
      {line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </Fragment>
  ));
}
