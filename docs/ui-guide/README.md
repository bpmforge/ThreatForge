# Building UI like ThreatForge

A reference for agents and developers building screens in this product — or building a
similar app-shell UI from scratch.

It exists because of one specific, repeatable failure: **an expandable panel whose
content, once it needs to scroll, misaligns — overflowing its container, spilling under
the scrollbar, or getting clipped.** That bug has a precise cause and a precise fix, and
they are in §2. Read that before writing layout code.

Everything here was read out of this repo (file:line given throughout) or verified
against MDN/caniuse. Where the codebase is inconsistent, it says so — see §12, which
lists patterns you should **not** copy.

---

## 1. The contract — seven rules

If you only read one section, read this one.

1. **One element owns the height.** Exactly one ancestor sets a real height
   (`h-screen` / `h-dvh`) and `overflow-hidden`. Everything below is `flex-1`.
2. **`min-h-0` on every flex/grid link between that owner and the scroller** — not just
   the direct parent. One missing link and the whole shell grows.
3. **The scroller is the innermost box**, and it is the *only* thing with
   `overflow-y-auto`. Its parent has `overflow-hidden`.
4. **Pin chrome with `shrink-0`.** Headers, tab bars, toolbars, footers. Anything that
   must not compress.
5. **Never use `overflow-x-hidden` on a wrapper.** It silently makes the *vertical* axis
   a scroll container. Use `overflow-x-clip`. (§2.3 — this is probably your bug.)
6. **A panel dropped into a slot must self-size with `h-full`** and own its own scroller.
   The slot is a plain block, not a flex parent (§3.1).
7. **Use the tokens.** `bg-background`, `text-muted-foreground`, `border` — never raw
   hex, never `bg-gray-800`.

---

## 2. Why panels overflow — the actual mechanism

### 2.1 Flex items refuse to shrink below their content

Flex and grid items default to `min-height: auto` / `min-width: auto`, which resolves to
roughly their **min-content size**. Flexbox will *overflow its container* rather than
shrink a child below that. So a scroll container nested in flex layout grows to the full
height of its content, the clamp never engages, and the content spills.

Two escapes, per spec:

- `min-height: 0` (Tailwind `min-h-0`), or
- setting `overflow` to anything other than `visible` — a non-visible overflow makes the
  automatic minimum size `0` automatically.

**Grid equivalent:** `1fr` means `minmax(auto, 1fr)`, and that `auto` minimum is
content-based. Use `minmax(0, 1fr)`.

> **The nuance almost every guide gets wrong.** "Always add `min-h-0`" is folk wisdom.
> The truth: it only does anything when the flex item's computed `overflow` is `visible`.
> On a box that already has `overflow-hidden`, `min-h-0` is redundant (harmless, and
> arguably good self-documentation). On a box whose parent isn't a flex container, it's a
> no-op. Knowing which is which tells you where the bug can actually be — see §3.3.

### 2.2 The correct skeleton

```tsx
<div className="flex flex-col h-screen overflow-hidden">   {/* 1. owns the height */}
  <header className="h-12 shrink-0 border-b" />            {/* 4. pinned */}

  <div className="flex flex-1 overflow-hidden">            {/* 2. definite height for the row */}
    <aside className="w-56 shrink-0 flex flex-col overflow-hidden">
      <div className="h-10 shrink-0 border-b" />           {/* pinned */}
      <div className="flex-1 min-h-0 overflow-y-auto" />   {/* 3. THE scroller */}
    </aside>

    <main className="flex-1 min-w-0 relative" />           {/* min-w-0! see §2.4 */}

    <aside className="w-96 shrink-0 flex flex-col overflow-hidden">
      <div className="shrink-0 border-b" />                {/* tab bar */}
      <div className="flex-1 min-h-0 overflow-hidden">     {/* slot — see §3.1 */}
        {/* panel goes here and must be h-full */}
      </div>
    </aside>
  </div>
</div>
```

Plain CSS equivalent:

```css
.shell   { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }
.row     { flex: 1 1 auto; min-height: 0; display: flex; }
.rail    { flex: 0 0 24rem; display: flex; flex-direction: column; overflow: hidden; }
.rail > header  { flex: 0 0 auto; }
.rail > .body   { flex: 1 1 auto; min-height: 0; overflow-y: auto;
                  overscroll-behavior: contain; }
```

### 2.3 `overflow-x-hidden` is a trap — this is likely your bug

Per spec, when one overflow axis is not `visible`, a `visible` on the other axis
**computes to `auto`**. So:

```html
<!-- looks harmless. is not. -->
<div class="overflow-x-hidden">
```

…is now a **vertical scroll container**. Consequences:

- a second, unexpected scrollbar appears;
- any descendant `position: sticky` header silently stops sticking (§2.5);
- the box's automatic minimum size becomes 0, so it can be squeezed to nothing.

**Use `overflow-x-clip` instead.** `clip` is not a scroll container, creates no BFC, and
doesn't flip the other axis.

Real instance in this repo: `DiagramTabs` (`DiagramTabs.tsx:66`) sets `overflow-x-auto`
without `shrink-0`, so its computed `overflow-y` is `auto`, its automatic minimum is 0,
and under vertical pressure it can compress and clip its own tab row.

### 2.4 `min-w-0` — the horizontal twin

Same mechanism, horizontal axis. A row flex item with `overflow: visible` won't shrink
below its min-content width, so one long unbreakable string, wide table row, or `<pre>`
pushes the whole layout sideways.

This repo has the bug in two places (§12): `SidebarInset` (`sidebar.tsx:302`) and the
canvas `<main>` (`page.tsx:238`). The canvas one is currently harmless *only* because
React Flow renders into an absolutely-positioned transformed viewport that contributes ~0
min-content width. Put any normal wide child in there and the rails leave the screen.

### 2.5 `position: sticky` is re-parented, not disabled

Ancestor `overflow` doesn't switch sticky off — it changes what sticky is measured
against. Insets resolve against the **nearest scrollport**. If that ancestor is
`overflow: hidden` (a scroll container that never scrolls), there is nothing to stick
relative to, and the element simply never moves.

Checklist when sticky "doesn't work":
- an ancestor has non-`visible` overflow (including an accidental `overflow-x-hidden`);
- the scrolling ancestor has no definite height;
- no inset (`top-0`) was set;
- the sticky element is taller than its container;
- flex/grid `align-items: stretch` — fix with `align-self: start`.

### 2.6 Scrollbars: `scrollbar-gutter` will not fix a Mac

`scrollbar-gutter: stable` reserves the scrollbar's space so content doesn't jump when it
appears. **But with overlay scrollbars — the macOS default — no gutter is reserved and
the property is a no-op.**

So if the symptom is *"content sits under the scrollbar"* on a Mac, `scrollbar-gutter` is
not the fix. Use `padding-inline-end` on the scroll container so content never reaches
the track. Keep `scrollbar-gutter: stable` anyway for Windows/Linux/CI, where classic
scrollbars do consume width and *do* cause the jump.

This also explains why your machine and CI can disagree: **macOS renders overlay
scrollbars; Playwright/Chromium on Linux CI renders classic ones that take real width.**
Test both (§11).

### 2.7 `overscroll-behavior: contain`

Stops scroll chaining — reaching the bottom of a panel shouldn't start scrolling the page
behind it. Put it on every inner scroller. ~95% support; Safari 16+.

This repo has **none anywhere** — a genuine gap, not a pattern to copy.

---

## 3. The panel slot contract

### 3.1 The slot is a block, not a flex parent

The right rail's content slot — `RightPanelContent.tsx:48`:

```
flex-1 min-h-0 overflow-hidden
```

Read it carefully: **there is no `flex flex-col`.** It is a plain block box. Therefore its
children are block-level, *not* flex items. Which means:

- a panel whose root is `flex-1` computes `flex: 1 1 0%` against nothing → collapses to
  content height;
- a panel whose root is `flex flex-col` *without* `h-full` → same collapse.

**Every panel mounted in a slot must be `h-full` and own its own scroller.** That is the
contract, and it is exactly the failure mode you hit elsewhere. In this repo **no panel
violates it** — which is precisely why the right rail behaves.

Two conforming shapes:

```tsx
// A — simplest and safest: delegate entirely to ScrollArea
export function ChecklistPanel() {
  return <ScrollArea className="h-full">{/* content */}</ScrollArea>;
}

// B — pinned header + scrolling body
export function ThreatPanel() {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b shrink-0">{/* header */}</div>
      <ScrollArea className="flex-1 min-h-0">{/* body */}</ScrollArea>
      <div className="p-3 border-t shrink-0">{/* footer */}</div>
    </div>
  );
}
```

Shape A is the safest — no flex math at all. Prefer it unless you need pinned chrome.

**Every branch must honour the contract**, including loading and empty states. This repo
does: `flex items-center justify-center h-full`. A loading state that forgets `h-full`
collapses the panel and looks like a layout bug.

### 3.2 Why the height percentages resolve

`h-full` is `height: 100%`, and a percentage height only resolves against a parent with a
**definite** height. The chain here is definite the whole way:

```
h-screen overflow-hidden        page.tsx:154
  → flex flex-1 overflow-hidden page.tsx:202   (row gets the leftover, clamped)
    → flex flex-col             page.tsx:263   (rail, stretched to row height)
      → flex-1 min-h-0 overflow-hidden  RightPanelContent.tsx:48
        → h-full                panel root      ← resolves because everything above is definite
```

Break any link — swap `h-screen` for `min-h-screen`, drop an `overflow-hidden` — and
every `h-full` below silently becomes `height: auto`. **That is the single most common way
this class of layout dies.**

### 3.3 Where `min-h-0` is load-bearing here

Honest accounting, because it tells you where bugs can hide:

| Site | Status | Why |
|---|---|---|
| `ScrollArea className="flex-1 min-h-0"` (palette, properties panels) | **Load-bearing** | Radix `ScrollArea.Root` sets only `position: relative` — no overflow. It *is* a `visible` flex item, so it needs `min-h-0`. |
| `RightPanelContent.tsx:48` | Redundant, keep it | `overflow-hidden` already zeroes the automatic minimum. Self-documenting. |
| `RightPanelAI.tsx:47` | No-op | Its parent is a block, so it isn't a flex item at all. `h-full` is what's doing the work. |

**Rule of thumb:** if you wrap content in Radix `ScrollArea` and make it a flex item, you
**must** write `min-h-0`. Five panels in this repo miss it (§12) and survive only on an
implementation detail of Radix's internals.

### 3.4 Collapsible sections: don't animate height

Sections here expand **instantly** — only the chevron rotates (200ms). Radix `Collapsible`
is used as a bare passthrough with no height animation and no `overflow-hidden`.

That is a feature, not an omission. Content grows the flow inside the ScrollArea viewport,
which absorbs it. **There is no animated `height: 0 → auto` fighting an `overflow-hidden`
clamp — which is the classic source of "expanded content gets clipped."**

If you *do* want animated collapse, `height: auto` cannot be interpolated. Options in
2026:

| Approach | Safe? |
|---|---|
| `grid-template-rows: 0fr → 1fr` | ✅ Works everywhere. **Requires `overflow: hidden` on the inner child** — `0fr` is `minmax(auto, 0fr)` and the automatic minimum otherwise floors the track at content height, so nothing animates. Same root cause as §2.1. |
| Radix `--radix-collapsible-content-height` | ✅ JS-measured. Caveat: measured once at open, so async/late-loading content won't be reflected. |
| `interpolate-size: allow-keywords` / `calc-size()` | ❌ **Chromium-only, ~70%.** No Firefox, no Safari as of 2026. Progressive enhancement behind `@supports` only. |

---

## 4. The two regimes — copy the right one

**This repo contains two different layout models. Only one is correct.**

### Regime B — the model editor (`/models/[id]`) ✅ copy this
Viewport-locked: `flex flex-col h-screen w-screen overflow-hidden` (`page.tsx:154`).
Nothing scrolls the document; every scroller is internal and explicit. This is the
disciplined layout described throughout this guide.

Note it deliberately sits **outside** the `(app)` route group — no `layout.tsx` under
`src/app/models/` — so it never inherits the shell and establishes its own root.

### Regime A — the app shell (`(app)/*`) ⚠️ do not copy
`SidebarProvider` uses `min-h-svh` (`sidebar.tsx:132`) with **no** `h-svh` and no
`overflow-hidden`. Height stays `auto` and grows with content. Consequences on ~20 pages:

- `<main className="flex-1 overflow-y-auto">` is a **dead scroller** — it never has
  anything to clip. The **body** scrolls.
- `AppHeader`'s `h-14 shrink-0` does *not* pin it — there's no `sticky top-0`, and it
  scrolls away.
- `SidebarInset` has `w-full flex-1` but no `min-w-0` → wide unbreakable content
  overflows the page horizontally.

To convert Regime A to Regime B: `h-svh overflow-hidden` on the provider wrapper, plus
`min-h-0 min-w-0` on `SidebarInset`.

---

## 5. Sizing: when percentage, when fixed, when flex

| Use | For | Example |
|---|---|---|
| **Fixed rem** | Chrome whose size is a design decision | rails `w-56`/`w-96`, collapsed `w-10`, header `h-12`, toolbar `h-14` |
| **`flex-1`** | The one region that should absorb leftover space | canvas `<main>`, panel bodies |
| **`h-full` (100%)** | A child filling a parent with a *definite* height | every panel root |
| **`max-h-*`** | Floating panels that must self-clamp | `LayersPanel max-h-80`, `OutlinePanel max-h-[70vh]` |
| **`dvh`** | The app-shell root on mobile | `h-dvh` — tracks the collapsing URL bar |

`vh` vs `dvh` vs `svh`: `lvh` = UI retracted, `svh` = UI expanded, `dvh` = live. For a
shell that must exactly fill the visible area, `100dvh`. For content that must not jump
mid-scroll, `100svh`. ~94% support (Safari 15.4+, Chrome 108+, Firefox 101+).

**Percentages only work downward from a definite height.** That's §3.2. Fixed sidebar
widths live in CSS custom properties so collapsed/expanded states share one source:

```ts
// sidebar.tsx:20-22
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
```

Floating panels self-clamp — `max-h-*` supplies the definite height that
`flex-1 + overflow-y-auto` needs, the floating analogue of the shell's `h-screen → flex-1`
chain:

```tsx
<div className="… w-52 flex flex-col max-h-80">
  <div className="shrink-0">{/* header */}</div>
  <div className="flex-1 overflow-y-auto p-1">{/* list */}</div>
</div>
```

---

## 6. Colour and tokens

**Stack:** Tailwind **v4**, shadcn **new-york**, base **neutral**, lucide icons.

> ⚠️ **There is no `tailwind.config.js`.** `components.json` has `"config": ""`. Theme
> lives in CSS via `@theme inline` in `src/app/globals.css`. Creating a
> `tailwind.config.js` does nothing in v4 — a very common agent mistake.
>
> ⚠️ Dark mode is **class-based**: `@custom-variant dark (&:is(.dark *))`. Do **not**
> write `@media (prefers-color-scheme: dark)` — it won't respond to the theme toggle.
>
> ⚠️ The animation plugin is **`tw-animate-css`**, not `tailwindcss-animate` (that's v3).

### 6.1 Palette

All colours are **oklch**, and the neutral ramp is **fully achromatic** (chroma 0) — this
is stock shadcn neutral, unmodified. The only chromatic tokens are `--destructive` and the
chart colours.

| Token | Light | Dark |
|---|---|---|
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `--card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` |
| `--popover` | `oklch(1 0 0)` | `oklch(0.205 0 0)` |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| `--secondary` / `--muted` / `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` |
| `--input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` |
| `--sidebar` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |

Note the dark `--border` uses **alpha on white** (`oklch(1 0 0 / 10%)`) rather than a
lighter grey — borders read as a subtle lift over whatever surface they sit on.

A global base rule means anything with `border` gets the token free:

```css
* { @apply border-border outline-ring/50; }
body { @apply bg-background text-foreground; }
```

### 6.2 Radius

One source, four derived:

```css
--radius: 0.625rem;                     /* 10px */
--radius-sm: calc(var(--radius) - 4px); /*  6px */
--radius-md: calc(var(--radius) - 2px); /*  8px */
--radius-lg: var(--radius);             /* 10px */
--radius-xl: calc(var(--radius) + 4px); /* 14px */
```

Convention: buttons `rounded-md`, cards/dialogs `rounded-lg`, badges/pills
`rounded-full`, boundary nodes `rounded-xl`. Never hardcode a radius.

### 6.3 Borders over shadows — the signature

**Borders outnumber shadows ~8:1** (1302 vs ~168). This single ratio is most of why the
UI reads clean rather than heavy.

Shadow is reserved for genuinely *floating* surfaces: dialog/sheet `shadow-lg`,
popover/dropdown `shadow-md`, outline button `shadow-xs`, canvas nodes `shadow-sm`.
Separation between in-flow regions is **always** `border-b` / `border-t` / `border-r`.
Hover uses a tinted background (`hover:bg-muted/50`), never elevation.

---

## 7. Typography and density

Fonts: **Geist** + **Geist Mono** via `next/font`, bound to `--font-sans` / `--font-mono`.

Actual usage across the codebase:

| Class | Count | Role |
|---|---|---|
| `text-xs` | 1074 | the workhorse — badges, metadata, table cells |
| `text-sm` | 898 | default body and controls |
| `text-[10px]` | **156** | dense chrome |
| `text-2xl` | 94 | page `h1` (with `font-bold tracking-tight`) |
| `text-lg` | 76 | card/section titles |
| `text-base` | 49 | rare |
| `text-[11px]` | 29 | dense chrome |
| `text-[9px]` | 18 | node status chips |

`text-xs` + `text-sm` = **~78% of everything**. Note `text-base` is used *less* than
`text-[10px]` — **this is a deliberately dense product**, and the sub-12px tier is a real
tier, not an escape hatch. If you build a screen here at `text-base`, it will look wrong.

Weights: `font-medium` (600 uses) dominates; `font-bold` is essentially reserved for page
headings.

### Hierarchy devices — only four, used relentlessly

1. **`text-muted-foreground` — 1475 occurrences**, the single most-used semantic class.
   Hierarchy is carried by *lightness*, not size or weight.
2. **Uppercase eyebrow labels**:
   `text-xs font-semibold text-muted-foreground uppercase tracking-wide`
   (dense variant: `text-[10px] … uppercase tracking-wide`).
3. **Borders as separators** (§6.3).
4. **Two-line stack in canvas nodes** — label at `font-medium` in the type's hue, type
   beneath at `text-xs capitalize` in the muted variant of the same hue. *Hue carries
   identity, lightness carries hierarchy.*

Spacing rhythm: `gap-2` (691) dominates, then `space-y-2`, `gap-1`, `space-y-4`, `p-4`,
`p-3`. Even steps; half-steps (`py-0.5`, `px-1.5`) appear only at badge scale.

---

## 8. Motion

Almost all motion is two things: `animate-spin` (163, loaders) and `transition-colors`
(143, hover). That restraint is deliberate — **motion is feedback, not decoration.**

| Thing | Value |
|---|---|
| Sidebar width | `transition-[width] duration-200 ease-linear` |
| Editor rails | `transition-all duration-200` (default ease `cubic-bezier(.4,0,.2,1)`) |
| Sheet / drawer | `data-[state=open]:duration-500`, `data-[state=closed]:duration-300` — asymmetric, in slower than out |
| Dialogs | `fade-in-0 zoom-in-95`, `duration-200` |
| Popover/dropdown | directional `slide-in-from-{side}-2` + `origin-(--radix-*-transform-origin)` |
| Chevrons | `transition-transform duration-200`, `-rotate-90` → `rotate-0` |
| Canvas nodes | `transition-colors duration-150` |

**Prefer property-scoped transitions** (`transition-[width]`) over `transition-all`. The
sidebar does this; the editor rails don't, and that's the weaker of the two.

**Rail collapse animates width only** — content is *unmounted*, not hidden:

```tsx
{!leftPanelCollapsed && (
  <div className="flex-1 overflow-hidden"><ComponentPalette /></div>
)}
```

Trade-off worth knowing: unmounting destroys panel state (scroll position, open sections,
filters) and refetches data on expand. If you want state preserved, hide with CSS instead
— but then you must keep it out of the flow.

Collapse state lives in the **Zustand UI store**, not local state, so any component can
drive it. The app sidebar additionally persists to a cookie
(`sidebar_state`, 7 days) and binds **Cmd/Ctrl+B**.

⚠️ `prefers-reduced-motion` is honoured in **3 components** out of ~40 animated surfaces,
and there is no global fallback. Do better in new work:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. The canvas

```
<main className="flex-1 relative">        ← definite height from the row; positioning context
  └ ReactFlowProvider                      (renders no DOM; must wrap for hooks)
    └ CanvasContextMenu → div.w-full.h-full
      └ canvas root div.w-full.h-full
        └ <ReactFlow>                      (library CSS: width/height 100%)
```

Percentages resolve all the way down **only because `<main>`'s height is definite** — the
payoff of `h-screen` + `flex-1 overflow-hidden` above it.

The canvas can never push the layout: React Flow's renderer is
`position: absolute; inset: 0; overflow: hidden`, and nodes live in a transformed
viewport, so the subtree contributes ~0 to min-content size.

**Overlays — two mechanisms, both flow-neutral:**

1. React Flow `<Panel position="…">` for `Controls`, `MiniMap`, `Background`, toolbars —
   the library positions them.
2. Absolutely-positioned siblings for `CanvasEmptyState`, `OutlinePanel`.

The empty-state overlay uses a pointer-events split so the canvas stays usable
underneath:

```tsx
<div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
  <div className="pointer-events-auto … bg-background/80 backdrop-blur-sm border border-dashed">
```

⚠️ The canvas root lacks `relative`, so those overlays currently anchor to `<main>` by
accident. It looks right only because `<main>` is the same box. **Add `relative` to the
element you intend overlays to anchor to** — don't rely on coincidence.

---

## 10. Title bar and rails — the actual composition

**Editor chrome, top to bottom** (`page.tsx`):

| Element | Classes |
|---|---|
| Shell | `flex flex-col h-screen w-screen overflow-hidden` |
| Toolbar | `h-12 bg-background border-b flex items-center px-4 gap-4` |
| Diagram tabs | `flex items-center gap-1 px-2 py-1 bg-muted border-b overflow-x-auto scrollbar-hide` |
| 3-column row | `flex flex-1 overflow-hidden` |

Both chrome rows **should** have `shrink-0`; neither does. The toolbar survives on
`min-height: auto`; the tab bar does not (§2.3).

**Rails** (`w-10` collapsed ↔ `w-56` left / `w-96` right):

```tsx
<div className={cn(
  "flex flex-col bg-background border-l transition-all duration-200 overflow-hidden",
  rightPanelCollapsed ? "w-10" : "w-96",
)}>
  <button className="flex items-center justify-center h-10 shrink-0 border-b
                     hover:bg-muted/50 transition-colors
                     focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1" />
  {!collapsed && <>{tabs}{content}</>}
</div>
```

**Below `lg` both rails unmount entirely** and are replaced by FABs
(`h-12 w-12 rounded-full shadow-lg`) opening `Sheet` drawers. The Sheet base already
supplies `fixed inset-y-0 h-full flex flex-col` — a definite-height column — so the same
panel contract holds unchanged inside a drawer. **Don't build a second mobile layout;
re-host the same panels.**

---

## 11. How to test a layout (agents: do this before claiming done)

The bug only appears once content exceeds the container, so **you must generate
overflow** — it will not show up on an empty panel.

### Fastest checks, in order of yield

1. **Fill a panel with 200 rows.** Then check the *empty* state too — the scrollbar
   appearing/disappearing is its own bug class.
2. **Assert the document doesn't scroll.** For a fixed shell, this must hold:
   ```js
   document.documentElement.scrollHeight <= window.innerHeight
   ```
   If it fails, a `min-h-0` link is missing.
3. **Confirm the scroller is the one you intended:**
   ```js
   const el = document.querySelector('[data-testid="panel-body"]');
   el.scrollHeight > el.clientHeight   // true = it scrolls
   ```
   Then verify no *unexpected* element scrolls — that catches accidental
   `overflow-x-hidden` containers.
4. **Force classic scrollbars.** macOS defaults to overlay (System Settings → Appearance →
   *Always* show scroll bars). Playwright/Chromium on Linux CI already uses classic. This
   is the single biggest source of "works on my machine."
5. **Resize to 360px wide** — surfaces missing `min-w-0` / `minmax(0,1fr)` as horizontal
   document overflow.
6. **Zoom to 200%** (or 2× device scale) — catches fixed pixel heights.
7. **Scroll a panel to its end and keep scrolling.** If the page moves,
   `overscroll-behavior: contain` is missing.
8. **Scroll with a sticky header present.** If it stops sticking, walk ancestors for a
   computed `overflow` that isn't `visible`.

### Playwright harness

```ts
test('panel scrolls internally; document does not', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/models/demo');
  await seedManyRows(page, 200);

  const docScrolls = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight,
  );
  expect(docScrolls).toBe(false);            // the shell must never scroll

  const body = page.getByTestId('panel-body');
  expect(await body.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);

  await expect(page).toHaveScreenshot('panel-overflow.png');
});
```

Run the viewport matrix **360 / 768 / 1440**, and screenshot the panel element itself as
well as the full page — a clipped panel often looks fine in a full-page shot.

### Visual debugging

```css
* { outline: 1px solid red; }   /* outline, NOT border — outlines don't affect layout */
```

Chrome DevTools flags scroll containers with a `scroll` badge in the Elements pane — the
fastest way to spot one you created by accident. The flex/grid overlays show which item is
refusing to shrink.

---

## 12. Known inconsistencies — do NOT copy these

Real defects found in this codebase. Fix them if you touch them; don't propagate them.

| # | Issue | Where |
|---|---|---|
| 1 | **14 conflicting severity colour maps.** `LOW` is green in 3, blue in 9. `INFO` has 4 different values. `bg-yellow-500 text-white` fails WCAG AA. Root cause: `Badge` has 4 variants, none severity-aware, so callers pass raw palette classes. **Fix properly: one `severityVariants` cva + tokens.** | 14 files |
| 2 | Regime A never clamps height — dead scrollers on ~20 pages, header doesn't pin | `sidebar.tsx:132` |
| 3 | `SidebarInset` missing `min-w-0` → horizontal page overflow | `sidebar.tsx:302` |
| 4 | Five panels use `<ScrollArea className="flex-1">` **without `min-h-0`** — surviving only on a Radix internal detail | attack-chains, documents, requirements ×3 |
| 5 | Canvas `<main>` missing `min-w-0`; canvas root missing `relative` | `page.tsx:238`, `ThreatModelCanvas.tsx:228` |
| 6 | `DiagramTabs` missing `shrink-0` while `overflow-x-auto` zeroes its minimum | `DiagramTabs.tsx:66` |
| 7 | Canvas node palette (~290 entries) has **zero `dark:` variants** — pastel `-50` fills on a dark canvas | `component-configs.ts` |
| 8 | Trust-zone colours are raw hex/rgba via inline `style` — invisible to the theme system | `BoundaryNodeInner.tsx:19-24` |
| 9 | The 5 `--chart-*` tokens have **zero consumers**; charts hardcode palette classes | `globals.css` |
| 10 | No `overscroll-behavior` and no `scrollbar-gutter` anywhere | repo-wide |
| 11 | `prefers-reduced-motion` honoured in 3 components of ~40 | repo-wide |
| 12 | Focus rings fork: primitives use `ring-ring/50 ring-[3px]`, canvas uses `ring-2 ring-blue-500` | canvas nodes |

---

## 13. Checklist before you ship a screen

- [ ] Exactly one ancestor owns the height (`h-dvh`/`h-screen` + `overflow-hidden`)
- [ ] `min-h-0` on **every** flex/grid link down to the scroller
- [ ] `min-w-0` on any row flex item that can receive wide content
- [ ] Exactly one `overflow-y-auto`, innermost; its parent is `overflow-hidden`
- [ ] `shrink-0` on every header, tab bar, toolbar, footer
- [ ] No `overflow-x-hidden` anywhere — use `overflow-x-clip`
- [ ] Panel root is `h-full` in **every** branch, including loading and empty
- [ ] `overscroll-behavior: contain` on inner scrollers
- [ ] Colours from tokens; no raw hex; no `bg-gray-*`
- [ ] Dark mode checked (class-based `.dark`, not a media query)
- [ ] Tested at 360 / 768 / 1440, at 200% zoom, and with classic scrollbars forced
- [ ] Filled a panel with 200 rows and confirmed the **document** doesn't scroll
- [ ] Keyboard focus visible; `prefers-reduced-motion` respected

---

### Sources

Mechanisms verified against MDN (`min-height`, `overflow`, `scrollbar-gutter`,
`overscroll-behavior`, `<length>`), CSSWG discussion of the automatic-minimum-size rule,
caniuse (`overscroll-behavior` 95.5%, viewport-unit variants ~94%, container queries ~94%,
`interpolate-size` ~70% Chromium-only), Josh Comeau's flexbox guide, the flexbugs #241
writeup, Polypane's sticky-failure catalogue, and Radix/shadcn documentation and issue
threads. Everything about *this repo* is cited inline as file:line and was read directly.
