"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ExternalSourceCardProps {
  name: string;
  description: string;
  count: number;
  url: string;
  color: string;
}

export function ExternalSourceCard({
  name,
  description,
  count,
  url,
  color,
}: ExternalSourceCardProps) {
  return (
    <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="font-medium text-sm">{name}</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {count}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{description}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
      >
        Learn more <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
