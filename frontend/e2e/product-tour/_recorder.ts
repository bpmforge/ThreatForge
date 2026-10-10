/**
 * Tour Recorder — shared helper for building Scribe-style product tours.
 *
 * Every tour spec uses this to get consistent styling, annotation, screenshot
 * paths, and automatic markdown generation. One source of truth for how a
 * tour looks and feels.
 *
 * Usage:
 *   const tour = new TourRecorder({
 *     slug: '01-getting-started',
 *     title: 'Getting Started',
 *     subtitle: 'Log in, create your first threat model, and open the canvas.',
 *   });
 *   await tour.step(page, {
 *     caption: 'Navigate to the login page at threatforge.bpmforge.local.',
 *     action: async () => { await page.goto('/login'); },
 *     highlight: 'input[type="email"]',
 *   });
 *   await tour.finalize();
 */

import type { Page, Locator } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

export interface TourOptions {
  /** URL slug used for directory + filename, e.g. "01-getting-started" */
  slug: string;
  /** Human-readable title shown at top of the markdown doc */
  title: string;
  /** One-sentence description shown under the title */
  subtitle: string;
  /** Optional: target audience note shown in a callout */
  audience?: string;
}

export interface StepOptions {
  /** Sentence or two shown above the screenshot in the markdown */
  caption: string;
  /** Any code to run BEFORE taking the screenshot (click, type, navigate) */
  action?: () => Promise<void>;
  /** CSS selector or Locator to highlight with a red box + optional arrow */
  highlight?: string | Locator;
  /** Wait for this selector to appear before screenshotting */
  waitFor?: string;
  /** Wait this many ms for animations/transitions to settle (default 500) */
  settleMs?: number;
  /** Take a full-page screenshot instead of viewport (default false) */
  fullPage?: boolean;
  /** Clip screenshot to a specific region instead of full viewport */
  clip?: { x: number; y: number; width: number; height: number };
}

const REPO_ROOT = path.resolve(__dirname, "../../..");
const DOCS_DIR = path.join(REPO_ROOT, "docs", "product-tour");
const SCREENSHOTS_DIR = path.join(DOCS_DIR, "screenshots");

export class TourRecorder {
  private steps: Array<{ n: number; caption: string; imgPath: string }> = [];
  private counter = 0;
  private shotDir: string;

  constructor(private opts: TourOptions) {
    this.shotDir = path.join(SCREENSHOTS_DIR, opts.slug);
    if (!fs.existsSync(this.shotDir)) {
      fs.mkdirSync(this.shotDir, { recursive: true });
    }
    // Clear previous run's screenshots so the directory always reflects the latest tour
    for (const f of fs.readdirSync(this.shotDir)) {
      if (f.endsWith(".png")) fs.unlinkSync(path.join(this.shotDir, f));
    }
  }

  /**
   * Record one step: run an action, settle, highlight, screenshot, append to markdown.
   */
  async step(page: Page, opts: StepOptions): Promise<void> {
    this.counter += 1;
    const n = String(this.counter).padStart(2, "0");

    if (opts.action) {
      await opts.action();
    }

    if (opts.waitFor) {
      await page.waitForSelector(opts.waitFor, {
        state: "visible",
        timeout: 30000,
      });
    }

    // Let animations, spinners, network idle, etc.
    await page.waitForTimeout(opts.settleMs ?? 500);

    // Apply highlight annotation before screenshot
    if (opts.highlight) {
      await this.applyHighlight(page, opts.highlight);
    }

    const fileName = `${n}.png`;
    const imgPath = path.join(this.shotDir, fileName);
    await page.screenshot({
      path: imgPath,
      fullPage: opts.fullPage ?? false,
      clip: opts.clip,
      animations: "disabled",
    });

    // Remove highlight so it doesn't bleed into the next step
    if (opts.highlight) {
      await this.clearHighlight(page);
    }

    this.steps.push({
      n: this.counter,
      caption: opts.caption,
      imgPath: path.relative(DOCS_DIR, imgPath).split(path.sep).join("/"),
    });
  }

  /**
   * Draw a red box + glow around the target element. Resolves the target
   * through Playwright's locator engine so any selector type works
   * (CSS, `:has-text()`, `role=...`, or a Locator object). Then reads the
   * bounding box and injects a DOM overlay at those coordinates so the
   * annotation appears in the screenshot without modifying app styles.
   */
  private async applyHighlight(
    page: Page,
    target: string | Locator,
  ): Promise<void> {
    try {
      const locator =
        typeof target === "string"
          ? page.locator(target).first()
          : target.first();

      // Ensure the element is visible + in viewport
      await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});

      const box = await locator.boundingBox();
      if (!box) return; // Element not found or offscreen

      await page.evaluate(
        ({ x, y, w, h }) => {
          const overlay = document.createElement("div");
          overlay.id = "__tour_highlight__";
          overlay.style.cssText = `
            position: fixed;
            top: ${y - 6}px;
            left: ${x - 6}px;
            width: ${w + 12}px;
            height: ${h + 12}px;
            border: 3px solid #EF4444;
            border-radius: 6px;
            box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25), 0 0 16px rgba(239, 68, 68, 0.6);
            pointer-events: none;
            z-index: 2147483647;
          `;
          document.body.appendChild(overlay);
        },
        { x: box.x, y: box.y, w: box.width, h: box.height },
      );
      await page.waitForTimeout(150);
    } catch {
      // Silently ignore — screenshot still produced, just without highlight
    }
  }

  private async clearHighlight(page: Page): Promise<void> {
    await page
      .evaluate(() => {
        document.getElementById("__tour_highlight__")?.remove();
        document.querySelectorAll("[data-tour-highlight]").forEach((el) => {
          delete (el as HTMLElement).dataset.tourHighlight;
        });
      })
      .catch(() => {});
  }

  /**
   * Write the final markdown document for this tour.
   */
  async finalize(): Promise<void> {
    const mdPath = path.join(DOCS_DIR, `${this.opts.slug}.md`);
    const lines: string[] = [];

    lines.push(`# ${this.opts.title}`);
    lines.push("");
    lines.push(`_${this.opts.subtitle}_`);
    lines.push("");

    if (this.opts.audience) {
      lines.push("> **For:** " + this.opts.audience);
      lines.push("");
    }

    lines.push("---");
    lines.push("");

    for (const step of this.steps) {
      lines.push(`### Step ${step.n}`);
      lines.push("");
      lines.push(step.caption);
      lines.push("");
      lines.push(`![Step ${step.n}](${step.imgPath})`);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
    lines.push(
      `_Tour generated automatically on ${new Date().toISOString().slice(0, 10)} by ThreatForge tour recorder._`,
    );
    lines.push("");

    fs.writeFileSync(mdPath, lines.join("\n"));
    console.log(
      `\n✓ Tour "${this.opts.title}" → ${path.relative(REPO_ROOT, mdPath)}`,
    );
    console.log(
      `  ${this.steps.length} steps, ${this.steps.length} screenshots`,
    );
  }
}

/**
 * Convenience for product-tour specs: sensible viewport + slow-mo for demo-like
 * cursor motion when running headed.
 */
export const TOUR_VIEWPORT = { width: 1440, height: 900 };
