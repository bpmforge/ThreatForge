"use client";

import { useRef } from "react";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RICH_LABEL_MAX_LENGTH } from "@/lib/rich-label";

interface RichLabelEditorProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Markdown-subset editor for `richLabel`: a textarea with a formatting toolbar.
 * Stores plain text; rendering is done by RichLabel (no HTML involved).
 */
export function RichLabelEditor({ value, onChange }: RichLabelEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const apply = (fn: (sel: string) => string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    onChange(value.slice(0, a) + fn(value.slice(a, b)) + value.slice(b));
    el.focus();
  };
  const wrap = (mark: string) => () =>
    apply((s) => `${mark}${s || "text"}${mark}`);
  const prefixLines = (prefix: (i: number) => string) => () =>
    apply((s) =>
      (s || "item")
        .split("\n")
        .map((l, i) => prefix(i) + l)
        .join("\n"),
    );

  return (
    <div className="space-y-1">
      <Label htmlFor="rich-label" className="text-xs">
        Rich label
      </Label>
      <div className="flex gap-1" role="toolbar" aria-label="Label formatting">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-6 w-6"
          aria-label="Bold"
          onClick={wrap("**")}
        >
          <Bold className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-6 w-6"
          aria-label="Italic"
          onClick={wrap("*")}
        >
          <Italic className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-6 w-6"
          aria-label="Bullet list"
          onClick={prefixLines(() => "- ")}
        >
          <List className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-6 w-6"
          aria-label="Numbered list"
          onClick={prefixLines((i) => `${i + 1}. `)}
        >
          <ListOrdered className="h-3 w-3" />
        </Button>
      </div>
      <textarea
        id="rich-label"
        ref={ref}
        value={value}
        maxLength={RICH_LABEL_MAX_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        placeholder="**Bold**, *italic*, - bullets, 1. numbered"
        className="w-full min-h-[60px] text-xs rounded-md border border-input bg-background px-2 py-1.5 resize-y"
        rows={3}
      />
    </div>
  );
}
