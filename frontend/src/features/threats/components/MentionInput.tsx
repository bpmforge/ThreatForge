"use client";

/**
 * MentionInput — Textarea with @mention autocomplete for threat comments.
 */
import { useRef, useState, useCallback, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { MentionableMember } from "../hooks/useMentionableMembers";

export interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  members: MentionableMember[];
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  "aria-label"?: string;
}

function getActiveMention(
  text: string,
  caret: number,
): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const atIndex = before.lastIndexOf("@");
  if (atIndex === -1) return null;
  const fragment = before.slice(atIndex + 1);
  if (fragment.includes("@")) return null;
  return { query: fragment, start: atIndex };
}

export function MentionInput({
  value,
  onChange,
  members,
  placeholder,
  className,
  onKeyDown,
  "aria-label": ariaLabel,
}: MentionInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [active, setActive] = useState<{ query: string; start: number } | null>(
    null,
  );
  const [hi, setHi] = useState(0);

  const filtered = active
    ? members.filter((m) =>
        m.name.toLowerCase().startsWith(active.query.toLowerCase()),
      )
    : [];

  const insert = useCallback(
    (member: MentionableMember) => {
      if (!active) return;
      const caret = ref.current?.selectionStart ?? value.length;
      const before = value.slice(0, active.start);
      const inserted = `@${member.name} `;
      onChange(before + inserted + value.slice(caret));
      setActive(null);
      setHi(0);
      requestAnimationFrame(() => {
        const pos = before.length + inserted.length;
        ref.current?.setSelectionRange(pos, pos);
        ref.current?.focus();
      });
    },
    [active, value, onChange],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setActive(
      getActiveMention(
        e.target.value,
        e.target.selectionStart ?? e.target.value.length,
      ),
    );
    setHi(0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (active && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHi((h) => (h + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHi((h) => (h - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        insert(filtered[hi]);
        return;
      }
      if (e.key === "Escape") {
        setActive(null);
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        aria-label={ariaLabel}
        aria-autocomplete={active ? "list" : undefined}
        aria-expanded={active !== null && filtered.length > 0}
      />
      {active && filtered.length > 0 && (
        <ul
          role="listbox"
          aria-label="Mention suggestions"
          className="absolute z-50 mt-1 max-h-48 w-64 overflow-y-auto rounded-md border bg-popover shadow-md"
        >
          {filtered.map((member, idx) => (
            <li
              key={member.id}
              role="option"
              aria-selected={idx === hi}
              className={`cursor-pointer px-3 py-2 text-xs ${idx === hi ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"}`}
              onMouseDown={(e) => {
                e.preventDefault();
                insert(member);
              }}
              onMouseEnter={() => setHi(idx)}
            >
              <span className="font-medium">{member.name}</span>
              <span className="ml-2 text-muted-foreground">{member.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
