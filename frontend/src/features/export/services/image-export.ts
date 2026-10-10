/**
 * Image export services (PNG, SVG).
 */
import { toPng, toSvg } from "html-to-image";
import { downloadDataUrl, sanitizeFilename } from "./download";

/** Filter function to exclude React Flow controls from export */
const excludeControlsFilter = (node: Node | Element): boolean => {
  const excludeClasses = [
    "react-flow__controls",
    "react-flow__minimap",
    "react-flow__panel",
  ];
  if (node instanceof Element) {
    return !excludeClasses.some((cls) => node.classList.contains(cls));
  }
  return true;
};

/** Export canvas diagram to PNG image */
export async function exportToPNG(
  element: HTMLElement,
  modelName: string,
  scale: number = 2,
): Promise<void> {
  const dataUrl = await toPng(element, {
    backgroundColor: "#f9fafb",
    pixelRatio: scale,
    filter: excludeControlsFilter,
  });
  downloadDataUrl(dataUrl, `${sanitizeFilename(modelName)}.png`);
}

/** Export canvas diagram to SVG image */
export async function exportToSVG(
  element: HTMLElement,
  modelName: string,
): Promise<void> {
  const dataUrl = await toSvg(element, {
    backgroundColor: "#f9fafb",
    filter: excludeControlsFilter,
  });
  downloadDataUrl(dataUrl, `${sanitizeFilename(modelName)}.svg`);
}
