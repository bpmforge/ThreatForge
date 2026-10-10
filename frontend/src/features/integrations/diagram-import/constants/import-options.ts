import { FileCode, FileSpreadsheet, Code } from "lucide-react";
import type { DiagramSource } from "../types";

export const IMPORT_OPTIONS: Array<{
  source: DiagramSource;
  label: string;
  icon: typeof FileCode;
  accept: string;
  description: string;
}> = [
  {
    source: "drawio",
    label: "Draw.io",
    icon: FileCode,
    accept: ".xml,.drawio",
    description: "XML files exported from Draw.io or diagrams.net",
  },
  {
    source: "mermaid",
    label: "Mermaid",
    icon: Code,
    accept: ".md,.mmd,.mermaid,.txt",
    description: "Mermaid flowchart, sequence, or C4 diagrams",
  },
  {
    source: "lucidchart",
    label: "Lucidchart",
    icon: FileSpreadsheet,
    accept: ".csv",
    description: "CSV export from Lucidchart",
  },
  {
    source: "threat-dragon",
    label: "Threat Dragon",
    icon: FileCode,
    accept: ".json",
    description: "OWASP Threat Dragon v1 or v2 JSON export",
  },
];
