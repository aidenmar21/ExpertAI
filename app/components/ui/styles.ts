/**
 * Shared class strings for the ExpertAI application profile (spec sections 4, 5, 9, 12, 14).
 * One semantic token source lives in app/globals.css; every panel, page and card composes from here.
 */

/** Decorative hairline (border-subtle). */
export const hairline = "border border-line";

/** Application card: surface, 16px radius, one grouping cue (the hairline), no shadow. */
export const card = `ui-card rounded-lg bg-surface ${hairline}`;

/** Inset grouped area inside a card. */
export const inset = "rounded-md bg-surface-subtle";

/** Section eyebrow: 12/17 weight 500, secondary ink. Used only for section labels. */
export const eyebrow = "text-note font-medium uppercase tracking-wider text-ink-secondary";

/** Persistent field label (12.1): 15/20 weight 500. */
export const label = "block text-label text-ink";

/** Field (12.1): 44px min height, 16px text, border-control boundary, surface background. */
export const field =
  "block w-full min-h-11 rounded-md border border-line-control bg-surface px-3.5 py-2.5 text-base leading-6 text-ink outline-none transition-[border-color,box-shadow] duration-150 ease-ui hover:border-ink-tertiary focus:border-focus focus:ring-2 focus:ring-focus/30 aria-invalid:border-danger-ink disabled:cursor-not-allowed disabled:opacity-55 read-only:bg-surface-subtle";

/** Compact field for dense inline editors (fine pointer). Still 16px text. */
export const fieldCompact =
  "block w-full min-h-9 rounded-sm border border-line-control bg-surface px-2.5 py-1.5 text-base leading-6 text-ink outline-none transition-[border-color,box-shadow] duration-150 ease-ui hover:border-ink-tertiary focus:border-focus focus:ring-2 focus:ring-focus/30";

/** Helper / error text under a field. */
export const help = "mt-1.5 text-meta text-ink-secondary";
export const errorText = "mt-1.5 text-meta text-danger-ink";

const btnBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-transparent px-4 py-2.5 text-label whitespace-normal text-center transition-[background-color,border-color,color] duration-150 ease-ui select-none pointer-fine:min-h-9 pointer-fine:py-1.5 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-busy:cursor-progress";

/** Buttons (9.1/9.2): one filled primary per region; secondaries carry a control border; tertiary is text. */
export const btn = {
  primary: `${btnBase} bg-action text-on-action hover:bg-action-hover active:bg-action-pressed`,
  secondary: `${btnBase} border-line-control bg-surface text-ink hover:bg-surface-hover active:bg-surface-selected`,
  tertiary: `${btnBase} text-link hover:bg-surface-hover active:bg-surface-selected`,
  danger: `${btnBase} bg-danger-solid text-on-action hover:bg-danger-hover active:bg-danger-pressed`,
  /** Destructive, not final: danger ink on a neutral control. */
  dangerQuiet: `${btnBase} border-line-control bg-surface text-danger-ink hover:bg-danger-surface active:bg-danger-surface`,
  /** Compose with a variant for toolbar density. */
  compact: "px-3 text-meta font-medium",
  /** Icon-only: 44px square target. */
  icon: "size-11 p-0 pointer-fine:size-9",
} as const;

/** Text link / text-only action. */
export const link = "text-link underline-offset-[0.15em] hover:underline";

/** Pills (radius full), 12/17 weight 500. Semantic ink/surface pairs, never interchangeable. */
const pillBase = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-note font-medium";
export const pill = {
  neutral: `${pillBase} bg-surface-subtle text-ink-secondary`,
  outline: `${pillBase} border border-line text-ink-secondary`,
  info: `${pillBase} bg-info-surface text-info-ink`,
  success: `${pillBase} bg-success-surface text-success-ink`,
  warning: `${pillBase} bg-warning-surface text-warning-ink`,
  danger: `${pillBase} bg-danger-surface text-danger-ink`,
  selected: `${pillBase} bg-surface-selected text-link`,
} as const;

/** Banners (16.3): semantic tinted surface with ink. */
const bannerBase = "flex items-start gap-3 rounded-md px-4 py-3 text-body";
export const banner = {
  info: `${bannerBase} bg-info-surface text-info-ink`,
  success: `${bannerBase} bg-success-surface text-success-ink`,
  warning: `${bannerBase} bg-warning-surface text-warning-ink`,
  danger: `${bannerBase} bg-danger-surface text-danger-ink`,
} as const;

/** Empty state container (18.4): title, short paragraph, optional action. */
export const emptyBox = "rounded-lg border border-dashed border-line px-6 py-8 text-center";

/** Page container (6.1/6.2): 1200 max, responsive insets. */
export const page = "mx-auto w-full max-w-[75rem] px-5 sm:px-6 md:px-8 xl:px-10";

/** Two-level heading helpers. */
export const h1 = "text-page text-ink";
export const h2 = "text-section text-ink";
export const h3 = "text-sub text-ink";
export const cardTitle = "text-card text-ink";
