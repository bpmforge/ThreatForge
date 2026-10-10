import { Fragment, type CSSProperties, type ReactNode } from "react";
import { parseRichLabel, type InlineRun } from "@/lib/rich-label";

function Runs({ runs }: { runs: InlineRun[] }) {
  return (
    <>
      {runs.map((r, i) => {
        let el: ReactNode = r.text;
        if (r.italic) el = <em>{el}</em>;
        if (r.bold) el = <strong>{el}</strong>;
        return <Fragment key={i}>{el}</Fragment>;
      })}
    </>
  );
}

/** Renders a `richLabel` Markdown-subset string as React elements (never raw HTML). */
export function RichLabel({
  value,
  className,
  style,
}: {
  value: string;
  className?: string;
  style?: CSSProperties;
}) {
  const blocks = parseRichLabel(value);
  return (
    <div className={className} style={style} data-testid="rich-label">
      {blocks.map((b, i) => {
        if (b.kind === "p") {
          return (
            <p key={i} className="break-words">
              <Runs runs={b.runs} />
            </p>
          );
        }
        const List = b.kind === "ul" ? "ul" : "ol";
        return (
          <List
            key={i}
            className={`${b.kind === "ul" ? "list-disc" : "list-decimal"} pl-4`}
          >
            {b.items.map((it, j) => (
              <li key={j} className="break-words">
                <Runs runs={it} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
