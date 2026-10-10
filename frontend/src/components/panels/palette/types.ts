/**
 * Component Palette Types
 */

import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "@/types/canvas";

/** Palette item definition with Lucide icon */
export interface PaletteItem {
  type: ComponentType;
  label: string;
  Icon: LucideIcon;
  description: string;
  color?: string;
}

/** Category definition */
export interface Category {
  id: string;
  title: string;
  Icon: LucideIcon;
  color: string;
  items: PaletteItem[];
  defaultOpen?: boolean;
}
