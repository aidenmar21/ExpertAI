# Apple-Inspired UI Design Guidelines

**Version:** 1.0  
**Research date:** October 3, 2026  
**Purpose:** A detailed, transferable specification for redesigning existing websites and applications with an Apple-inspired visual and interaction language.  
**Primary targets:** Responsive web applications, product websites, dashboards, editors, commerce, and AI tools. Native Apple-platform adaptations appear later in this document.

### Navigation

- Foundations: [Use and scope](#0-how-to-use-this-document), [design language](#1-the-design-language-to-reproduce), [profiles](#2-choose-the-right-profile-before-designing), [global rules](#3-nonnegotiable-global-rules).
- Visual system: [Tokens](#4-design-tokens-naming-values-and-rules), [typography](#5-typography), [layout](#6-layout-alignment-and-responsive-behavior), [materials](#7-surfaces-borders-and-materials), [icons and imagery](#8-icons-imagery-and-brand).
- Core controls: [Buttons](#9-buttons-and-actionable-links), [navigation](#10-navigation), [menus](#11-toolbars-menus-and-contextual-actions), [forms](#12-forms-text-fields-and-validation), [choices](#13-choice-controls-and-pickers).
- Working surfaces: [Cards/tables](#14-cards-lists-and-tables), [dialogs](#15-dialogs-sheets-and-drawers), [feedback overlays](#16-popovers-tooltips-banners-and-toasts), [search](#17-search-filtering-and-command-palettes), [loading and recovery](#18-loading-progress-empty-states-and-failure).
- Specialized content: [Analytics](#19-charts-metrics-and-analytics), [schedules](#20-calendars-schedules-and-timelines), [editors](#21-editors-documents-code-and-review-panels), [files](#22-file-upload-drag-and-drop-and-downloads), [AI](#23-ai-assistants-chat-and-generated-work), [recording/media](#24-audio-recording-transcription-and-media).
- Product flows: [Authentication/onboarding](#25-authentication-onboarding-and-first-use), [settings/privacy](#26-settings-permissions-notifications-and-privacy), [commerce](#27-commerce-pricing-booking-and-checkout).
- Adaptation: [Motion](#28-motion-and-microinteractions), [inputs](#29-keyboard-pointer-touch-and-gestures), [accessibility](#30-accessibility-acceptance-standard), [dark mode](#31-dark-appearance-and-higher-contrast), [localization](#32-localization-and-inclusive-content).
- Composition: [Marketing recipes](#33-marketing-page-recipes), [application recipes](#34-application-screen-recipes), [performance](#35-performance-and-implementation-discipline), [native platforms](#36-native-apple-platform-adaptation).
- Implementation: [Copy/architecture](#37-content-microcopy-and-information-architecture), [persistence/undo](#38-state-persistence-undo-and-concurrency), [migration](#39-migration-strategy-for-an-existing-project), [corrections](#40-common-failure-patterns-and-exact-corrections), [CSS](#41-reference-css-implementation), [markup/contracts](#42-reference-markup-and-component-contracts).
- Completion: [State inventory](#43-screen-and-state-inventory), [verification](#44-verification-checklist), [scorecard](#45-review-scorecard), [agent workflow](#46-execution-instructions-for-a-coding-agent), [exceptions](#47-exceptions-and-customization), [copyable prompt](#48-compact-rules-and-reusable-full-prompt), [sources](#49-sources-and-research-notes).

## 0. How to use this document

Give this entire file to the coding agent working inside the project. Use the instruction below:

> Inspect the existing project, then update its UI according to this specification. Choose the appropriate application or marketing profile for each surface. Preserve working features, routes, data, authorization, and integrations. Implement a shared token and component system before updating screens. Apply the specified responsive behavior, interaction states, accessibility requirements, and acceptance checks. Treat numerical values labeled as project defaults as the implementation baseline, not as universal Apple requirements. Complete the relevant states and workflows; a restyled first screen alone is insufficient. Report actual changes, verification, and remaining gaps.

### 0.1 Rule vocabulary

- **MUST:** Required for this specification unless a documented platform limitation prevents it.
- **SHOULD:** Expected baseline; departures require a concrete usability or product reason.
- **MAY:** Optional technique, used only when it improves the current experience.
- **Project default:** An original implementation choice in this document. These values make the spec executable; they are not presented as Apple's proprietary design tokens.
- **Apple guidance:** A short paraphrase of an official HIG recommendation, attributed to a source in Section 49.
- **Observed website style:** A value or pattern found in the sampled Apple website HTML/CSS. CSS declarations are evidence of an implementation, not proof of a universally computed style across every page.

### 0.2 Source boundaries

Research included the Apple homepage, iPhone and iPad category pages, MacBook Air product page, Store page, iOS and macOS overview pages, their available stylesheets, and **58 readable HIG articles** covering foundations, components, inputs, and patterns. Official HIG illustrations and examples inform the material and navigation discussion. Sources are listed at the end.

This is an **original design system inspired by those sources**, not an official Apple document, a copied HIG, or a claim that every interface can use identical measurements. Apple-specific APIs, point units, and OS behaviors are distinguished from browser equivalents. The examples and recipes here are project recommendations. Specialized games, vehicle interfaces, spatial interaction, and every individual Apple framework are outside the main web implementation scope.

### 0.3 Priority when rules compete

Apply this order:

1. Correctness, honest state, privacy, accessibility, and preservation of user work.
2. Platform conventions and the project's actual task requirements.
3. Clear hierarchy, predictable behavior, and responsive usability.
4. Shared tokens and component consistency.
5. Visual similarity to Apple.
6. Decorative effects.

For example, increase a button's height when its translated label wraps, even if that exceeds the default measurement. A readable dense table is more valuable than an oversized marketing treatment.

### 0.4 Required implementation deliverables

The project update MUST contain:

- A single semantic token source for colors, typography, spacing, radii, elevation, motion, and layers.
- Shared components rather than repeated ad hoc page styling.
- Working keyboard, pointer, and touch behavior appropriate to each component.
- Light and dark application themes when the product supports appearance changes.
- Responsive adaptations for narrow screens and resizable windows.
- Loading, empty, error, success, unavailable, and permission states where applicable.
- Visual verification of important routes and state transitions.
- A concise change report with exceptions and unresolved issues.

Do not invent backend behavior to make a screenshot look complete. If a feature is unavailable, show its actual state.

## 1. The design language to reproduce

### 1.1 Current Apple principles, translated into project rules

The current HIG describes purpose, agency, responsibility, familiarity, flexibility, simplicity, craft, and delight. Apply these ideas through concrete product decisions rather than adding a slogan to the UI. [H01]

| Principle | Required application in this system |
| --- | --- |
| Purpose | Every route has one identifiable job; its highest-priority content appears before secondary details. |
| Agency | Provide explicit choices, cancel paths, undo where feasible, and visible control over meaningful automated actions. |
| Responsibility | Describe actual permissions, recording, storage, and external actions accurately. |
| Familiarity | Use established controls, navigation positions, keyboard behavior, and labels. |
| Flexibility | Adapt to viewport, input type, text size, language, and appearance preferences. |
| Simplicity | Remove duplication and unnecessary decoration while retaining information needed for a decision. |
| Craft | Align edges, tune typography, complete states, and verify the smallest repeated details. |
| Delight | Make completion, feedback, and transitions feel satisfying without slowing the task. |

### 1.2 Visual signature

The intended signature is:

- A calm, predominantly neutral canvas.
- Strong typography that establishes hierarchy before borders or color do.
- Deliberate empty space between unrelated groups.
- Tighter spacing within related groups.
- Content that receives more visual attention than interface chrome.
- Restrained accent color for meaningful actions and selection.
- Rounded shapes whose radius fits their function and scale.
- Fine separators, occasional elevation, and carefully limited translucency.
- Simple symbols matched optically to nearby text.
- Short, precise labels.
- Feedback that is immediate, quiet, and unmistakable.

For an app screen, the user's work should visually dominate. For a marketing screen, the product or benefit should visually dominate. These are different compositions.

### 1.3 Avoid surface imitation without system behavior

Do not call the redesign complete because the page has white backgrounds, blue buttons, and rounded cards. The system MUST also resolve:

- Which action is primary.
- How related information is grouped.
- What happens on hover, press, selection, focus, and disablement.
- How loading preserves context.
- How mobile navigation changes.
- How content grows with long text.
- How a user recovers from a failed or accidental action.
- How overlays restore focus.
- How light and dark materials preserve contrast.

### 1.4 Apple.com observations that inform the defaults

These are sampled stylesheet declarations, not mandatory dimensions for every product:

| Sampled location | Observed declaration or pattern | Translation into this spec |
| --- | --- | --- |
| Global navigation styles | 44 px navigation-height variable; homepage uses a 48 px value below 833 px | Use a compact marketing header, but expand touch targets and allow content-driven height. |
| iPhone category styles | Large headline declaration at 80 px, 1.05 line height, weight 600 | Use large display typography on marketing surfaces only. |
| iPhone category and MacBook Air base styles | Body declaration at 17 px and about 1.47 line height | Use 17/25 or 17/26 for comfortable web reading. |
| MacBook Air base styles | A section-content declaration with width 980 px | Use a restrained reading/composition width; do not fix all layouts to 980 px. |
| iPhone category styles | Tile radius variable of 28 px | Use larger radii for large feature/media tiles, smaller radii for controls. |
| Sampled button styles | Pill radius declaration of 980 px | Implement pills with a semantic full-radius token. |
| Sampled button styles | Primary blue #0071e3 | Use this as the default filled-action blue, with separate accessible link colors. |
| Sampled site palettes | #1d1d1f, #f5f5f7, #6e6e73 | Use a restrained neutral foundation; verify contrast for each semantic use. |
| Homepage/category markup | Product-led sections, concise headings, limited CTAs, image galleries | Give each marketing section one coherent message and one appropriate next action. |

Sample sources: [W01], [W02], [W03], and their linked stylesheets. Values elsewhere in this document remain project defaults unless explicitly identified as Apple guidance.

## 2. Choose the right profile before designing

### 2.1 Profile matrix

| Surface | Composition | Type emphasis | Density | Material policy |
| --- | --- | --- | --- | --- |
| Marketing homepage | Product/benefit storytelling | 48–80 px display headings | Spacious | Mostly opaque; optional translucent navigation |
| Product detail page | Benefit, proof, details, purchase | 40–72 px hero; 32–48 px sections | Spacious to moderate | Large opaque media tiles |
| Web application | Navigation, task, data | 28–34 px page title; 14–17 px working text | Moderate | Opaque content; restrained floating chrome |
| Dense professional tool | Workspace, selection, inspector | 22–28 px title; 13–16 px supporting UI | Compact, user-selectable when justified | Opaque editor/data surfaces |
| Mobile web app | One main task region | 28–34 px title; 16–17 px body | Comfortable touch density | Simple header/tab navigation |
| Native iOS/iPadOS | System navigation and controls | Semantic Dynamic Type styles | Platform adaptive | System-managed supported materials |
| Native macOS | Windows, toolbars, sidebars, inspectors | Platform text styles | Desktop efficient | System-managed materials |

Numbers in this table are web project defaults except the instruction to use native semantic styles.

### 2.2 Shared visual grammar, different layout

Keep the same brand accent, icon family, typography family, and semantic status meanings across marketing and application surfaces. Permit different type scales, spacing, and containers.

- A dashboard MUST NOT inherit a 120 px marketing section gap between working controls.
- A landing page SHOULD NOT look like a dense settings table.
- A clinical or financial editor SHOULD keep provenance, errors, units, and review state visible.
- A wide desktop workspace MAY use split views even when the marketing site uses centered sections.
- Do not replace functioning tables with decorative cards solely to increase visual similarity.

### 2.3 Default modes

Use three styling modes, all based on the same token system:

1. **Marketing:** Large composition, media, generous section rhythm.
2. **Application:** Balanced working density, clear navigation, readable forms.
3. **Compact:** Data-heavy controls and rows for fine-pointer desktop contexts.

Compact mode MUST still support keyboard use and meaningful target spacing. On coarse-pointer devices, use comfortable targets regardless of density preference.

## 3. Nonnegotiable global rules

1. Use one sans-serif family for the general UI; reserve a monospaced family for code or identifiers.
2. Use semantic colors; never scatter arbitrary hex values through screens.
3. Every screen has one dominant title and one dominant task or content area.
4. Competing primary actions SHOULD be resolved by context, not by making every button filled.
5. Whitespace groups information before decorative containers do.
6. Body text MUST remain readable; do not use faint gray for essential instructions.
7. Content surfaces SHOULD be opaque.
8. Translucency belongs primarily to navigation and floating controls.
9. A meaningful control MUST have a visible or programmatic name.
10. An icon MUST communicate a purpose rather than fill empty space.
11. Touch-oriented actions MUST have a target of at least 44 × 44 CSS px in this web system.
12. Native points and CSS pixels are separate units; do not treat them as physical-pixel equivalents.
13. Keyboard focus MUST be visible.
14. Selected, focused, hovered, pressed, and disabled states MUST remain distinguishable.
15. Interactive meaning MUST NOT depend on color alone.
16. Do not hide required actions exclusively behind hover.
17. Do not block page use with decorative animation.
18. Do not hijack ordinary scrolling.
19. Destructive actions MUST name the object or effect.
20. Keep drafts and user edits through recoverable failures.
21. Loading MUST NOT fabricate completion.
22. A successful server response, not an elapsed timer, determines completion.
23. Long text, localization, empty data, and populated data MUST all fit.
24. Date, currency, number, and time displays MUST follow the user's relevant locale and explicit product timezone.
25. Existing authentication, permissions, and workflows MUST survive the redesign.
26. Native apps SHOULD use native components before custom replicas.
27. Native apps MUST respect relevant system appearance and accessibility preferences.
28. Browser behavior MUST remain browser behavior: usable links, selection, back navigation, and zoom.
29. Avoid copying Apple branding, product photography, marketing copy, proprietary web fonts, or restricted symbols into an unrelated product.
30. Exceptions MUST be specific and documented; “looks better” alone is insufficient.

## 4. Design tokens: naming, values, and rules

### 4.1 Token architecture

Use three layers:

1. **Primitive:** Raw colors, space steps, sizes.
2. **Semantic:** Text-primary, surface-raised, action-primary, border-control.
3. **Component:** Button-height, dialog-width, sidebar-width, field-radius.

Components consume semantic/component tokens. Theme changes update semantics, not every component's CSS.

Names SHOULD describe function, not appearance. Prefer “text-secondary” over “gray-500”; prefer “surface-overlay” over “white-card.”

### 4.2 Default color tokens

All values below are project defaults. Dark colors are deliberate choices, not mathematical inversions.

| Semantic token | Light | Dark | Usage |
| --- | --- | --- | --- |
| canvas | #f5f5f7 | #101012 | App's outer background |
| surface | #ffffff | #1c1c1e | Main content/panel |
| surface-subtle | #f5f5f7 | #242426 | Grouped content and inset areas |
| surface-raised | #ffffff | #2c2c2e | Floating opaque surfaces |
| surface-hover | #efeff2 | #333336 | Neutral hover treatment |
| surface-selected | #e8f2ff | #14365a | Selected neutral/navigation item |
| text-primary | #1d1d1f | #f5f5f7 | Titles, body, field values |
| text-secondary | #616166 | #b7b7bd | Supporting readable text |
| text-tertiary | #68686e | #a1a1a8 | Low-priority but readable metadata |
| text-placeholder | #68686e | #a1a1a8 | Placeholder text, never the sole label |
| text-on-action | #ffffff | #ffffff | Text on the primary filled button |
| action-primary | #0071e3 | #0071e3 | Filled action background |
| action-hover | #0066cc | #0066cc | Filled primary hover |
| action-pressed | #005bb5 | #005bb5 | Filled primary press |
| link | #0066cc | #64acff | Text links and text-only actions |
| focus | #0066cc | #64acff | Focus indication; adjust against the actual substrate |
| border-subtle | #d2d2d7 | #444449 | Decorative dividers |
| border-control | #85858b | #85858b | Required control boundary on default surfaces |
| success-ink | #176b37 | #8ae6a5 | Success text/icon |
| success-surface | #eaf7ee | #173322 | Success background |
| warning-ink | #7a4b00 | #ffd27d | Warning text/icon |
| warning-surface | #fff4dd | #382b16 | Warning background |
| danger-ink | #b4232c | #ff9ca3 | Error/destructive text/icon |
| danger-surface | #fff0f1 | #401c22 | Error background |
| danger-solid | #b4232c | #b4232c | Destructive filled action with white text |
| danger-hover | #a01f27 | #a01f27 | Destructive filled action hover |
| danger-pressed | #891b21 | #891b21 | Destructive filled action press |
| info-ink | #145c9e | #9bcaff | Informational text/icon |
| info-surface | #eaf3ff | #172d47 | Informational background |
| scrim | rgba(0,0,0,0.32) | rgba(0,0,0,0.56) | Modal backdrop |

Rules:

- Do not use the light filled-button blue for ordinary small link text on every light-gray surface; use the darker link token.
- Do not switch to a lighter blue in dark mode while leaving white small button text unchanged without checking contrast.
- Border-subtle is decorative. If a boundary is the only way to identify an input, use border-control or another verified 3:1 distinction.
- Warning surfaces use dark/readable warning ink; do not use bright yellow body text.
- Semantic ink and surface are paired, not interchangeable.
- Placeholder and required metadata receive contrast checks just like ordinary text.
- Disabled appearance MAY use lower contrast but MUST not be used for readable explanatory content.
- Validate composited colors when opacity or materials are involved.
- A custom brand may replace blue through semantic tokens, provided every state still passes contrast and remains distinct from status colors.

### 4.3 Accent distribution

SHOULD use the brand accent for:

- Primary action.
- Selected navigation, where appropriate.
- Text links.
- Active controls and focused elements.
- A small number of product-specific emphasis moments.

SHOULD NOT tint:

- Every heading.
- Every icon.
- Every card border.
- Entire dashboard backgrounds.
- All chart series with similar shades of the accent.

Avoid conflating accent with success. “Selected” and “Successfully saved” are separate meanings.

### 4.4 Spacing scale

| Token | CSS px at baseline | Typical purpose |
| --- | --- | --- |
| space-1 | 2 | Optical adjustment; not ordinary layout |
| space-2 | 4 | Tiny icon/text adjustment |
| space-3 | 6 | Tight inline grouping |
| space-4 | 8 | Icon-label gap, compact internal gap |
| space-5 | 12 | Small control group, card metadata |
| space-6 | 16 | Standard field/card inner spacing |
| space-7 | 20 | Small-screen page inset |
| space-8 | 24 | Standard panel padding and group gap |
| space-9 | 32 | Section subgroup separation |
| space-10 | 40 | Major application grouping |
| space-11 | 48 | Large panel or narrow marketing gap |
| space-12 | 64 | Small-screen marketing section padding |
| space-13 | 80 | Medium marketing section padding |
| space-14 | 96 | Desktop marketing section padding |
| space-15 | 120 | Large hero/feature separation |
| space-16 | 160 | Exceptional editorial composition |

Spacing rules:

- A group's internal gap SHOULD be smaller than the gap to the next unrelated group.
- Label-to-field: 6–8 px. Field-to-helper: 6 px. Field-group-to-field-group: 20–24 px.
- Card title-to-description: 8 px. Description-to-actions: 20–24 px.
- Section title-to-toolbar: 16–24 px. Toolbar-to-content: 16 px.
- Table rows use consistent cell padding, not individually tuned margins.
- Use the token scale for routine layout. Optical exceptions of 1–3 px are allowed for icon alignment.
- Do not add blank blocks merely to make a screen feel premium.

### 4.5 Radius scale

| Token | Default | Use |
| --- | --- | --- |
| radius-xs | 4 px | Small code tags or inner utility details |
| radius-sm | 8 px | Small utility controls |
| radius-md | 12 px | Standard fields, app buttons, compact surfaces |
| radius-lg | 16 px | Application cards and menus |
| radius-xl | 20 px | Dialogs and larger application panels |
| radius-2xl | 28 px | Marketing/media tiles |
| radius-3xl | 32 px | Large feature panels and mobile sheet tops |
| radius-full | 9999 px | Pills, circular controls, avatars |

- Radius follows function and scale. Do not use 28 px corners on a 32 px field.
- Prefer concentric nesting: if an outer rounded panel has radius 28 px and padding 12 px, a contained image MAY use approximately 16 px radius.
- This concentric relation is a visual heuristic; different corner curves and spacing can require optical adjustment.
- Avoid three independently rounded boxes around the same content.
- Keep focus rings outside clipped rounded containers.
- Native platforms SHOULD own their system corner geometry.

### 4.6 Elevation

| Layer | Default light shadow | Default dark shadow | Intended use |
| --- | --- | --- | --- |
| Flat | none | none | Lists, forms, normal content |
| Card | 0 2px 8px rgba(0,0,0,0.04) | none; subtle border if needed | Optional grouping, not every panel |
| Floating | 0 8px 24px rgba(0,0,0,0.12) | 0 8px 24px rgba(0,0,0,0.32) | Menu, popover, floating toolbar |
| Modal | 0 24px 80px rgba(0,0,0,0.20) | 0 24px 80px rgba(0,0,0,0.48) | Dialog and sheet |

Do not combine a heavy shadow, thick border, colored glow, and blur on the same surface. Use one main depth cue and a subtle secondary cue only if needed.

### 4.7 Layer ordering

Project layer defaults:

| Token | z-index | Purpose |
| --- | --- | --- |
| base | 0 | Ordinary content |
| sticky | 100 | Sticky header/column |
| dropdown | 300 | Nonmodal anchored overlay |
| floating | 400 | Floating utility controls |
| modal-backdrop | 600 | Modal scrim |
| modal | 700 | Modal surface |
| toast | 800 | Nonblocking global feedback |
| tooltip | 900 | Tooltip attached to the active surface |
| critical | 1000 | Rare, deliberate emergency/system overlay |

Use isolated app roots and consistent portals. A tooltip opened from a modal MUST be above that modal. Browser top-layer dialog/popover behavior takes precedence over ordinary z-index; do not attempt to solve top-layer stacking by escalating numbers. A modal MUST suppress irrelevant background tooltips.

## 5. Typography

Apple guidance emphasizes legibility, a small number of typefaces, meaningful hierarchy, and text that adapts to user size preferences. Native system styles provide behavior that fixed browser pixels do not. [H02]

### 5.1 Font family

Web default:

~~~css
--font-ui: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
  "Helvetica Neue", Arial, sans-serif;
--font-mono: ui-monospace, "SFMono-Regular", Consolas,
  "Liberation Mono", monospace;
~~~

- Use the platform's installed system font through the browser.
- Do not download and bundle Apple's website SF font files.
- If the project already uses a licensed neutral sans-serif, keep it when its metrics and readability work; retune the type scale.
- Do not force SF Pro Rounded for the entire interface. Rounded typography is a distinct stylistic choice.
- Use a serif only for an intentional editorial surface, never as a random variation between cards.
- Avoid a font CDN dependency for the basic UI when a system font serves the purpose.
- Test Windows, Linux, and Android fallbacks; the design MUST not rely on SF-only widths.
- Do not apply aggressive font-smoothing overrides as a substitute for contrast or correct weights.

### 5.2 Application type scale

Values are size/line-height in CSS px at the default root size:

| Role | Desktop | Narrow screen | Weight | Tracking |
| --- | --- | --- | --- | --- |
| Page title | 32/38 | 30/36 | 600 | -0.02 em |
| Major section | 24/30 | 22/28 | 600 | -0.015 em |
| Subsection | 20/26 | 20/26 | 600 | -0.01 em |
| Card title | 17/23 | 17/23 | 600 | -0.005 em |
| Reading body | 17/26 | 17/26 | 400 | 0 |
| Working body | 15/22 | 16/24 | 400 | 0 |
| Control label | 15/20 | 16/22 | 500 | 0 |
| Supporting metadata | 13/18 | 14/20 | 400 | 0 |
| Small annotation | 12/17 | 13/18 | 400–500 | 0 |
| Prominent metric | 34/40 | 30/36 | 600 | -0.025 em |
| Code | 13/20 | 14/21 | 400 | 0 |

Use rem-based sizes in implementation so browser text preferences can influence the scale. The pixel equivalents above communicate the baseline, not a prohibition on scaling.

### 5.3 Marketing type scale

| Role | Wide | Medium | Narrow | Weight |
| --- | --- | --- | --- | --- |
| Hero display | 72–80 / 1.05 | 56–64 / 1.06 | 40–48 / 1.08 | 600 |
| Major section | 48–56 / 1.08 | 40–48 / 1.10 | 32–36 / 1.12 | 600 |
| Feature title | 28–32 / 1.15 | 26–28 / 1.18 | 24–28 / 1.20 | 600 |
| Intro paragraph | 24–28 / 1.25 | 22–24 / 1.30 | 19–21 / 1.40 | 400–500 |
| Standard body | 17–19 / 1.5 | 17–19 / 1.5 | 17 / 1.5 | 400 |
| Eyebrow | 14–17 / 1.3 | same | same | 500–600 |
| Legal/support | 12–13 / 1.5 | same | 12–14 / 1.5 | 400 |

- Use one selected value per role in the project's tokens; ranges are selection guidance.
- Display tracking: start at -0.02 em, review at each breakpoint.
- Do not apply display tracking to body text.
- Marketing headings SHOULD describe one idea and fit naturally in 1–3 lines.
- Avoid forced line breaks in shared copy; use width control and balanced wrapping where supported.
- At a narrow width, reduce display type before allowing a single long word to break the page.
- Do not shrink essential legal conditions below readability thresholds.

### 5.4 Hierarchy and paragraph rules

- One H1 per page or primary route is the default semantic pattern.
- Subordinate headings MUST follow an understandable outline.
- Visual size and heading semantics are related but not identical; do not use H1 for every large number.
- Reading passages: target 55–75 characters per line; approximately 65ch is the initial max-width.
- Short hero paragraphs: generally 35–55 characters per line.
- Body paragraph gaps: 0.8–1.1 times the line height.
- Left-align working content in left-to-right locales; use logical alignment for right-to-left locales.
- Centered text is reserved for short marketing compositions, empty states, or short confirmations.
- Do not center long instructions, large forms, data tables, or document editors.
- Use tabular numerals for aligned amounts, timers, and changing metrics.
- Use regular numerals for ordinary prose unless a deliberate type treatment requires otherwise.
- A caption MUST remain close enough to its related object that the relationship is clear.

### 5.5 Truncation and text growth

- Truncate optional metadata when space requires it; reveal the full value through a suitable accessible detail view.
- Do not truncate errors, consent choices, critical amounts, deadlines, or destructive-action labels.
- A tooltip is insufficient for exposing essential truncated text to touch users.
- Buttons MAY wrap into two lines when necessary; they MUST not clip or overlap.
- Use minimum heights rather than fixed heights for text-bearing controls.
- Avoid fixed-height cards when descriptions vary.
- Reserve up to 50% expansion in common control labels as a stress test, without claiming this covers all languages.
- For native apps, support relevant Dynamic Type/accessibility sizes. For web, verify text zoom and reflow rather than claiming Dynamic Type support.

## 6. Layout, alignment, and responsive behavior

Apple guidance favors intentional ordering, alignment, grouping, progressive disclosure, and layouts that adapt across device and window configurations. [H03]

### 6.1 Container widths

| Container | Project default | Purpose |
| --- | --- | --- |
| Reading | 65ch; cap around 760 px | Documents, explanations |
| Form | 560–680 px | Single-column forms |
| Standard app | 1200 px | Content-focused application |
| Wide app | 1440 px | Tables, calendar, analytics |
| Marketing composition | 1120 px | Headlines, copy, aligned feature groups |
| Marketing wide media | 1440 px | Hero media and large galleries |
| Full-bleed media | Viewport | Intentional product presentation |

Do not place a 1440 px table inside a 560 px form container. Do not stretch reading copy across the full viewport.

### 6.2 Page insets

- Under 600 px: 20 px baseline inset; 16 px permitted for compact app layouts.
- 600–899 px: 24 px.
- 900–1199 px: 32 px.
- 1200 px and above: 40–48 px outside a centered max-width container.
- Edge-to-edge lists MAY extend to the viewport while their text retains the same inset.
- Respect device safe areas for fixed controls and full-bleed layouts.
- Horizontal overflow MUST be intentional and local to a table, code block, or media track.

### 6.3 Default breakpoint behavior

These are project breakpoints, not Apple's official breakpoint system:

| Width | Main behavior |
| --- | --- |
| Below 600 px | One content column; touch targets; compact header; narrow dialog/sheet; stacked form groups |
| 600–899 px | Two-column cards when content permits; collapsible navigation; single primary workspace |
| 900–1199 px | Sidebar may persist; two-column workspace; inspector may collapse |
| 1200 px and above | Persistent navigation and optional inspector; full working composition |

Use content-driven breakpoints when a component stops fitting before these values. A sidebar, toolbar, or table MAY adapt through container queries independent of the full page width.

### 6.4 Application shell

Wide default:

- Sidebar: 240 px initial width; acceptable project range 220–280 px.
- Main content: flexible, minimum width 0.
- Optional inspector: 320 px initial width; acceptable range 280–380 px.
- Main toolbar/header: minimum 64 px, with content-driven growth.
- Page heading block: 24–32 px top/bottom rhythm.
- Main content padding: 24–32 px.
- Sidebar has its own bounded scroll area only when necessary.
- The content pane SHOULD have one clear main scrolling region.

When space is insufficient:

1. Hide or convert the inspector to a drawer.
2. Convert the sidebar to collapsible navigation.
3. Stack working panes in a sensible task order.
4. Preserve access to data and actions; do not simply remove columns or features.

### 6.5 Grid rules

- Marketing: 12-column conceptual grid on wide screens; 6 on medium; 1–2 content columns on narrow.
- Applications: use task-driven CSS Grid/Flex layouts rather than forcing every screen into 12 columns.
- Standard card gap: 24 px wide, 16 px narrow.
- Dense dashboard gap: 16–20 px.
- Large feature tile gap: 24–32 px.
- Align card headings, main values, and actions across a repeated row where content allows.
- Avoid arbitrary asymmetry; a large tile should be large because it is more important or needs more content.
- Grid children MUST set min-width: 0 when their content can overflow.
- Auto-fit grids MUST maintain a useful minimum card width; start at 280 px for information cards.

### 6.6 Sticky regions

- Sticky headers MUST not obscure focused elements or anchored headings.
- Set scroll-padding and scroll-margin to account for the current sticky stack.
- Sticky table headers SHOULD remain inside the table's scrolling context.
- Prefer at most two simultaneous top sticky bars.
- If two bars exist, their combined height MUST be computed rather than guessed.
- Avoid fixing a marketing CTA over important content at every scroll position.
- Bottom controls MUST account for the home-indicator safe area and the on-screen keyboard.

### 6.7 Reflow requirements

- Main reading and form content MUST reflow without two-dimensional scrolling at a 320 CSS px viewport.
- Genuine tables, diagrams, maps, and code MAY use a clearly bounded horizontal region when two-dimensional layout is essential.
- At 200% text size, labels, buttons, alerts, and key values MUST remain available.
- At 400% browser zoom on a typical desktop viewport, the equivalent narrow layout MUST remain usable.
- Do not disable zoom in viewport metadata.
- Do not lock orientation unless a core feature genuinely requires it.
- Native iPad/macOS windows MUST adapt to actual available space, not just named device models.

## 7. Surfaces, borders, and materials

### 7.1 Opaque content as the baseline

Use opaque surfaces for:

- Data tables.
- Form fields.
- Document and code editors.
- Financial/clinical records.
- AI responses and review panels.
- Dense status regions.
- Charts where exact reading matters.

Separation SHOULD come from background contrast, grouping, alignment, and spacing. Add a border only when the content benefits from one.

### 7.2 Grouping treatment

Choose one primary grouping treatment per area:

1. Whitespace and heading.
2. Subtle surface change.
3. Thin separator.
4. Rounded panel.
5. Elevated surface.

Do not automatically put each paragraph, label, and action in its own rounded card. Adjacent settings rows are often better as one grouped panel.

### 7.3 Liquid Glass: intent and boundary

Apple's HIG places Liquid Glass in a functional layer for navigation and controls above content, advises restraint, and distinguishes regular/clear variants. It explicitly warns against filling the content layer with that material. [H04]

Project interpretation:

- Glass MAY be used for a sticky navigation bar, floating toolbar, media control cluster, or contextual control surface.
- Glass MUST NOT be the default fill for every dashboard tile, form, table, or editor.
- A web blur/translucency approximation MUST NOT be described as equivalent to the native adaptive material.
- Use the regular/readable treatment for text-heavy chrome.
- Use a clearer treatment only over appropriate visually rich media after testing worst-case contrast.
- Content remains the focal layer.
- A material MUST not make critical controls difficult to identify.
- Large sidebar materials MAY become more opaque to maintain readability.
- Do not stack several independently blurred surfaces over one another.

### 7.4 Web material recipe

Project defaults:

- Light chrome background: rgba(255,255,255,0.88).
- Dark chrome background: rgba(28,28,30,0.90).
- Blur: 20 px as a starting value; acceptable tuning range 12–24 px.
- Saturation: at most 1.2 for this restrained recipe.
- Bottom/edge separator: 1 px semantic subtle border.
- No refraction shaders in the default component set.
- No animated light streaks or cursor-tracking reflections.
- Opaque fallback MUST work when backdrop-filter is unavailable.
- Reduced-transparency or higher-contrast preferences MUST remove unnecessary translucency where detectable.
- Provide a product-level reduce-effects preference only when needed for platforms that cannot expose the relevant OS setting.

Test the real composited surface over white, black, bright color, fine patterns, photos, and moving media. A blur radius alone does not guarantee contrast.

### 7.5 Native material rules

- Prefer the relevant SwiftUI/UIKit/AppKit components and supported material APIs.
- Do not manually reproduce system refraction or animate native glass through custom browser-like shaders.
- Do not put custom opaque/tinted backgrounds behind native toolbars if they interfere with platform-managed appearance.
- Respect availability and deployment targets; provide sensible older-OS behavior.
- Test Reduce Transparency, Increase Contrast, Reduce Motion, and both appearance modes on applicable platforms.
- Do not require a single pixel-identical appearance across OS versions.

## 8. Icons, imagery, and brand

### 8.1 Interface icons

Apple guidance emphasizes simplified recognizable shapes, consistent detail and weight, and optical alignment. [H05]

Project defaults:

- One icon family per interface.
- Base working icon: 20 px.
- Small inline icon: 16 px.
- Main navigation icon: 20–22 px.
- Touch toolbar icon: 22–24 px inside a 44 px target.
- Large empty-state symbol: 40–48 px.
- SVG outline stroke: start at 1.75 px at a 24 px artboard; tune the chosen library consistently.
- Match nearby text weight and visual intensity.
- Keep icon-to-label gap 8 px for normal controls, 6 px for small inline actions.
- Align optically; a triangle, arrow, or asymmetric symbol may need a small adjustment.
- Use currentColor when possible.
- Avoid emoji as the standard navigation or status icon system.
- Do not mix filled, thin-outline, 3D, and multicolor icons without a semantic reason.

### 8.2 Icon meaning and accessibility

- A familiar search symbol may stand alone with an accessible label.
- An ambiguous custom action SHOULD include visible text.
- Icon-only destructive actions MUST expose a clear accessible name and a safe activation context.
- Decorative icons use hidden semantics so screen readers do not repeat the label.
- Toggle buttons MUST announce pressed/selected state.
- Do not use only a changing icon to communicate a critical status; pair it with readable text.
- Tooltip text MUST match the action's accessible name.
- A plus symbol needs context: “Add employee,” “New document,” or “Create booking.”

### 8.3 SF Symbols and assets

- Native Apple apps MAY use SF Symbols according to availability and the applicable usage terms.
- Web apps SHOULD use an appropriately licensed icon set already supported by the project.
- Do not extract Apple-only symbols, product logos, or restricted symbol assets for generic web branding.
- Check the terms for fonts, symbols, and design resources before redistributing them. [H06], [R01], [R02]
- Keep the project's own name, logo, and identity. Visual inspiration does not imply affiliation.

### 8.4 Product and editorial imagery

- Use original or licensed imagery.
- Prefer one visually strong image over several small competing images.
- Use consistent lighting, framing, and color treatment within a gallery.
- Product image fit: contain when the whole object matters; cover for contextual/lifestyle images.
- Specify object-position for meaningful crops.
- Use a stable aspect ratio to prevent loading shifts.
- Do not stretch or distort images to fill a card.
- Text over imagery requires a controlled readable region or verified scrim.
- Decorative images use empty alternative text; informative images receive a concise meaningful description.
- Product diagrams or data graphics require exact labels and data; decorative AI imagery is not a substitute.
- Reserve transparent cutouts for compositions that benefit from them; do not float every object over a gradient.

### 8.5 Brand restraint

Let branding appear through:

- A deliberate accent.
- A recognizable logo in expected locations.
- Consistent language.
- Original photography/illustration.
- One or two meaningful signature treatments.

Avoid a large persistent logo that displaces task content, repeated slogans inside tools, or a full brand-color wash across every screen. Familiar controls SHOULD retain familiar behavior even when restyled. [H07]

### 8.6 App identity, favicon, and native icon assets

- An app icon expresses the project's own identity through a simple recognizable silhouette.
- Keep small favicon artwork readable at 16–32 px; do not shrink a detailed marketing illustration into it.
- Provide appropriate web app icon/manifest assets when the product supports installation.
- A monochrome small mark MAY differ from the full-color larger app icon while retaining identity.
- Verify the icon against light and dark browser/system contexts.
- Do not bake a browser-like rounded tile into every favicon if it harms small-size recognition.
- Native app icons use the platform's required asset process and current appearance variants.
- Current Apple guidance supports layered native icons with system-applied material effects; use the native pipeline rather than painting fake specular highlights into every raster. [H56]
- Do not pre-apply a system mask or add a fake rounded outer frame when the platform supplies one.
- Native light/dark/tinted appearances require deliberate legibility checks.
- Avoid tiny text, screenshots, and excessive symbolic detail.
- The in-app logo SHOULD remain simpler and smaller than a marketing hero asset.

## 9. Buttons and actionable links

Apple guidance calls for a clear purpose, a press state, and prominence for the likely action. Native hit regions follow platform guidance; this spec uses a separate touch-friendly web baseline. [H08], [R03]

### 9.1 Button variants

| Variant | Appearance | Appropriate use |
| --- | --- | --- |
| Primary | Filled action color; white text | Main commit/create/continue action |
| Secondary | Neutral fill or control border; primary text | Alternative action of normal importance |
| Tertiary | Text/icon; no persistent panel fill | Supporting action |
| Destructive | Danger text; filled danger only for the final critical action | Delete, revoke, permanently remove |
| Icon | Consistent glyph within a real target | Familiar toolbar utilities |
| Marketing CTA | Pill; restrained filled or outlined treatment | Product next step |

- Default app button: minimum height 44 px, horizontal padding 16 px, radius 12 px, label 15/20 at weight 500.
- Large app action: minimum 48 px, horizontal padding 20 px.
- Compact desktop visual button: minimum 36 px, horizontal padding 12 px. Ensure sufficient usable target spacing; on coarse pointers switch to 44 px.
- Marketing action: minimum 44–48 px, horizontal padding 20–24 px, full radius.
- Icon button: 44 × 44 px touch target; glyph 20–24 px.
- A narrow screen's principal form submission MAY be full width.
- Do not make desktop toolbar buttons full width without a layout reason.
- Do not make the secondary button smaller just to establish hierarchy; use appearance.
- Use at most one visually dominant primary action per task region. Separate independent regions may each have a primary action.

### 9.2 State matrix

| State | Required response |
| --- | --- |
| Rest | Clear label and appropriate visual prominence |
| Hover | Subtle background/border change; no layout shift |
| Pressed | Distinct darker fill or inset tonal response; optional very small scale for infrequent actions |
| Focus-visible | 2 px clear outline, usually 3 px offset; verified contrast |
| Disabled | Muted appearance; real disabled/aria-disabled semantics; contextual reason when useful |
| Busy | Stable width; indicator and specific label; prevent duplicate submission |
| Success | A truthful completion state with next-step context if needed |
| Error | Recoverable context near the action; preserve input |

- Pointer-down feedback SHOULD appear immediately.
- Do not animate button width when swapping “Save” for “Saving…”.
- Preserve an accessible name while busy.
- If disabled controls need to remain discoverable, use an appropriate pattern and explanatory text; aria-disabled alone does not prevent activation.
- If focus must remain on a busy action, implement the state deliberately rather than dropping focus through an unexpected native disabled transition.
- Press scale, when used, SHOULD not exceed a reduction to 0.98. Do not apply it to precision tools or cause visible text blur.
- Do not apply a decorative gradient or glow to every primary button.

### 9.3 Label rules

Use a specific verb: “Create booking,” “Save changes,” “Send request,” “Approve draft.”

- “OK” is suitable only when acknowledgment is truly the whole action.
- “Submit” is acceptable when the object is obvious; prefer a more specific verb.
- “Continue” MUST have a clear destination or next step.
- “Done” MUST match an actual completed or committed state.
- Cancel and close are different when edits would be discarded.
- Avoid duplicated icons next to clear short text unless they improve recognition.
- Do not append a chevron to actions that do not navigate or disclose.

### 9.4 Links

- Use anchors for navigation and downloads; use buttons for actions.
- Text links MUST be distinguishable by more than an inaccessible color difference when placed inside ordinary prose. An underline is the safe default.
- Standalone navigation/action links MAY omit the persistent underline if their context is unambiguous and focus/hover treatments remain clear.
- Hover underline SHOULD not change layout.
- Indicate an external destination when it changes the user's expectations; do not decorate every link with an external icon.
- If opening a new tab, make that behavior accessible and justified.
- Preserve browser open-in-new-tab and copy-link behavior.

## 10. Navigation

### 10.1 Marketing global navigation

Project defaults:

- Desktop minimum header height: 48 px.
- Narrow header minimum height: 52 px.
- Content width aligns with the site's composition grid.
- Logo remains compact and optically aligned with navigation.
- Use 4–7 top-level destinations as a starting point; simplify or group according to the actual information architecture.
- Desktop labels: 13–14 px with sufficient contrast.
- Header background MAY be subtly translucent.
- Navigation items retain usable focus and touch targets even when their visible labels are small.
- Desktop flyouts open through deliberate activation, with hover support optional.
- Hover-open menus need a short tolerance and a stable path into the panel; the pointer MUST not lose the panel while crossing a small gap.
- Escape closes an expanded navigation panel and restores focus to its trigger.
- Keyboard users MUST be able to reach every destination.
- On narrow screens use an explicit menu button and a full-height panel or spacious drawer.
- Preserve product-specific/local navigation only when it serves a real second level of hierarchy.

### 10.2 Application sidebar

- Initial width: 240 px.
- Row minimum: 44 px comfortable; 36 px compact fine-pointer.
- Horizontal padding: 12–16 px.
- Icon: 20 px; icon-label gap: 10–12 px.
- Row radius: 10–12 px.
- Item label: 14–15 px.
- Group heading: 12–13 px, semibold, readable secondary color.
- Group-to-group gap: 24 px.
- Selected row uses selected surface and clear primary/accent text; programmatically mark the active route.
- Do not use a badge or colored dot on every item.
- Prefer no more than two visible hierarchy levels; deeper content can move into a content list/detail structure.
- Collapse groups through disclosure controls whose state is clear.
- Persist user collapse/pin preferences when useful.
- Hiding the sidebar MUST leave an obvious way to restore it.
- Account/workspace switching belongs in a stable location, separate from content selection.

The HIG's sidebar discussion supports a shallow, understandable hierarchy and context-preserving navigation. [H09]

### 10.3 Top tabs, bottom tabs, and segmented controls

These MUST have different semantic jobs:

| Pattern | Job | Example |
| --- | --- | --- |
| Navigation tabs | Move among sections or sibling pages | Overview / Activity / Settings |
| Bottom app tabs | Switch among top-level mobile destinations | Home / Schedule / Inbox |
| Segmented control | Change a closely related view or option | Day / Week / Month |
| Toolbar | Perform actions | Add / Export / Share |

- Do not place “Create” in a bottom tab bar as if it were a destination.
- Mobile bottom navigation default: 3–5 destinations, with short labels.
- Each destination uses a readable icon and visible label.
- Bar minimum height: 64 px plus bottom safe area for this web system.
- Each item has at least a 44 px target.
- Keep navigation stable even when a destination is empty; explain the empty state.
- Preserve a destination's scroll/filter state where reasonable.
- Do not hide a frequently used section in a generic “More” destination merely to retain an arbitrary tab count.
- Native iPad tab/sidebar adaptation SHOULD use system patterns.
- Native tabs and toolbar styles SHOULD follow the current OS rather than hard-coded web measurements. [H10]

### 10.4 Breadcrumbs and back

- Breadcrumbs describe hierarchy, not the entire click history.
- Use 13–14 px text and restrained separators.
- The current item is text, not a redundant link to the same view.
- On narrow screens, a contextual back link may replace a long breadcrumb chain.
- Back returns to the relevant previous context, preserving user work and useful filters.
- Browser Back SHOULD work in routed web applications.
- Never use “Back” as a synonym for canceling and discarding a form.
- Title, route, and selected navigation MUST agree.

## 11. Toolbars, menus, and contextual actions

### 11.1 Toolbar composition

- Place common actions visibly.
- Group related controls with 8–12 px internal gaps and 20–24 px between groups.
- Use a divider only when grouping is still unclear.
- Keep the primary action distinct from utility icon clusters.
- At narrower widths, move lower-priority actions to an explicitly labeled overflow menu.
- Preserve the ordering of remaining actions.
- Do not clip toolbar controls or create unlabeled horizontal overflow.
- Keep document/context title close to the working area.
- Show selection-specific actions when a selection exists; avoid disabled action clutter when context can explain availability.
- Native macOS professional tools MAY support toolbar customization.

Apple advises deliberate toolbar content, standard controls, and restraint around custom backgrounds and tinting. [H11]

### 11.2 Menu dimensions

Project defaults:

- Width: fit content; initial min-width 200 px, normal max-width 320 px.
- Container padding: 6 px.
- Radius: 14–16 px.
- Fine-pointer item minimum height: 36 px.
- Touch item minimum height: 44 px.
- Item horizontal padding: 10–12 px.
- Icon-label gap: 10 px.
- Group separator: 1 px, with 6 px vertical spacing.
- Shortcut annotation: readable secondary text, aligned to trailing edge.
- Floating elevation; opaque fallback.

### 11.3 Menu behavior

- Trigger announces expanded state and controls the menu.
- Context menus supplement discoverable actions; they MUST not be the only route to essential operations.
- Separate selection choices from commands through grouping.
- Use check/radio indicators for persistent selection.
- Place destructive commands in a distinct final group.
- Avoid deeply nested submenus; one nested level is the default maximum in this web system.
- An actual ARIA menu uses menu keyboard behavior: arrows, Home/End, Escape, and suitable character navigation.
- Ordinary website navigation MUST NOT use menu roles solely because it visually resembles a dropdown.
- Do not put a general multi-field form inside an action menu.
- Disabled items need appropriate semantics; omit irrelevant commands when their presence gives no useful context.
- Selecting a command normally closes the menu; selection toggles may remain open when that supports efficient multi-selection.
- Place the panel within the viewport and flip its anchor when needed.
- Anchored menus MUST not cause page scroll jumps.

Source direction: [H12], [H13], [H14], [H15].

## 12. Forms, text fields, and validation

### 12.1 Field anatomy

A complete field has:

1. Persistent label.
2. Input control.
3. Optional example or formatting guidance.
4. Validation/help state when relevant.

Project defaults:

- Label: 14–15 px, weight 500.
- Label-to-input gap: 6–8 px.
- Input minimum height: 44 px; 48 px when it improves a main mobile form.
- Input horizontal padding: 12–14 px.
- Input text: 16 px baseline, especially on mobile Safari.
- Radius: 12 px.
- Border: 1 px border-control, unless another verified boundary identifies the field.
- Background: surface.
- Helper/error text: 13–14 px; 6 px gap.
- Field-group spacing: 20–24 px.
- Single-column form is the default.

Apple's text field guidance covers small inputs, separate labels when needed, appropriate validation timing, and logical tab order. [H16]

### 12.2 Field states

| State | Treatment |
| --- | --- |
| Empty | Label remains; helpful optional placeholder |
| Populated | Primary readable text |
| Hover | Subtle boundary emphasis |
| Focus | Strong visible focus; caret and selection preserved |
| Invalid | Error message and semantic invalid state; boundary/icon may reinforce |
| Read-only | Readable value; explicit editing limitation when necessary |
| Disabled | Unavailable interaction; explanation nearby when meaningful |
| Loading options | Scoped indicator, stable field geometry |
| Success | Use only when explicit validation benefits the user |

Do not add green checkmarks to every field simply because it is nonempty.

### 12.3 Label and placeholder rules

- Placeholder text is an example or hint, not a substitute for a label.
- Do not embed required instructions solely in a placeholder that disappears.
- Label selects/focuses its control.
- Optional indicators use a consistent convention.
- Required indicators are programmatically associated with the input.
- If all fields are required, a single clear statement may be better than repeated asterisks.
- Avoid floating labels unless they remain readable, accessible, and consistent through autofill and errors.

### 12.4 Input mechanics

- Select suitable input type, inputmode, autocomplete, autocapitalize, and spellcheck values.
- Passwords MUST support paste and password managers.
- Password reveal uses an explicit labeled button and does not lose cursor position.
- Email, code, URL, and identifier fields SHOULD not apply unwanted capitalization.
- Numeric input MUST handle legitimate decimal separators, signs, and locale formatting.
- Do not use a number input when an identifier can contain leading zeros.
- Phone numbers MUST not assume one country's length if international users are supported.
- Dates and times MUST state relevant timezone when ambiguity matters.
- Amounts MUST show the currency or unit.
- Do not invent a custom date/picker solely for cosmetic matching when a native input is suitable.
- Pasted values SHOULD be normalized conservatively without silently altering meaning.
- IME composition MUST work without premature submission or broken search.

### 12.5 Validation timing

- Validate format on blur or after a meaningful completion point.
- After an error appears, update it as the user fixes the value.
- Use real-time feedback when essential, such as password requirements, without repeatedly interrupting typing.
- On submit, show a concise summary when several fields fail.
- Focus the error summary or first invalid field through a deliberate accessible pattern.
- Link summary errors to the corresponding fields.
- Keep errors visible until corrected or superseded.
- Do not clear the form after failed submission.
- Server validation errors MUST map to the relevant field or task.
- Differentiate invalid input, permission failure, network failure, and server failure.

Example error: “Enter an end time after the start time.” Avoid “Invalid value.”

### 12.6 Form layout and commit

- Related short fields MAY share a row on wide screens.
- Stack them on narrow screens in the same logical order.
- Address/country/postcode forms SHOULD follow supported locale needs.
- Place form actions directly after the content they commit.
- A long form MAY use a sticky action region if it does not obscure content.
- If autosaving, show an honest save state and avoid a competing unexplained “Save” button.
- If explicit save is required, clearly identify pending changes.
- Optional advanced settings belong in disclosure groups.
- Do not hide prerequisites needed to complete the current action.

## 13. Choice controls and pickers

### 13.1 Selection pattern

| Need | Preferred control |
| --- | --- |
| One choice among 2–5 short visible options | Radio group or segmented control |
| Several independent choices | Checkboxes |
| One persistent setting with immediate effect | Switch |
| One choice from a longer list | Select/combobox |
| Continuous approximate value | Slider |
| Precise numerical value | Numeric field with optional stepper |
| Date/time | Appropriate native control or accessible calendar/time picker |

### 13.2 Checkbox and radio

- Use real native inputs when possible.
- Whole label row is clickable.
- Visible indicator: approximately 18–20 px; row target at least 44 px for touch.
- Indicator-to-label gap: 10–12 px.
- Labels wrap; controls align to the first text line.
- Indeterminate checkbox state MUST reflect partial group selection.
- Radio groups need a clear group label.
- Do not use a checkbox to represent an action that occurs immediately without persistent state.
- “Select all” MUST specify whether it applies to the current page, filtered results, or the entire dataset.

### 13.3 Switch

- Web default visible track: 48–52 px wide × 28–32 px high.
- Thumb: approximately track height minus 4 px.
- Target: at least 44 px high, typically through its labeled row.
- Label MUST say the setting, not “Toggle.”
- State is programmatically available.
- On color reinforces a textual/semantic state; off remains visible.
- If changing a switch triggers a network save, show pending/failure and restore the actual state when needed.
- Do not show a switch for irreversible approval, payment, or deletion.
- Dependent settings remain understandable when the parent is off.

### 13.4 Segmented control

- Default 2–4 segments; use another pattern when labels become crowded.
- Minimum outer height: 40 px fine-pointer, 44 px touch.
- Outer radius: 12 px or full radius if the shell is a pill.
- Container padding: 3–4 px.
- Segments generally equal width.
- Selected segment uses an opaque/contrasting fill or clear indicator.
- Labels: 14–15 px.
- Selection MUST be accessible as radio, tabs, or pressed state according to the actual job.
- Do not mix navigation, view selection, and immediate commands in one control.
- Avoid animating a sliding highlight in a way that delays selection.

The HIG allows varied segmented-control behaviors by platform; this web system chooses fewer options for legibility. [H17]

### 13.5 Select, combobox, and picker

- A select's visible value MUST match the stored value or explain a pending change.
- A searchable combobox supports typed search, active option, keyboard selection, and no-results feedback.
- Custom listboxes MUST implement the relevant keyboard and screen-reader pattern.
- Do not virtualize options without preserving active-option semantics.
- Use a placeholder distinct from a real selected value.
- Long options wrap or expose full text through a reachable detail.
- Multi-select shows selected values and an accessible clear/remove action.
- Removing a chip MUST not unexpectedly close the picker.
- Calendar grids label month/year, expose today's date and selected date distinctly, and support keyboard movement.
- Date range controls expose both endpoints and invalid-range feedback.
- Prefer native behavior over a fragile custom replica.

### 13.6 Slider and stepper

- Slider track: approximately 4–6 px visually; usable target at least 44 px high.
- Thumb: approximately 20–24 px, with clear focus.
- Show the value and unit when precision matters.
- Allow keyboard adjustment and define meaningful step/min/max values.
- Provide a direct numeric field when exact entry matters.
- Do not use sliders for credit-card amounts, dosages, or other values where accidental change has serious consequences.
- Stepper buttons have explicit “Increase…” and “Decrease…” labels.
- Holding a stepper MAY repeat changes at a controlled rate; respect bounds.
- Changes are recoverable and do not repeatedly submit unrelated backend work.

Sources: [H18], [H19], [H20], [H21].

## 14. Cards, lists, and tables

### 14.1 Application cards

- Radius: 16–20 px.
- Padding: 20–24 px wide, 16–20 px narrow.
- Background: surface.
- Border/shadow: one subtle grouping treatment, if needed.
- Title: 17/23 semibold.
- Supporting text: 14–15/21–22.
- Internal vertical gap: 8–16 px, based on relation.
- Actions sit near the content they affect.
- A clickable card MUST have correct link/button semantics.
- Do not make the whole card clickable when it contains unrelated nested actions unless event/semantic behavior is carefully resolved.
- Do not nest a button inside an anchor.
- Hover SHOULD not cause a large lift; optional movement is at most 2 px.
- A data card MAY have no shadow at all.

### 14.2 Marketing feature tiles

- Radius: 28 px baseline.
- Padding: 32–48 px wide, 24 px narrow.
- Main title: 28–32 px.
- Preserve a clear headline/media relationship.
- Minimum height follows the composition, not an arbitrary equal-height requirement.
- Image crop MAY occupy most of the tile, but the text MUST remain readable.
- A plus/disclosure control reveals actual detail rather than a decorative dead end.
- If the tile opens a dialog, follow full dialog behavior.
- Do not make every tile a different pastel/gradient surface.

### 14.3 Lists

- Comfortable one-line row: minimum 48–52 px.
- Two-line row: minimum 64–72 px.
- Fine-pointer compact row: 36–40 px when justified.
- Horizontal row padding: 16–20 px.
- Primary text: 15–17 px.
- Secondary text: 13–14 px.
- Leading icon/avatar and text align consistently.
- Separator MAY begin at the text edge to reinforce grouping.
- Selected rows have persistent feedback.
- Action rows and navigation rows MUST behave differently and indicate their purpose.
- Swipe gestures MAY supplement visible actions, never replace them.
- Long row titles should usually wrap to two lines before truncating.
- Hover-only row actions need an always-available keyboard/touch route.

### 14.4 Data tables

Project defaults:

- Header minimum height: 40–44 px.
- Comfortable row minimum: 48 px.
- Compact row minimum: 36–40 px, fine-pointer only.
- Cell horizontal padding: 12–16 px.
- Header text: 12–13 px, weight 500–600.
- Cell text: 14–15 px.
- Numeric cells: trailing aligned, tabular numerals.
- First identifying column: leading aligned.
- Borders: subtle row separators; avoid a heavy grid around every cell.
- Alternating row fill is optional and very restrained.

Behavior:

- Sort buttons identify the column and current direction.
- Sorting MUST be stable and reflect real data order.
- Checkbox selection is separate from opening a row.
- Bulk actions appear with the count and selection scope.
- Rows with multiple controls need a coherent tab order.
- Do not place an interactive element inside another interactive element.
- Sticky identifying columns MUST not obscure scrolled content.
- Show total count and pagination/loading state where relevant.
- Virtualization MUST preserve reading order, focus, selection, and accessible row context.
- Empty cells use a consistent meaningful indicator; do not imply zero when the value is unknown.
- Missing, zero, not applicable, and unavailable are different states.
- Units belong in headers or values consistently.
- Large amounts MUST not be truncated ambiguously.

### 14.5 Table adaptation on narrow screens

Choose deliberately:

1. Bounded horizontal scrolling when comparison across columns is essential.
2. A summarized list/detail pattern when the core task is opening records.
3. User-selectable columns when information density is configurable.

Do not silently remove important columns. A stacked “card table” must keep each label associated with its value and preserve sorting/filtering and row actions.

The HIG recognizes lists for hierarchy and tables for complex multicolumn productivity data. [H22]

## 15. Dialogs, sheets, and drawers

### 15.1 Choose the correct surface

| Task | Preferred pattern |
| --- | --- |
| Small contextual choice | Menu or popover |
| Short related form | Dialog/sheet |
| Irreversible confirmation | Focused confirmation dialog |
| Large editor or long multistep task | Dedicated page/workspace |
| Additional object details | Inspector/drawer or detail route |
| Temporary critical interruption | Alert |

Use modality only when a focused decision benefits the task. Avoid turning every detail link into a modal. [H23], [H24]

### 15.2 Desktop dialog dimensions

- Small confirmation: 360–420 px width.
- Standard short form: 480–560 px.
- Wide focused dialog: up to 720 px, only when its content needs the width.
- Maximum width: viewport minus 32–48 px.
- Maximum height: viewport minus 48 px.
- Radius: 20–24 px.
- Padding: 24 px baseline.
- Title: 20–24 px, semibold.
- Title-to-body gap: 12–16 px.
- Body-to-actions gap: 24 px.
- Action gap: 8–12 px.
- Action order follows the platform/product convention and remains consistent.
- The content area scrolls if needed; the title and actions MAY remain fixed inside the dialog.

### 15.3 Mobile sheet

- Full-width or near-full-width panel.
- Top radius: 28–32 px.
- Inner inset: 20–24 px.
- Respect top and bottom safe areas.
- Use a clear title and explicit dismissal.
- A drag handle, if present, is supplementary.
- A long/complex task SHOULD become a full-screen view or normal route.
- Do not require a precision drag to dismiss or expand.
- Account for the keyboard so the active input and commit action remain reachable.
- Do not allow a bottom sheet to hide important pending errors.

### 15.4 Modal accessibility and state

- Provide an accessible name.
- Use native dialog or a proven equivalent pattern.
- Place initial focus according to the task: title/description, first field, or safe action.
- Trap focus only while the surface is truly modal.
- Make background content inert.
- Escape closes when safe; if edits would be lost, use a clear recovery/confirmation pattern.
- Restore focus to the initiating control or a sensible successor if it no longer exists.
- Prevent background scroll without jumping the page.
- Backdrop click MAY dismiss a low-risk dialog; it SHOULD NOT silently discard substantial edits.
- Do not open a second modal over a first as the default workflow.
- Nested steps need clear internal back navigation.
- Async completion MUST not close the dialog before success.
- Errors remain in the dialog with the user's entries intact.
- Do not place ordinary toasts over dialog actions.

### 15.5 Destructive confirmation

Show:

- Specific title: “Delete this schedule?”
- Object/context: the schedule name or selected count.
- Actual consequence, including whether it can be restored.
- Safe cancel action.
- Explicit destructive action: “Delete schedule.”

Require typed confirmation only for exceptional high-impact operations; do not make users type text for routine recoverable deletion. Prefer undo for frequent reversible actions. [H25]

### 15.6 Drawers and inspectors

- Desktop default width: 320–380 px for an inspector; 400–560 px for a form drawer.
- Modal and nonmodal drawers MUST have different focus behavior.
- Nonmodal inspectors MUST not trap focus.
- Editing controls remain reachable from the selected object.
- A narrow screen MAY convert the drawer to a full-screen route.
- Closing the drawer preserves selection and scroll context.
- Header includes object title and clear close action.
- Use a local loading/error state rather than blanking the whole workspace.

## 16. Popovers, tooltips, banners, and toasts

### 16.1 Popovers

- Contextual, anchored, and short.
- Initial width: 240–360 px; fit actual content.
- Radius: 16 px; padding 16–20 px.
- Edge spacing: at least 12–16 px from viewport.
- Reposition when the anchor approaches an edge.
- Use a nonmodal or modal pattern according to the actual interaction.
- Escape closes and returns focus appropriately.
- Do not hide a large editor inside a tiny popover.
- A complex popover on mobile SHOULD become a sheet or route. [H26]

### 16.2 Tooltips

- Tooltip content is supplemental.
- Show on keyboard focus and appropriate pointer hover.
- Default hover delay: 500 ms; hide promptly on exit, with tolerance for entering the tooltip when its content needs interaction/inspection.
- Typical max-width: 240 px.
- Text: 12–13 px, readable contrast.
- Padding: 8 px vertical, 10–12 px horizontal.
- Radius: 8 px.
- No important instructions exclusively in tooltips.
- Do not use a tooltip as a substitute for an accessible label.
- No mandatory hover interaction on touch devices.
- Do not place buttons inside a simple tooltip; use a popover for interactive content.

### 16.3 Banners

- Use for persistent contextual status: offline, incomplete setup, integration disconnected.
- Place near the affected task region.
- Include an icon and meaningful text, not color alone.
- Use semantic tinted surfaces sparingly.
- Provide an action when the user can resolve the condition.
- Dismiss only when it is safe to hide the information.
- A banner's height grows with translated text.
- Critical persistent failure MUST not be communicated only through an ephemeral toast.

### 16.4 Toasts

- Use for nonblocking completion or brief feedback.
- Initial width: 320–420 px desktop; viewport minus 32 px narrow.
- Radius: 14–16 px.
- Padding: 14–16 px.
- Include a clear message and optional one action.
- Default duration for informational feedback: about 5 seconds.
- Actionable or important toasts MUST remain available long enough to use; pause on hover/focus or keep persistent until dismissed.
- Keep at most three visible; deduplicate repetitive events.
- Do not announce every tiny autosave through a global live region.
- Use polite announcements for ordinary feedback; reserve assertive interruption for truly urgent conditions.
- A toast MUST not be the only record of a critical outcome.
- If offering undo, preserve the operation's reversibility for the advertised interval.

## 17. Search, filtering, and command palettes

### 17.1 Search field

- Minimum height: 44 px.
- Radius: 12 px or full radius when it is visually distinct chrome.
- Leading search icon: 18–20 px.
- Label/placeholder specifies scope: “Search bookings” rather than an unexplained generic field.
- Clear action is accessible and has a usable target.
- Query remains visible after results load.
- Do not submit or clear the query when pressing an unrelated navigation key.
- Search results MUST distinguish loading, no results, and failed search.

### 17.2 Live search behavior

- Default remote-search debounce: 200–300 ms.
- Cancel obsolete requests or ignore stale responses.
- IME composition MUST not trigger incomplete queries.
- Preserve results while updating when that avoids a disruptive blank state.
- Show a scoped updating indicator.
- Keyboard selection and screen-reader announcement MUST not restart unnecessarily.
- Highlight matching terms conservatively without making the line unreadable.
- Show relevant results first, with categories only when they help scanning.
- Recent searches MUST respect the product's privacy context.

Apple's search guidance emphasizes immediate useful results, suggestions, clear scope, and ways to refine results. [H27]

### 17.3 Filters

- Default simple filters are visible near the data.
- Advanced filters MAY be in a popover/sheet.
- Show selected filter values and result count.
- Active filter chips have accessible removal controls.
- “Clear filters” MUST not unexpectedly clear the search query unless labeled accordingly.
- Filter state SHOULD survive returning from an item detail.
- Shareable views SHOULD encode appropriate non-sensitive filter state in the URL.
- Do not place private/sensitive search values in the URL without considering exposure.
- An empty filtered result includes “Clear filters” or a helpful adjustment.
- Distinguish “No records yet” from “No matches.”

### 17.4 Command palette

- Optional for task-heavy applications, never a replacement for visible essential navigation.
- Default shortcut MAY be Command/Ctrl+K when it does not conflict with the product/browser context.
- Width: 560–640 px maximum; narrow viewport minus 32 px.
- Search input: 48–56 px high.
- Results grouped by purpose, not arbitrary styling.
- Each result states the action or destination.
- Commands that cause irreversible/external actions require an appropriate follow-up review.
- Do not execute a destructive command just because it is the first fuzzy match.
- Arrow navigation, Enter, Escape, active-option semantics, and focus restoration MUST work.
- Do not advertise shortcuts the platform intercepts or the app cannot implement reliably.

## 18. Loading, progress, empty states, and failure

### 18.1 Feedback timing

Project timing heuristics:

| Expected delay | Treatment |
| --- | --- |
| Under about 150 ms | Usually keep the interface stable; avoid a flashing loader |
| About 150–500 ms | Immediate control feedback; optional subtle pending indication |
| About 500 ms–2 s | Scoped spinner or skeleton if it clarifies what is loading |
| Longer than about 2 s | Clear task label; actual progress when measurable |
| Long or uncertain work | Honest status, cancel/background path where possible, and failure/retry handling |

These values are implementation heuristics, not Apple-mandated timings.

### 18.2 Skeletons

- Match the expected content structure.
- Use neutral opaque blocks with a slight tonal difference.
- Radius follows the actual content.
- Reserve the final layout's dimensions to reduce shifts.
- Do not show fake table numbers or actual-looking generated content.
- Subtle shimmer is optional; disable it for reduced motion.
- Do not skeleton the navigation if only one widget is loading.
- Do not replace already useful content with skeletons during every refresh.
- Expose a concise loading state semantically rather than every skeleton shape.

### 18.3 Progress

- Use determinate progress only when the total is measurable.
- Use indeterminate progress for unknown work.
- Do not advance to 90% through a timer and wait indefinitely.
- A percentage MUST correspond to the labeled stage or complete task.
- Separate upload progress from processing progress.
- Long tasks SHOULD allow cancellation or safe background continuation.
- Explain partial completion honestly.
- Do not use looping celebratory animation while the task is unfinished.

Source direction: [H28], [H29].

### 18.4 Empty states

Default anatomy:

- Optional simple symbol at 40–48 px.
- Title at 20–24 px.
- One short explanatory paragraph at 15–17 px.
- One relevant action, if one exists.
- Optional secondary help link.

Examples:

| Empty condition | Appropriate content |
| --- | --- |
| New workspace | Explain what belongs here and offer creation |
| No search matches | Show the query context and ways to adjust it |
| Missing integration | Explain the required connection and provide a setup action |
| No permission | State that access is unavailable; show a legitimate request path if one exists |
| No activity | Say that activity will appear when the relevant event occurs |

Do not use the same generic “Nothing here” illustration for every condition.

### 18.5 Errors and recovery

- State what failed.
- State whether data was preserved.
- Offer a concrete retry, correction, or contact path.
- Keep diagnostic codes secondary and copyable if useful.
- Do not expose secrets or sensitive system details in errors.
- A retry MUST not duplicate a payment, external message, or other non-idempotent action.
- Distinguish offline from rejected permission and server failure.
- Do not turn recoverable field errors into global modals.
- A route-level error SHOULD preserve available navigation.
- Broken media shows an intentional fallback rather than a large empty rectangle.
- Stale data retains a visible age/source indicator if it matters.

## 19. Charts, metrics, and analytics

Apple's chart guidance distinguishes chart types by the relationship they communicate and stresses meaningful scales. This section adds web project defaults for analytics tools. [H30]

### 19.1 Metric cards

- Metric label: 13–15 px.
- Main value: 30–34 px, semibold, tabular numerals.
- Unit/currency is visible and unambiguous.
- Comparison period appears near the change.
- Positive/negative coloring follows business meaning, not arithmetic sign alone.
- Pair arrows/color with words or signs.
- Missing data is not displayed as zero.
- Do not animate every count from zero on every visit.
- A sparkline MAY supplement a value; it MUST not be the only way to read the trend.
- Use fewer metrics with a clear relationship rather than a dense wall of cards.

### 19.2 Chart styling

- Background: opaque surface or transparent over a uniform opaque panel.
- Gridlines: subtle and sparse.
- Axis labels: 12–13 px baseline, readable.
- Series stroke: 2–3 px.
- Data points: 4–6 px when needed; avoid markers on every dense point.
- Primary series uses accent; additional series use distinguishable hues and/or patterns.
- Selected data has visible focus/selection.
- Tooltip shows series, value, unit, and period.
- Tooltip interaction works with touch and keyboard through an appropriate alternative.
- Chart panels include a title and necessary context.
- Avoid 3D charts, decorative bevels, strong background gradients, and crowded legends.

### 19.3 Data honesty

- Bar charts generally begin at zero; disclose meaningful exceptions.
- Line-chart bounds MAY be tighter when changes are the purpose, but make the scale clear.
- Show gaps for missing observations rather than silently connecting invented data.
- Distinguish estimates, projections, and actuals.
- Label aggregation period and timezone when relevant.
- Keep consistent units across a series or label conversions.
- Do not use arbitrary smoothing that alters the interpretation.
- Provide a textual summary and/or accessible table for important data.
- An exported chart MUST carry the same units, period, and meaning as the UI.

## 20. Calendars, schedules, and timelines

These are project extensions for task-heavy applications.

### 20.1 Calendar composition

- Place date range, today action, previous/next, and view selection in one coherent toolbar.
- Day/week/month belongs in a segmented control or suitable view menu.
- Use a 44 px target for date-navigation actions.
- Time labels: 12–13 px.
- Event title: 13–15 px, depending on density.
- Grid lines remain secondary to events.
- Today's date is distinct from the selected date.
- The current-time line MAY use accent, with a small readable indicator.
- Do not saturate every empty grid cell with color.
- Event colors have a consistent semantic/category mapping.

### 20.2 Event and shift blocks

- Show identifying title and time range.
- Use a small status/category cue when needed.
- Overlap and conflict states MUST be explicit.
- Drag-and-resize previews show the proposed result before commit.
- Snapping follows the actual scheduling interval.
- Keyboard users can move or edit events through a non-drag alternative.
- Undo or a clear recovery path follows a move.
- Updating one event MUST not reset the whole calendar.
- Permissions distinguish view-only from editable schedules.
- Do not use only red/green to communicate staffing or availability.

### 20.3 Narrow adaptation

- Default to agenda/day view if a full week becomes unreadable.
- Preserve access to the same records and edit operations.
- Use a contextual sheet/detail route for event editing.
- Always show the relevant date and timezone.
- When displaying times across zones, identify which zone drives the schedule.
- Daylight-saving transitions require truthful labels and backend-supported time handling; styling MUST not conceal ambiguity.

## 21. Editors, documents, code, and review panels

### 21.1 Editor layout

- The content canvas is opaque and calm.
- Reading width: about 65ch unless the document format needs more.
- Editing body: 16–17 px with 1.5 line height.
- Toolbars are visually lighter than the document.
- Show the document title, save state, and relevant version/review status.
- Keep the active selection and caret visible.
- A side inspector MAY hold metadata/comments on wide screens.
- On narrow screens, use a separate details/comments view.
- Do not put a document paragraph in a separate shadowed card.
- Preserve selection and undo history during toolbar actions and theme changes.

### 21.2 Rich-text controls

- Use familiar formatting symbols with labels/tooltips.
- Selected formatting state is visible and semantic.
- Dropdown selection returns focus to the editor as appropriate.
- Keyboard shortcuts follow established conventions.
- Copy/paste MUST preserve meaningful text structure.
- Do not make automatic formatting irreversible.
- A focused editor is not a license to intercept every browser shortcut.
- Sticky toolbars MUST not cover selected text.

### 21.3 Diff and review

- Added, removed, and unchanged material have distinct visual treatments.
- Do not rely exclusively on red/green; include labels, gutters, or symbols.
- Long changed passages wrap or scroll in a bounded region.
- A change list can navigate to each change.
- “Accept” and “Reject” clearly identify their scope.
- “Accept all” states the full scope before commitment.
- Keep original/revised content distinguishable.
- A user edit takes precedence over automated regeneration unless the user explicitly requests replacement.
- Preserve an audit/history view when the product already supports one.

### 21.4 Code and logs

- Use monospaced 13–14 px type, 1.5 line height.
- Code region has a subtle background and 12–16 px padding.
- Syntax colors MUST remain legible in both themes.
- Horizontal scrolling is local, not page-wide.
- Copy button copies the actual content and announces completion.
- Show language/filename when useful.
- Long logs support search, pause, and meaningful severity cues.
- Do not flood the user with implementation logs in a product workflow that needs a simple status.
- IDs and trace details MAY live in an expandable support region.

## 22. File upload, drag-and-drop, and downloads

### 22.1 Upload entry

- Show a real “Choose files” button.
- Drag-and-drop is an enhancement, not the only entry path.
- Drop zone uses a subtle control boundary and clear text.
- State accepted types and actual limits.
- Do not advertise file types the backend cannot process.
- Selected filenames are readable; long names reveal full text.
- Each file has clear status: queued, uploading, processing, complete, failed, canceled.
- Removing a file before submission MUST not be labeled as deleting the original.

### 22.2 Progress and recovery

- Show upload progress separately from later analysis.
- Per-file errors remain attached to the relevant item.
- Retry acts only on the failed scope where possible.
- Prevent duplicate uploads when repeated activation is accidental.
- Cancel behavior reflects whether transfer/processing can actually stop.
- Preserve completed files during partial failure.
- Explain resume capability only if implemented.
- Dragging invalid content produces readable feedback, not just a red border.
- Native drag-and-drop behavior SHOULD follow the platform and offer a non-drag alternative. [H31]

### 22.3 Downloads and export

- Use a specific action label: “Download PDF,” “Export CSV.”
- Show generation status when the export is not immediate.
- Export settings name the scope, format, and included data.
- Do not claim that a file was downloaded before it was generated and made available.
- Name files meaningfully and consistently.
- Downloads preserve units, dates, source context, and selected scope.
- Sensitive export options MUST not become easier to trigger accidentally through a cosmetic redesign.

## 23. AI assistants, chat, and generated work

This is a project extension informed by the broader principles of agency, truthful feedback, and clear hierarchy; it is not presented as a dedicated Apple chat specification.

### 23.1 Chat layout

- Conversation is the main content, with a restrained persistent composer.
- Message reading width: 65–75ch for prose.
- Composer minimum height: 52–56 px, with growth for multiline input.
- Composer maximum height: roughly 200 px before internal scrolling, adapted to viewport and keyboard.
- Input text: 16–17 px.
- Main send/stop action: 44 px target.
- Attachments and mode controls remain secondary.
- User and assistant content MUST be distinguishable through labels/position/structure, not color alone.
- Use subtle tonal distinction rather than heavy speech bubbles around every paragraph.
- Streaming text MUST not repeatedly steal focus.
- Automatically scroll only while the user is already following the latest content.
- If the user scrolls upward, preserve position and provide a “Jump to latest” action.
- New-content indicators SHOULD be quiet and accurate.

### 23.2 Generation state

Show distinct states:

1. Request received.
2. Processing or working, with truthful task context.
3. Partial/streaming content.
4. Complete draft/result.
5. Canceled, failed, or interrupted.

- Do not fabricate internal reasoning, progress percentages, tool use, or source verification.
- Stop generation MUST stop or accurately communicate what remains running.
- Retry SHOULD preserve the original request.
- Regeneration MUST not overwrite substantial user edits without a deliberate choice.
- Disabled send controls explain actual limits when useful.
- If generated content is a draft, label it as a draft.
- Do not display unverified statements as completed facts just because the visual treatment is polished.

### 23.3 Structured results

- Use sections, lists, tables, and fields according to the content's meaning.
- A result meant for editing belongs in an editable workspace, not trapped in a chat bubble.
- Keep source/provenance links near relevant output.
- Expose missing/uncertain input explicitly.
- Do not use uncalibrated percentages as an authoritative confidence score.
- A review-needed flag names what needs review.
- Suggested changes show their destination and effect.
- Approval actions are separate from generation actions.
- External actions, such as sending or publishing, show the concrete target and scope before commitment when the product requires review.
- Preserve user-edited and model-generated versions distinctly.

### 23.4 AI action panels

An agent task panel SHOULD show:

- Task name.
- Actual current stage.
- Relevant inputs/resources.
- Output/result.
- User-facing error or blocker.
- Safe cancel/retry or review action.

Implementation details belong in an expandable technical region only when they help the intended user. Do not fill a business user's main view with token counts, raw logs, or provider names unless those are part of the product's purpose.

### 23.5 Review and approval

- Before approval, show the final material the user is approving.
- Approval MUST not imply a backend commit if it only marks a local review state.
- Distinguish “Approve draft,” “Save,” “Export,” and “Send.”
- Do not use the same filled button label for several different consequences.
- A failed commit keeps the approved draft available.
- Review panels SHOULD make corrections low-effort through direct editing, localized retry, or specific follow-up.
- Ask follow-up questions only when the missing information is needed; do not turn a simple task into an unnecessary interview.

## 24. Audio, recording, transcription, and media

### 24.1 Recording control states

| State | Required UI |
| --- | --- |
| Ready | Clear start action and purpose |
| Requesting access | Honest permission/pending state |
| Recording | Visible textual recording state, timer, stop/pause controls |
| Paused | Explicit paused state; timer behavior matches actual recording |
| Processing | Separate transcription/analysis status |
| Complete | Transcript/result and review/next action |
| Denied/unavailable | Recovery instructions and another input path where possible |
| Failed/interrupted | Explain whether audio exists and how to recover |

- Never imply that recording has started before device access succeeds.
- A red dot alone is insufficient.
- Timer uses tabular numerals and does not shift control positions.
- Waveform is optional and represents actual signal activity if shown.
- Do not animate a fake waveform when the microphone is silent or inactive.
- Stop recording and delete recording are distinct actions.
- Provide clear feedback if the device disconnects or the tab loses needed capabilities.
- Recording indicators MUST remain visible while the app is actively capturing.

### 24.2 Audio permissions and privacy copy

- Request access at the moment the feature needs it.
- State why access is needed in clear language.
- Explain where audio is processed/stored only according to the actual architecture.
- Do not claim “local,” “private,” “never stored,” or “encrypted” unless implemented and verified.
- Permission refusal MUST not produce repeated nagging prompts.
- Provide concise platform-appropriate recovery guidance.
- Background/inactive capture behavior must be explicit.
- Speaker playback SHOULD be opt-in when unexpected audio would disrupt the environment.

### 24.3 Playback and media

- Use familiar play/pause, seek, volume, and time indicators.
- All controls have usable targets and names.
- Captions/transcripts are available for meaningful prerecorded spoken content.
- Autoplay with sound is not the default.
- Users can pause autoplaying decorative media.
- Reduced motion/data constraints use a poster/static fallback where supported.
- Scrubbing supports keyboard and accessible time information.
- Playback state reflects the media element's actual state.
- Avoid covering important video content with oversized control panels.

## 25. Authentication, onboarding, and first use

### 25.1 Sign-in composition

- Single focused form, usually 400–480 px wide.
- Compact product identity above or beside the form.
- Clear title: “Sign in” or an equally direct task label.
- Persistent labels and appropriate autocomplete.
- Password reveal and recovery are reachable.
- Alternative methods are grouped separately.
- Do not bury the main sign-in method among decorative cards.
- Do not block paste, password managers, or autofill.
- Invalid credentials produce neutral understandable feedback.
- Pending submission preserves the entered address and prevents accidental duplicates.
- Session expiry SHOULD preserve drafts and provide a return path after reauthentication.

### 25.2 Account/workspace context

- Show the current workspace/account in a stable location.
- Switching confirms the resulting context through title/navigation/data.
- Do not allow old-workspace content to appear briefly as if it belongs to the new workspace.
- Workspace-specific actions and permission errors identify their scope.
- Avatar images are optional; initials use consistent neutral styling.
- An account menu separates personal preferences, workspace management, and sign-out.

### 25.3 Onboarding

- Begin with the smallest useful setup.
- Prefer contextual learning through actual use.
- Optional tutorials can be skipped and rediscovered.
- A prerequisite setup flow states why the prerequisites are necessary.
- Do not demand optional personal details before access to the product.
- Show real steps and progress; do not invent a long setup sequence.
- If setup is incomplete, keep the next required action discoverable.
- Do not show the same introduction on every launch.
- First-use empty states are useful onboarding surfaces.
- Avoid prolonged branded splash screens.

Apple's onboarding guidance favors brief, relevant, interactive learning and contextual tips. [H32]

### 25.4 Launch and return visits

- Render the application shell quickly.
- Restore appropriate prior context, such as the last workspace or document.
- Avoid unnecessary reopening animations.
- Do not restore sensitive content to an inappropriate unauthenticated screen.
- Explain a required upgrade or unavailable feature in context.
- A route entered directly MUST work without relying on an earlier animation or onboarding step.
- Keep a useful page title for history, tabs, and assistive navigation.

## 26. Settings, permissions, notifications, and privacy

### 26.1 Settings structure

- Group settings by user goal: Account, Workspace, Appearance, Notifications, Integrations.
- Use 1–2 explanatory sentences for a section, not a long essay above each switch.
- A setting's current value is visible.
- Descriptions explain consequences rather than repeating the label.
- Settings changes communicate whether they take effect immediately or after save.
- Dangerous account/workspace operations are separated.
- Avoid a giant undifferentiated page of toggle cards.
- A search feature MAY help large settings collections.
- Preserve labels and grouping across devices even when the layout stacks.

### 26.2 Permission and integration states

- State connected/disconnected/expired/limited access distinctly.
- Explain the actual benefit and requested scope.
- Connect, reconnect, disconnect, and revoke have different meanings.
- Do not use a success-colored badge for a partially failed integration.
- Show last successful sync and meaningful freshness when relevant.
- Retrying connection preserves existing local work.
- External account selection is explicit when several accounts exist.
- Missing access SHOULD offer a legitimate next step, not a dead-end disabled button.

### 26.3 Privacy interface

- Explain collection and use where the user makes the decision.
- Request only the relevant permission at the relevant moment.
- Consent choices use comparable readable controls.
- Do not preselect optional data sharing as if it were necessary.
- Privacy settings and deletion/export paths remain discoverable.
- Avoid deceptive visual imbalance between equally legitimate choices.
- A redesigned “Delete” action MUST keep existing data-retention semantics accurate.
- Do not treat a polished UI as evidence of security or regulatory compliance.

Apple's privacy guidance emphasizes data minimization, transparency, and timely access requests. [H33]

### 26.4 Notifications

- Notify for timely useful information.
- Distinguish urgent action from routine updates.
- Permission requests SHOULD follow an understood benefit.
- Badge counts represent actual relevant items, not marketing pressure.
- Notification settings control meaningful categories.
- In-app notifications link to the correct context.
- A read state is clear and consistent.
- Do not turn every background job into a system notification.
- Avoid simultaneous toast, modal, badge, banner, and sound for one routine event.
- The same event SHOULD not repeatedly notify after it has been addressed.

Source direction: [H34], [H35], [H36].

## 27. Commerce, pricing, booking, and checkout

This section is a project extension for transactional interfaces.

### 27.1 Product/offer cards

- Product/offer title and defining image are prominent.
- Price includes the currency and applicable unit: per day, per month, per item.
- Material restrictions and availability appear before commitment.
- A unavailable offer has a truthful state and useful alternative.
- Do not use a small footnote to reverse the meaning of a large price.
- Selected variant is visually and semantically distinct.
- Product photography uses consistent aspect ratios and careful cropping.
- A card's “View details” and “Buy/book” actions have separate consequences.

### 27.2 Pricing tables

- Plans use the same comparison dimensions.
- Align rows so differences can be compared.
- Highlight at most one recommended plan through restrained hierarchy.
- Recurring period and billing commitment are explicit.
- A monthly/yearly segmented control updates all affected prices coherently.
- Savings claims MUST match actual arithmetic.
- Unavailable features are named rather than represented solely by a faint dash.
- Narrow layouts keep comparable information or provide a clear comparison view.
- Do not make the cheapest or cancellation choice unreadable.

### 27.3 Checkout/booking

- Show current step and a persistent understandable order summary.
- Identify dates, quantities, variants, delivery/location, and price breakdown.
- Preserve form data after a failure.
- Show totals from real calculations.
- Payment processing has a distinct pending state and duplicate protection.
- Do not use generic retry when it could create a second charge.
- Confirmation shows the actual result and reference.
- A reservation request and a confirmed booking MUST not share the same success claim.
- Errors remain near the affected field or payment region.
- A final commit label describes the action, such as “Pay…” or “Request booking.”

## 28. Motion and microinteractions

Apple guidance recommends purposeful, optional, brief motion that supports understanding and does not obstruct frequent tasks. [H37]

### 28.1 Motion tokens

| Token | Project duration | Use |
| --- | --- | --- |
| instant | 0 ms | Direct state change when motion adds no value |
| micro | 120 ms | Hover/press color response |
| fast | 180 ms | Selection, menu fade, compact transition |
| standard | 240 ms | Popover/dialog appearance |
| slow | 320 ms | Larger sheet/drawer transition |
| editorial | 500–700 ms | Optional marketing reveal, used sparingly |

Default easing:

- General: cubic-bezier(0.2, 0.8, 0.2, 1).
- Exit: cubic-bezier(0.4, 0, 1, 1).
- Linear: only for actual progress/constant-rate motion.

These are project values, not extracted Apple animation constants.

### 28.2 What to animate

SHOULD animate:

- A menu/popover entering its anchor context.
- A sheet moving into view.
- Selection indicators changing.
- A small successful state transition.
- A direct drag following the pointer/finger.

SHOULD avoid:

- Long entrances for ordinary text/data.
- Every card lifting dramatically.
- Every icon bouncing.
- A dashboard count-up on each refresh.
- Decorative background movement in a work tool.
- Page transitions that reset or hide relevant content.
- Waiting for motion before accepting the next input.

### 28.3 Motion geometry

- Menus/popovers: fade with at most 4–8 px translation or slight scale from 0.98 to 1.
- Dialog: fade with at most 8–12 px translation; no large zoom.
- Drawer/sheet: move from the relevant edge; keep direction consistent.
- Marketing reveal: at most 16–24 px translation, once; content remains available if animation fails.
- Prefer transform and opacity for simple transitions.
- Do not apply transitions to every CSS property.
- Motion MUST be interruptible and settle into the correct current state.

### 28.4 Reduced motion

- Honor prefers-reduced-motion on web.
- Remove parallax, count-ups, shimmers, and large translations.
- Replace movement with a brief opacity/state change or no animation.
- Keep all essential feedback available through text and state.
- Do not use animation as the only indicator that saving or recording occurred.
- Native apps honor system Reduce Motion through appropriate APIs/components.

## 29. Keyboard, pointer, touch, and gestures

### 29.1 Keyboard baseline

- Every interactive task has a keyboard path.
- Tab order follows visual/reading order.
- Do not use positive tabindex values for normal page order.
- Buttons respond to native Enter/Space behavior.
- Links respond to native activation.
- Arrow-key behavior is reserved for appropriate composites such as tabs, menus, radios, and grids.
- Escape closes the topmost dismissible transient surface.
- Focus returns sensibly after close/delete/reorder.
- Include a skip link for sites/apps with repeated large navigation.
- Route transitions place focus meaningfully and announce the new page through a suitable pattern.
- Background updates MUST not steal focus.

### 29.2 Shortcuts

- Preserve standard copy, paste, cut, undo, redo, find, and save expectations.
- Use Command on macOS and Control on applicable other platforms.
- Do not assume browser-reserved shortcuts can be overridden safely.
- Show shortcuts in relevant menus/help when supported.
- Single-character shortcuts MUST avoid unintended activation while typing and provide appropriate controls where required.
- Never make a shortcut the only way to invoke a feature.
- Shortcuts SHOULD be few, memorable, and task-relevant. [H38]

### 29.3 Pointer

- Hover provides supplemental clarity.
- Cursor reflects meaningful affordance; do not use a hand cursor for static text.
- Dragging has a visible target and preview.
- Drop targets highlight only when a compatible object can be accepted.
- Clicking selection should not unexpectedly trigger a destructive action.
- Fine-pointer density MUST not silently persist on touch contexts.
- Tooltips and hover actions need keyboard alternatives. [H39]

### 29.4 Touch and gestures

- Default interactive targets: at least 44 × 44 CSS px for touch.
- Keep at least 8 px between small adjacent controls when possible.
- Do not enlarge hit regions into neighboring targets.
- Respect browser/system edge gestures.
- Avoid long-press-only essential actions.
- Swipe and drag are supplementary when a simple visible control can provide the same task.
- Prevent accidental destructive swipes through undo/appropriate confirmation.
- Scrolling MUST remain responsive even while content is loading.
- Do not use preventDefault globally on touch events.
- Precision operations provide an alternative such as a field, stepper, or edit dialog. [H40]

## 30. Accessibility acceptance standard

Apple accessibility guidance informs native adaptability and inclusive interaction. For web, target **WCAG 2.2 Level AA** and verify the relevant success criteria. This document's checklist is a project baseline, not a replacement for a complete conformance evaluation. [H41], [R04]–[R10]

### 30.1 Contrast

Web requirements:

- Ordinary text: at least 4.5:1.
- Large text: at least 3:1 where it meets WCAG's large-text definition.
- WCAG large text is approximately 24 CSS px regular or 18.67 CSS px bold; do not use 18 CSS px regular as the threshold.
- Required non-text control/state boundaries: generally at least 3:1 against adjacent colors, under the applicable criterion.
- Do not confuse native point-based guidance with browser CSS-pixel thresholds.
- Measure actual foreground/background combinations, including transparent composition.
- Check hover, selected, disabled semantics, error, focus, and dark themes separately.
- This system normally keeps readable metadata above 4.5:1 even when it is visually secondary.
- Decorative dividers need not be mistaken for essential control boundaries.

### 30.2 Target size

- This system's touch default is 44 × 44 CSS px.
- WCAG 2.2 AA target-size minimum is 24 × 24 CSS px with specified exceptions; the two standards are not identical.
- Inline text links may need a different treatment from standalone controls.
- Target spacing and hit geometry must be verified, especially around circular or clipped icons.
- Do not claim compliance merely because a visual icon is 24 px wide.

### 30.3 Semantics and assistive technology

- Use semantic landmarks, headings, labels, tables, lists, links, and buttons.
- Use native HTML before ARIA when it provides the right behavior.
- Every input has an associated name.
- Error/help text is associated with the affected control.
- Required/invalid/expanded/selected/busy state is accurately exposed.
- Decorative SVGs/images do not create redundant announcements.
- Screen-reader order matches the meaning of the layout.
- Accessible names describe the action rather than the shape.
- Do not set aria-hidden on a focused element or its ancestor.
- Do not mark a nonmodal panel as modal.
- Live regions communicate meaningful changes without narrating every streaming token or keystroke.

### 30.4 Focus

- Focus-visible outline default: 2 px, 3 px offset.
- Focus MUST remain discernible against the actual neighboring colors.
- A focus ring on an already-blue button may need a contrasting gap or a two-color treatment.
- Do not remove outline without an equivalent.
- Sticky bars and overlays MUST not obscure focused controls.
- Programmatic focus follows explicit user actions or necessary route/error transitions.
- Modal focus remains inside; nonmodal inspector focus does not.
- After deleting an item, focus moves to a logical remaining item/action.

### 30.5 Zoom, text, and reading

- Support 200% text resizing and narrow reflow.
- Verify 400% zoom on representative desktop layouts.
- Long translated text does not clip controls.
- User-applied text spacing must not make content unusable.
- Important information is not hidden through ellipsis.
- Do not encode information only through placement such as “click the green button on the right.”
- Explain controls by name.
- Avoid image-only headings and text baked into essential imagery.

### 30.6 Motion, media, and input

- Reduced motion works.
- Autoplaying movement can be paused or removed when relevant.
- Meaningful audio/video has applicable captions/transcripts.
- No color-only, sound-only, or gesture-only critical feedback.
- Dragging tasks have a non-drag alternative where needed.
- Forms support autocomplete and do not require unnecessary repeated entry.
- Authentication supports accessible alternatives and password managers.
- Do not require cognitive puzzles merely to achieve a visual effect.

### 30.7 Verification

Run:

1. Automated accessibility checks on important routes/states.
2. Keyboard-only walkthrough of the complete primary workflow.
3. A representative screen-reader walkthrough.
4. Contrast checks against actual surfaces.
5. Zoom/reflow and text-growth checks.
6. Reduced-motion and higher-contrast checks.

Automated tools do not prove all of these pass. Record real unresolved issues rather than assuming a clean scan equals full accessibility.

## 31. Dark appearance and higher contrast

Apple guidance favors adapting to the system appearance and testing actual content instead of merely inverting colors. Native apps SHOULD follow the system preference; optional web overrides are a project choice, not an Apple recommendation. [H42]

### 31.1 Theme selection

- Web default follows prefers-color-scheme where the app supports both themes.
- A web app MAY offer System / Light / Dark when useful.
- Persist an explicit web override and apply it before first meaningful paint.
- When System is selected, update with system changes.
- Native apps SHOULD use system appearance rather than requiring an independent preference.
- Marketing sites MAY keep an intentional editorial light/dark composition per section; that is different from an app-wide dark theme.

### 31.2 Dark composition

- Use near-black canvas and slightly lighter raised surfaces.
- Let surfaces and borders carry depth; strong black shadows alone are ineffective.
- Reduce excessive brightness in large neutral regions.
- Keep body text comfortably readable.
- Avoid pure white walls of small text on pure black when a softer pair works.
- Do not invert photographs, brand assets, or status illustrations automatically.
- Adjust chart colors and image treatment deliberately.
- A logo MAY require an alternate theme asset.
- Link colors and filled-action text have separate contrast requirements.

### 31.3 Higher contrast and forced colors

- Honor detectable prefers-contrast settings with stronger boundaries and simpler materials.
- Browser support varies; provide a usable default even when a preference query is unavailable.
- Under forced-colors, preserve native semantics and use system colors where needed.
- Do not disable forced-color adjustment globally.
- Focus and selection remain distinct.
- Remove decorative transparency that damages readability.
- Use outlines or explicit markers when background fills are suppressed.
- Test combinations, not just preferences one at a time.

## 32. Localization and inclusive content

### 32.1 Layout

- Use logical properties: padding-inline, margin-inline, inset-inline, text-align: start.
- Mirror directional navigation where appropriate.
- Do not automatically mirror logos, text, charts, clocks, or media whose direction has a specific meaning.
- Leading/trailing replaces hard-coded left/right in implementation.
- Text expansion MUST be tested in labels, navigation, dialogs, and forms.
- Font fallbacks must cover supported scripts.
- Avoid fixed-height rows with variable translated copy.
- Support bidirectional text in mixed-language identifiers where applicable.

### 32.2 Formats

- Use locale-aware date, time, number, and currency formatting.
- Display the relevant timezone for appointments, travel, schedules, and deadlines.
- Relative times SHOULD expose a precise timestamp when useful.
- Do not assume month/day/year globally.
- Do not concatenate translated phrases from fragments that reorder incorrectly.
- Pluralization is handled through the localization system.
- Postal addresses, names, and phone formats reflect supported markets.
- Do not require first/last-name assumptions for every user population.

### 32.3 Voice and inclusion

- Use clear, familiar language.
- Avoid stereotypes in examples and imagery.
- Distinguish optional demographic information from required account information.
- Describe unavailable access neutrally.
- Avoid humor in urgent failures, payment errors, or loss of user work.
- Use technical terms only when the audience uses them.
- Consistency matters more than inventing a different verb on each screen.

## 33. Marketing page recipes

These recipes are original compositions informed by the sampled Apple product/category pages. They are not copied page templates.

### 33.1 Homepage hero

Default structure:

1. Compact navigation.
2. Short optional eyebrow.
3. One benefit/product H1.
4. One supporting statement.
5. One primary CTA and optional secondary link.
6. One strong product visual.

Measurements:

- Wide top padding: 80–120 px below the navigation.
- Narrow top padding: 48–64 px.
- Title max-width: 10–16em depending on copy.
- Paragraph max-width: 40–50ch.
- Title-to-paragraph: 20–24 px.
- Paragraph-to-actions: 28–32 px.
- CTA gap: 16–20 px.
- Actions-to-media: 48–64 px.
- Narrow layout uses 40–48 px title and allows CTAs to stack.

Avoid several competing badges, floating mini-cards, repeated slogans, and unrelated decorative gradients.

### 33.2 Feature storytelling

- Each section presents one major benefit.
- Headline comes before detailed proof.
- Alternate composition only when it supports the story.
- Use 96–120 px desktop section rhythm and 56–72 px narrow rhythm.
- A visual and a copy block align to a shared composition.
- Detailed specs can use progressive disclosure or a later comparison section.
- Keep the promised benefit backed by actual product behavior.
- Repeated CTAs occur after meaningful information, not between every paragraph.

### 33.3 Media gallery

- Use a stable horizontal track with readable next/previous controls.
- Show a partial adjacent tile when it helps reveal scrollability.
- Snap scrolling MAY assist, but scrolling remains user-controlled.
- Cards retain consistent media ratios.
- Keyboard and touch navigation work.
- Do not autoplay a carousel unless users can control it and its purpose justifies movement.
- Current position is understandable without a large row of tiny dots.
- Lazy-load later imagery; reserve dimensions.

### 33.4 Comparison/specification section

- Put comparable attributes in aligned rows/columns.
- Use clear headers and readable values.
- Keep units consistent.
- On narrow screens choose local scroll or a focused comparison view.
- Do not hide material limits under decorative tiles.
- Footnotes link back to the relevant claim.
- Avoid excessive visual nesting.

### 33.5 Footer

- Background: subtle neutral.
- Top padding: 40–64 px.
- Columns use clear group headings.
- Links remain readable and keyboard accessible.
- Narrow layout MAY use disclosure groups, preserving access to all links.
- Legal/support content uses adequate contrast.
- Do not treat the footer as a place to make important conditions unreadably small.

## 34. Application screen recipes

### 34.1 Dashboard

- Sidebar or top navigation identifies the workspace.
- Page title and relevant date/filter context lead.
- Limit the first metric row to 3–4 meaningful metrics.
- Follow with the main operational region: work list, schedule, or primary chart.
- Secondary activity/help moves lower or into a side region.
- Metric cards use the same value alignment and spacing.
- Important alerts attach to affected work.
- A dashboard MUST not become a marketing hero after the user signs in.

### 34.2 List/detail workspace

- Sidebar identifies category.
- Content list shows items with concise metadata.
- Detail pane shows the selected item's full content.
- Selection persists visibly.
- Detail actions are local to the selected object.
- Narrow layout routes from list to detail with contextual back.
- Filters and list scroll survive return.
- Empty detail prompts selection without pretending to contain a record.

### 34.3 Settings page

- Title and optional short introduction.
- Clear grouped sections.
- Consistent labeled rows.
- Help text directly below the relevant label.
- Save/pending state is coherent.
- Destructive/account operations are separated.
- Narrow layout stacks without losing relationships.

### 34.4 Create/edit flow

- Name the task.
- Show required information first.
- Group fields according to meaning.
- Keep optional advanced content collapsed when appropriate.
- Provide specific commit and cancel paths.
- Validate locally and preserve input after remote failure.
- After success, show the created/updated object with confirmation.

### 34.5 Review workspace

- Main draft/content pane.
- Supporting provenance/context pane.
- Clear review-required markers.
- Low-effort direct correction.
- One obvious approval/commit action with truthful scope.
- Pending and failure preserve work.
- Narrow layout separates tabs/panes without hiding prerequisites.

## 35. Performance and implementation discipline

### 35.1 Runtime quality

- Fast response is part of the design.
- Avoid unnecessary image, font, animation, and icon payloads.
- Use responsive images and modern formats where supported.
- Provide width/height or aspect-ratio to reserve media layout.
- Prioritize the actual above-the-fold primary image; lazy-load lower assets.
- Do not lazy-load essential controls or initial task content.
- Avoid multiple full-viewport backdrop filters.
- Keep scroll handlers light; use browser-native sticky/layout behavior.
- Prefer transform/opacity for simple motion.
- Prevent repetitive re-renders during typing and drag.
- Use virtualization only when actual dataset size warrants the added accessibility complexity.

### 35.2 Project budgets

Recommended product quality targets for public web routes:

- Largest Contentful Paint: around 2.5 s or better at the 75th percentile under relevant real-user conditions.
- Interaction to Next Paint: around 200 ms or better.
- Cumulative Layout Shift: 0.1 or less.

These are the published Core Web Vitals “good” thresholds, not Apple HIG measurements. Assess all three at the 75th percentile, with relevant mobile/desktop segmentation. For internal tools, also measure primary task latency, typing responsiveness, and relevant device performance. [R11]

### 35.3 Dependency policy

- Use existing well-supported components when they meet behavior/accessibility needs.
- Do not add a large animation package to fade a menu.
- Do not install several icon libraries.
- Do not replace the entire application framework for a styling task.
- Prefer a small shared design-system layer over scattered overrides.
- New components MUST be easy to maintain and inspect.
- Avoid brittle selectors tied to incidental DOM nesting.
- Do not duplicate the same style in inline CSS, stylesheet classes, and utility classes simultaneously.

### 35.4 Honest scope

- UI styling MUST not quietly alter business logic.
- If component changes require logic adjustments, review the affected behavior explicitly.
- Do not remove existing authorization checks while simplifying a flow.
- Do not expose admin actions to everyone because a unified toolbar looks cleaner.
- Do not claim a control is working based on appearance alone.
- A visual-only prototype clearly identifies mocked states if presented as a prototype.

## 36. Native Apple-platform adaptation

Use this section when the project actually targets the platform. Web replicas should borrow the composition, not imitate operating-system chrome.

### 36.1 iOS

- Prefer native navigation, tabs, sheets, lists, controls, and semantic text styles.
- Apple's typography guidance identifies 17 pt as a default text size and 11 pt as a minimum; the minimum is not a recommended size for ordinary reading.
- Use native safe areas and keyboard avoidance.
- Keep touch controls easy to reach.
- Support relevant Dynamic Type sizes, VoiceOver, and accessibility preferences.
- Use familiar navigation-back behavior.
- Use system symbols when appropriate and permitted.
- Do not manually fix toolbar/tab geometry to a web measurement.

### 36.2 iPadOS

- Design for resizable windows and actual available space.
- Use adaptive sidebar/tab/split-view patterns.
- Support keyboard, pointer, and touch.
- Move inspectors and secondary panels out of the way when the window narrows.
- Preserve selection and context as columns collapse.
- Prefer native popovers where space allows and sheets/full-screen forms where it does not.
- Do not treat every iPad layout as a stretched iPhone.

### 36.3 macOS

- Use proper windows, menu bar commands, toolbars, sidebars, and inspectors.
- Apple's typography guidance identifies 13 pt as a default and 10 pt as a minimum; choose larger text when content or readability needs it.
- Support familiar keyboard shortcuts and undo/redo.
- Let the user resize windows meaningfully.
- Use document windows for prolonged editing rather than embedding everything in modal sheets.
- Honor system accent/appearance behavior where the native components provide it.
- Do not draw fake traffic-light window controls inside a browser application.

### 36.4 watchOS

- Support brief glanceable tasks and small amounts of information.
- Use native layouts and controls.
- Apple's typography guidance gives 16 pt default and 12 pt minimum.
- Prioritize one meaningful action or status.
- Avoid dense tables, long input flows, and web-style dashboards.
- Use complications/widgets/notifications only for genuinely useful concise information.

### 36.5 tvOS

- Design for viewing distance and focus-driven interaction.
- Apple's typography guidance gives 29 pt default and 23 pt minimum.
- Keep focus unmistakable and navigation predictable.
- Use large coherent media/control groupings.
- Avoid tiny desktop-style menu rows and complex text entry.
- Follow native remote/focus conventions.

### 36.6 visionOS

- Prefer native windows, glass, and spatial input conventions.
- Apple's typography guidance gives 17 pt default and 12 pt minimum.
- Current button guidance specifies a 60 × 60 pt general hit-region baseline in visionOS.
- Do not treat web translucency as a spatial UI system.
- Keep content readable across relevant viewing conditions.
- Use system-managed material adaptation; visionOS does not use a separate conventional Dark Mode setting.
- Do not port dense desktop controls into spatial targets without redesign.

### 36.7 Widgets and Live Activities

- Treat them as focused information surfaces, not miniature copies of the full app.
- Show timely relevant data.
- Keep interactions within the platform's supported behaviors.
- Use system templates and current APIs.
- Avoid stale status that suggests current activity.
- A progress display reflects real state and leads to the correct context.
- Preserve legibility in platform-controlled appearances.

Source direction: [H02], [H04], [H08], [H43]–[H48]. Native availability and exact API choices MUST be checked for the project's deployment target.

## 37. Content, microcopy, and information architecture

Apple's writing guidance emphasizes a consistent voice, contextual tone, plain language, and action-oriented labels. The concrete limits below are project heuristics. [H50]

### 37.1 UI language

- Use the user's vocabulary for objects and tasks.
- Pick one name for each object and use it everywhere.
- Do not alternate “visit,” “session,” and “appointment” if they mean the same record.
- Use active verbs.
- Sentence case is the web default.
- Native platform components MAY require a different convention; apply it consistently.
- Avoid ALL CAPS for ordinary headings and buttons.
- Keep button labels usually 1–3 words when meaning remains clear.
- Keep navigation labels usually 1–2 words.
- Write short status messages that name the object when context is otherwise ambiguous.
- Avoid exaggerated adjectives, generic welcome slogans, and unnecessary exclamation marks in work tools.
- Use ellipses for actual continuing states, not as decorative uncertainty.

### 37.2 Copy patterns

| Situation | Preferred pattern | Avoid |
| --- | --- | --- |
| Creation | “Create schedule” | “Let's do this!” |
| Saving | “Saving changes…” / “Changes saved” | “Working magic” |
| Validation | “Enter an end date after the start date.” | “Invalid input” |
| Failure | “Couldn't save changes. Your draft is still here.” | “Something went wrong!” alone |
| Empty search | “No bookings match these filters.” | “Nothing to see here” |
| Destruction | “Delete booking” | “Yes” without consequence |
| Permission | “Microphone access is needed to record this visit.” | “Enable everything for the best experience” |
| Draft result | “Draft ready for review” | “Complete” when approval is still required |
| External action | “Send request to [recipient]” | “Continue” with an undisclosed send |

Copy MUST match actual behavior. Do not promise draft preservation unless the application really preserves it.

### 37.3 Page information order

Default working-screen order:

1. Identity/context.
2. Main title and task.
3. Required status/prerequisites.
4. Main content/controls.
5. Commit/review actions.
6. Secondary explanation/support.

Move information when the actual task warrants it. For example, a persistent document toolbar may precede the content; a serious blocking error belongs before unusable controls.

### 37.4 Progressive disclosure

- Hide secondary complexity, not essential decisions.
- Disclosure labels state what is inside.
- Open state remains visible.
- Preserve disclosure state when returning within the same task.
- Do not collapse invalid required fields out of view.
- A collapsed section with an error indicates the error and opens through a clear path.
- Advanced configuration remains searchable/discoverable when the product is complex.
- Help SHOULD appear near the decision it supports.

### 37.5 Hierarchy audit

For every page, answer:

- What is the user trying to do?
- What information is necessary before acting?
- Which action completes the task?
- What is optional?
- What belongs in a different route or inspector?
- What can fail, and where is recovery?

If these answers are unclear, adjust the structure before changing colors.

## 38. State, persistence, undo, and concurrency

### 38.1 State clarity

Do not conflate:

- Local edit with saved edit.
- Saved draft with approved result.
- Approval with external publication.
- Uploaded file with completed processing.
- Requested reservation with confirmed reservation.
- Permission requested with permission granted.
- Generated schedule with validated/committed schedule.
- Queued action with completed action.

Use explicit labels and stage transitions. A visual checkmark is reserved for a real completed condition.

### 38.2 Autosave

- State sequence: edited → saving → saved or failed.
- Default autosave debounce: 500–1000 ms after a meaningful edit, selected according to cost and task.
- Save requests MUST not overwrite newer changes through a stale response.
- Show save status near the document/context title.
- Preserve local edits while retrying.
- A server rejection maps to the relevant problem.
- Do not force a full-page loader for background saves.
- A “Saved” timestamp refers to a real successful save.

### 38.3 Undo and recovery

- Provide undo for frequent recoverable edits/deletions when supported by the product.
- Name what will be undone.
- Multiple edits SHOULD have a useful undo history.
- Group a logical operation coherently, such as one drag move or one bulk edit.
- Undo MUST not unexpectedly reverse a different later task.
- Changes that cannot be undone need accurate review/confirmation.
- Do not add fake undo to actions the backend cannot reverse.
- User-driven undo/redo keeps the result visible.

Apple's undo guidance supports predictable, visible recovery and familiar input conventions. [H49]

### 38.4 Concurrent edits

- Show when content changed elsewhere if it affects the current edit.
- Preserve the local draft.
- Offer compare/refresh/resolve rather than silently overwriting.
- Display a version/conflict state distinctly from ordinary network failure.
- A locked/read-only object explains its state.
- A successful stale response MUST not show the wrong latest state.
- Avoid duplicate commits through appropriate pending guards and backend support.

### 38.5 Offline and stale data

- Keep available content visible when safe.
- Show offline/stale status near affected work.
- Distinguish locally queued changes from synced changes.
- Retry synchronization without discarding drafts.
- Explain unsupported offline actions before the user loses time.
- Do not claim offline support if the app only caches its shell.
- Sensitive content persistence follows the existing product architecture and user expectations.

## 39. Migration strategy for an existing project

### 39.1 Audit before edits

Inspect:

- Framework and styling approach.
- Shared layout/navigation.
- Existing components and dependencies.
- Important routes and workflows.
- Current theme and responsive behavior.
- Validation, pending states, and permission logic.
- Product-specific constraints.
- Existing test/check commands.
- Original screenshot baselines at meaningful sizes.

Do not begin by rewriting every page independently.

### 39.2 Implement in order

1. Define profiles and semantic tokens.
2. Normalize typography, base surfaces, and focus.
3. Update the application/marketing shell.
4. Update shared buttons, fields, choices, overlays, and navigation.
5. Update lists/tables/cards.
6. Update primary workflows and screen compositions.
7. Complete missing edge states.
8. Add narrow-screen adaptations.
9. Verify themes, keyboard use, text growth, and errors.
10. Remove obsolete style fragments.

### 39.3 Preservation rules

- Keep routes and deep links working.
- Preserve authorization and feature gating.
- Preserve actual API contract/validation rules.
- Do not replace real data with demo values.
- Do not remove existing useful fields merely to fit a cleaner screenshot.
- Do not create different versions of the same component on different routes.
- Keep the project's existing component library if it can satisfy the spec.
- If migrating a component, update all uses or provide a deliberate compatible transition.
- Do not deploy/publish or change production settings merely because the UI is finished; those actions follow the project's authorized workflow.

### 39.4 Scope decisions

- Prioritize shared components and the most-used routes first.
- A completed redesign includes the full relevant workflow, not just the landing state.
- Rare admin routes still use the same tokens and basic controls.
- If a specialized screen requires different density, document the reason.
- Do not stretch the task into an unrelated feature rebuild.

## 40. Common failure patterns and exact corrections

| Failure | Correction |
| --- | --- |
| Every element in its own card | Group related content; use headings/spacing before adding containers |
| Every card has glass | Keep data/content opaque; limit material to useful floating chrome |
| Oversized dashboard headings | Use application scale, not marketing display scale |
| Faint gray instructions | Use readable secondary text and verify actual contrast |
| Blue everywhere | Reserve accent for action, selection, links, and purposeful emphasis |
| Several filled CTAs in one task | Pick the main action; use secondary/tertiary variants for the rest |
| Tiny icon controls | Keep glyph small but provide a real usable target and name |
| Icons from several visual styles | Choose one family; align weight, size, and detail |
| Heavy borders and shadows together | Use one primary grouping/depth treatment |
| Fixed-height text cards | Use content-driven sizing and consistent internal spacing |
| Desktop sidebar squeezed onto mobile | Convert navigation and prioritize one working pane |
| Form labels only in placeholders | Add persistent labels and associated helper/error text |
| Dialog closes after failed save | Keep the surface and draft; show the actual error |
| Toast is the only critical error | Keep a contextual persistent error/recovery path |
| Hover reveals the only edit action | Add keyboard/touch access or keep the action visible |
| Animation blocks input | Make it brief, interruptible, or remove it |
| Scroll hijacking for product effects | Keep native scrolling; make effects optional and passive |
| Fake progress percentage | Use measured progress or honest indeterminate status |
| “Success” means only request queued | Name the actual state |
| Dark mode is an inversion filter | Use semantic dark colors and deliberate asset treatment |
| Browser app copies OS window chrome | Use real browser/app composition |
| Red/green diff only | Add labels, gutters, or symbols |
| Long table values cut silently | Reveal important values through wrapping/detail/appropriate width |
| Same empty state for every condition | Distinguish no data, no matches, denied access, and failure |
| Restyled UI drops functionality | Restore workflow parity and test the primary task |

## 41. Reference CSS implementation

This is an original starter implementation for the web defaults. Adapt selectors to the project and reuse its framework/component infrastructure. It is not a complete application or a replacement for accessible component behavior.

### 41.1 Tokens and theme resolution

Token names in CSS add a “ui” prefix to the semantic names above.

~~~css
:root {
  color-scheme: light;
  --ui-font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    "Helvetica Neue", Arial, sans-serif;
  --ui-font-mono: ui-monospace, "SFMono-Regular", Consolas,
    "Liberation Mono", monospace;

  --ui-canvas: #f5f5f7;
  --ui-surface: #ffffff;
  --ui-surface-subtle: #f5f5f7;
  --ui-surface-raised: #ffffff;
  --ui-surface-hover: #efeff2;
  --ui-surface-selected: #e8f2ff;
  --ui-text-primary: #1d1d1f;
  --ui-text-secondary: #616166;
  --ui-text-tertiary: #68686e;
  --ui-text-placeholder: #68686e;
  --ui-text-on-action: #ffffff;
  --ui-action-primary: #0071e3;
  --ui-action-hover: #0066cc;
  --ui-action-pressed: #005bb5;
  --ui-link: #0066cc;
  --ui-focus: #0066cc;
  --ui-border-subtle: #d2d2d7;
  --ui-border-control: #85858b;
  --ui-success-ink: #176b37;
  --ui-success-surface: #eaf7ee;
  --ui-warning-ink: #7a4b00;
  --ui-warning-surface: #fff4dd;
  --ui-danger-ink: #b4232c;
  --ui-danger-surface: #fff0f1;
  --ui-danger-solid: #b4232c;
  --ui-danger-hover: #a01f27;
  --ui-danger-pressed: #891b21;
  --ui-info-ink: #145c9e;
  --ui-info-surface: #eaf3ff;
  --ui-scrim: rgb(0 0 0 / 32%);
  --ui-material: rgb(255 255 255 / 88%);

  --ui-shadow-card: 0 2px 8px rgb(0 0 0 / 4%);
  --ui-shadow-floating: 0 8px 24px rgb(0 0 0 / 12%);
  --ui-shadow-modal: 0 24px 80px rgb(0 0 0 / 20%);

  --ui-space-1: 0.125rem;
  --ui-space-2: 0.25rem;
  --ui-space-3: 0.375rem;
  --ui-space-4: 0.5rem;
  --ui-space-5: 0.75rem;
  --ui-space-6: 1rem;
  --ui-space-7: 1.25rem;
  --ui-space-8: 1.5rem;
  --ui-space-9: 2rem;
  --ui-space-10: 2.5rem;
  --ui-space-11: 3rem;
  --ui-space-12: 4rem;
  --ui-space-13: 5rem;
  --ui-space-14: 6rem;
  --ui-space-15: 7.5rem;
  --ui-space-16: 10rem;

  --ui-radius-xs: 0.25rem;
  --ui-radius-sm: 0.5rem;
  --ui-radius-md: 0.75rem;
  --ui-radius-lg: 1rem;
  --ui-radius-xl: 1.25rem;
  --ui-radius-2xl: 1.75rem;
  --ui-radius-3xl: 2rem;
  --ui-radius-full: 9999px;

  --ui-duration-micro: 120ms;
  --ui-duration-fast: 180ms;
  --ui-duration-standard: 240ms;
  --ui-duration-slow: 320ms;
  --ui-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ui-ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --ui-control-min: 2.75rem;
  --ui-sidebar-width: 15rem;
  --ui-inspector-width: 20rem;
  --ui-header-height: 4rem;
  --ui-page-inset: 2rem;
  --ui-sticky-stack: var(--ui-header-height);
}

/* A minimal runtime sets data-theme to resolved "light" or "dark".
   Keep the stored preference ("system" / "light" / "dark") separate.
   Apply the resolved value before paint where the framework supports it. */
:root[data-theme="dark"] {
  color-scheme: dark;
  --ui-canvas: #101012;
  --ui-surface: #1c1c1e;
  --ui-surface-subtle: #242426;
  --ui-surface-raised: #2c2c2e;
  --ui-surface-hover: #333336;
  --ui-surface-selected: #14365a;
  --ui-text-primary: #f5f5f7;
  --ui-text-secondary: #b7b7bd;
  --ui-text-tertiary: #a1a1a8;
  --ui-text-placeholder: #a1a1a8;
  --ui-link: #64acff;
  --ui-focus: #64acff;
  --ui-border-subtle: #444449;
  --ui-success-ink: #8ae6a5;
  --ui-success-surface: #173322;
  --ui-warning-ink: #ffd27d;
  --ui-warning-surface: #382b16;
  --ui-danger-ink: #ff9ca3;
  --ui-danger-surface: #401c22;
  --ui-info-ink: #9bcaff;
  --ui-info-surface: #172d47;
  --ui-scrim: rgb(0 0 0 / 56%);
  --ui-material: rgb(28 28 30 / 90%);
  --ui-shadow-card: none;
  --ui-shadow-floating: 0 8px 24px rgb(0 0 0 / 32%);
  --ui-shadow-modal: 0 24px 80px rgb(0 0 0 / 48%);
}
~~~

### 41.2 Base, hierarchy, and layout

~~~css
*, *::before, *::after { box-sizing: border-box; }
html {
  scroll-padding-block-start: calc(var(--ui-sticky-stack) + 1rem);
}
body {
  margin: 0;
  background: var(--ui-canvas);
  color: var(--ui-text-primary);
  font-family: var(--ui-font);
  font-size: 1rem;
  line-height: 1.5;
}
button, input, select, textarea { font: inherit; }
img, video { max-inline-size: 100%; block-size: auto; }
svg { flex-shrink: 0; }
a { color: var(--ui-link); text-underline-offset: 0.15em; }
[id] { scroll-margin-block-start: calc(var(--ui-sticky-stack) + 1rem); }

:focus-visible {
  outline: 2px solid var(--ui-focus);
  outline-offset: 3px;
}
.ui-page-title {
  margin: 0;
  font-size: 2rem;
  line-height: 1.1875;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.ui-section-title {
  margin: 0;
  font-size: 1.5rem;
  line-height: 1.25;
  font-weight: 600;
  letter-spacing: -0.015em;
}
.ui-copy {
  max-inline-size: 65ch;
  font-size: 1.0625rem;
  line-height: 1.53;
}
.ui-meta {
  color: var(--ui-text-tertiary);
  font-size: 0.8125rem;
  line-height: 1.385;
}
.ui-metric {
  font-size: 2.125rem;
  line-height: 1.176;
  font-weight: 600;
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
}
.ui-page {
  inline-size: min(100%, 75rem);
  margin-inline: auto;
  padding: var(--ui-space-9) var(--ui-page-inset);
}
.ui-shell {
  display: grid;
  grid-template-columns: var(--ui-sidebar-width) minmax(0, 1fr);
  min-block-size: 100dvh;
}
.ui-main { min-inline-size: 0; }
.ui-stack { display: grid; gap: var(--ui-space-8); }
.ui-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17.5rem), 1fr));
  gap: var(--ui-space-8);
}
.ui-card {
  min-inline-size: 0;
  padding: var(--ui-space-8);
  background: var(--ui-surface);
  border: 1px solid var(--ui-border-subtle);
  border-radius: var(--ui-radius-lg);
}
.ui-sr-only {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
.ui-skip-link {
  position: fixed;
  inset-block-start: 0.75rem;
  inset-inline-start: 0.75rem;
  z-index: 1000;
  padding: 0.75rem 1rem;
  background: var(--ui-surface-raised);
  color: var(--ui-text-primary);
  border: 1px solid var(--ui-border-control);
  border-radius: var(--ui-radius-md);
  transform: translateY(-200%);
}
.ui-skip-link:focus { transform: translateY(0); }
~~~

### 41.3 Controls and feedback

~~~css
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-4);
  min-block-size: var(--ui-control-min);
  padding: 0.625rem 1rem;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-md);
  font-size: 0.9375rem;
  line-height: 1.3334;
  font-weight: 500;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color var(--ui-duration-micro) var(--ui-ease),
    border-color var(--ui-duration-micro) var(--ui-ease),
    color var(--ui-duration-micro) var(--ui-ease);
}
.ui-button--primary {
  color: var(--ui-text-on-action);
  background: var(--ui-action-primary);
}
.ui-button--primary:active:not(:disabled):not([aria-disabled="true"]) {
  background: var(--ui-action-pressed);
}
.ui-button--secondary {
  color: var(--ui-text-primary);
  background: var(--ui-surface);
  border-color: var(--ui-border-control);
}
.ui-button--tertiary {
  color: var(--ui-link);
  background: transparent;
}
.ui-button--danger {
  color: var(--ui-text-on-action);
  background: var(--ui-danger-solid);
}
.ui-button--danger:active:not(:disabled):not([aria-disabled="true"]) {
  background: var(--ui-danger-pressed);
}
.ui-button--secondary:active:not(:disabled):not([aria-disabled="true"]),
.ui-button--tertiary:active:not(:disabled):not([aria-disabled="true"]) {
  background: var(--ui-surface-selected);
}
.ui-button--pill { border-radius: var(--ui-radius-full); }
.ui-button--icon {
  inline-size: var(--ui-control-min);
  padding: 0.5rem;
}
.ui-button:disabled,
.ui-button[aria-disabled="true"] {
  opacity: 0.5;
  cursor: default;
}
/* aria-disabled also requires an activation guard in component logic. */
.ui-button[aria-busy="true"] { cursor: progress; }
.ui-field-group { display: grid; gap: 0.375rem; }
.ui-label {
  font-size: 0.9375rem;
  line-height: 1.4;
  font-weight: 500;
}
.ui-field {
  inline-size: 100%;
  min-block-size: var(--ui-control-min);
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--ui-border-control);
  border-radius: var(--ui-radius-md);
  background: var(--ui-surface);
  color: var(--ui-text-primary);
  font-size: 1rem;
  line-height: 1.5;
}
.ui-field::placeholder { color: var(--ui-text-placeholder); opacity: 1; }
.ui-field[aria-invalid="true"] { border-color: var(--ui-danger-ink); }
.ui-field:disabled { opacity: 0.55; cursor: not-allowed; }
.ui-field[readonly] { background: var(--ui-surface-subtle); }
.ui-help, .ui-error {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.43;
}
.ui-help { color: var(--ui-text-secondary); }
.ui-error { color: var(--ui-danger-ink); }
.ui-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.ui-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: var(--ui-radius-md);
}
.ui-banner--warning {
  color: var(--ui-warning-ink);
  background: var(--ui-warning-surface);
}
.ui-banner--danger {
  color: var(--ui-danger-ink);
  background: var(--ui-danger-surface);
}
@media (hover: hover) and (pointer: fine) {
  .ui-button--primary:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--ui-action-hover);
  }
  .ui-button--danger:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--ui-danger-hover);
  }
  .ui-button--secondary:hover:not(:disabled):not([aria-disabled="true"]),
  .ui-button--tertiary:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--ui-surface-hover);
  }
  .ui-button--primary:hover:active:not(:disabled):not([aria-disabled="true"]) {
    background: var(--ui-action-pressed);
  }
  .ui-button--danger:hover:active:not(:disabled):not([aria-disabled="true"]) {
    background: var(--ui-danger-pressed);
  }
  .ui-button--secondary:hover:active:not(:disabled):not([aria-disabled="true"]),
  .ui-button--tertiary:hover:active:not(:disabled):not([aria-disabled="true"]) {
    background: var(--ui-surface-selected);
  }
}
~~~

### 41.4 Material, dialog, and responsive rules

~~~css
.ui-chrome {
  background: var(--ui-surface);
  border-block-end: 1px solid var(--ui-border-subtle);
}
@supports (backdrop-filter: blur(1px)) {
  .ui-chrome[data-material="true"] {
    background: var(--ui-material);
    backdrop-filter: blur(20px) saturate(1.15);
  }
}
.ui-dialog {
  inline-size: min(35rem, calc(100vw - 2rem));
  max-block-size: calc(100dvh - 3rem);
  padding: 1.5rem;
  overflow: auto;
  color: var(--ui-text-primary);
  background: var(--ui-surface-raised);
  border: 1px solid var(--ui-border-subtle);
  border-radius: var(--ui-radius-xl);
  box-shadow: var(--ui-shadow-modal);
}
.ui-dialog::backdrop { background: var(--ui-scrim); }
.ui-marketing-title {
  margin: 0;
  font-size: clamp(2.5rem, 1.5rem + 4vw, 5rem);
  line-height: 1.05;
  font-weight: 600;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
.ui-marketing-section { padding-block: 6rem; }
.ui-media-tile {
  overflow: hidden;
  border-radius: var(--ui-radius-2xl);
  background: var(--ui-surface-subtle);
}
@media (max-width: 899px) {
  .ui-shell { grid-template-columns: minmax(0, 1fr); }
  /* Navigation changes to an accessible drawer/top-level control.
     Do not merely hide it without supplying that control. */
  :root { --ui-page-inset: 1.5rem; }
}
@media (max-width: 599px) {
  :root { --ui-page-inset: 1.25rem; }
  .ui-page-title { font-size: 1.875rem; line-height: 1.2; }
  .ui-section-title { font-size: 1.375rem; line-height: 1.273; }
  .ui-meta { font-size: 0.875rem; line-height: 1.43; }
  .ui-button { font-size: 1rem; }
  .ui-grid { gap: 1rem; }
  .ui-card { padding: 1.25rem; }
  .ui-marketing-section { padding-block: 4rem; }
  .ui-marketing-title { line-height: 1.08; }
}
@media (prefers-reduced-motion: reduce) {
  .ui-button, .ui-chrome, .ui-dialog, .ui-media-tile {
    transition: none;
    animation: none;
  }
  html { scroll-behavior: auto; }
  /* Explicitly disable any additional project animations and parallax. */
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .ui-chrome[data-material="true"] {
    background: var(--ui-surface);
    backdrop-filter: none;
  }
}
:root[data-reduce-effects="true"] .ui-chrome[data-material="true"] {
  background: var(--ui-surface);
  backdrop-filter: none;
}
@media (prefers-contrast: more) {
  .ui-card { border-color: var(--ui-border-control); }
}
@media (forced-colors: active) {
  .ui-button, .ui-field, .ui-dialog, .ui-card, .ui-banner {
    background: Canvas;
    color: CanvasText;
    border: 1px solid ButtonText;
    box-shadow: none;
  }
  a { color: LinkText; }
  :focus-visible { outline-color: Highlight; }
  .ui-chrome[data-material="true"] {
    background: Canvas;
    backdrop-filter: none;
  }
}
~~~

Support for preference queries varies. The opaque default is intentional. If the project needs Safari-specific backdrop-filter support, use its existing compatibility policy and feature detection rather than adding unsupported effects.

### 41.5 Theme runtime behavior

Implement through the project's framework:

1. Read a stored explicit preference if the product offers one.
2. Otherwise resolve the system color-scheme preference.
3. Apply the resolved data-theme before visible rendering when feasible.
4. Listen for system changes only when the stored choice is System.
5. Keep form controls' native color-scheme aligned.
6. Handle unavailable storage without breaking rendering.
7. Do not persist a user preference from a transient preview/test override.

Do not duplicate the entire dark palette in two competing media-query and class-based systems.

## 42. Reference markup and component contracts

### 42.1 Labeled field with error

This example represents an actual invalid state. Rendering logic removes aria-invalid and the error association after correction.

~~~html
<div class="ui-field-group">
  <label class="ui-label" for="contact-email">Email address</label>
  <input
    class="ui-field"
    id="contact-email"
    name="email"
    type="email"
    autocomplete="email"
    required
    aria-invalid="true"
    aria-describedby="email-help email-error"
  >
  <p class="ui-help" id="email-help">We'll send the confirmation here.</p>
  <p class="ui-error" id="email-error">Enter a valid email address.</p>
</div>
~~~

### 42.2 Named icon action

Use an SVG from the project's licensed icon family:

~~~html
<button class="ui-button ui-button--tertiary ui-button--icon"
        type="button" aria-label="Search bookings">
  <svg width="20" height="20" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" stroke-width="1.75"
       aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="6.5"></circle>
    <path d="M15.5 15.5 21 21"></path>
  </svg>
</button>
~~~

### 42.3 Primary navigation

~~~html
<nav aria-label="Primary">
  <a href="/overview" aria-current="page">Overview</a>
  <a href="/schedule">Schedule</a>
  <a href="/activity">Activity</a>
  <a href="/settings">Settings</a>
</nav>
~~~

Replace sample destinations with the project's real routes. Ordinary navigation is not an ARIA action menu.

### 42.4 Modal contract

A dialog component MUST expose:

- Open/closed state.
- Accessible title.
- Trigger/focus restoration handling.
- Initial-focus policy.
- Safe close/cancel behavior.
- Pending/error state.
- Actual commit handler.
- Background inertness/scroll behavior.
- Responsive sizing.

With native dialog, use showModal for modal behavior. Merely adding the open attribute does not create the same modal interaction. A dedicated nonmodal inspector uses a different contract. Follow a proven framework component or the applicable APG pattern. [R07]

### 42.5 Button contract

Recommended component properties:

| Property | Meaning |
| --- | --- |
| variant | Primary / secondary / tertiary / destructive |
| size | Standard / large / compact |
| loading | Actual pending state |
| loadingLabel | Specific accessible/visible task label |
| disabled | Unavailable interaction |
| leadingIcon | Optional meaningful icon |
| trailingIcon | Optional disclosure/destination cue |
| type | Explicit button / submit / reset as appropriate |
| href | Navigation renders a link rather than fake button semantics |
| accessibleLabel | Required for icon-only use |

Do not invent a clickable generic div to unify link/button styling.

### 42.6 Field contract

Expose label, value, onChange, required, help, error, readOnly, disabled, input type, autocomplete, and relevant constraints. The component generates stable IDs and correctly connects label/help/error. It MUST not decide backend validation rules merely from visual appearance.

### 42.7 Controlled-choice contract

Expose current value, options, disabled options, accessible group label, change callback, and pending/failure state when changes persist remotely. Semantics depend on the actual job: radio group, tabs, switch, checkbox, or listbox.

## 43. Screen and state inventory

Before calling the redesign complete, build a route/state inventory:

| Screen/component | Rest/populated | Loading | Empty | Failure | Narrow | Dark | Keyboard |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Application shell | Required | Initial shell | Workspace missing | Access/session failure | Required | Required if supported | Required |
| Dashboard | Required | Per widget | New workspace | Per widget | Required | Required if supported | Required |
| List/table | Required | Initial/update | No data/no matches | Load/mutation | Required | Required if supported | Required |
| Detail/editor | Required | Local pane | No selection | Save/conflict | Required | Required if supported | Required |
| Create/edit form | Required | Submit/options | Initial form | Validation/server | Required | Required if supported | Required |
| Search | Results | Updating | No matches | Failed query | Required | Required if supported | Required |
| Dialog/sheet | Open | Commit | If relevant | Commit/validation | Required | Required if supported | Required |
| Recording | Active/paused | Access/processing | Ready | Denied/interrupted | Required | Required if supported | Required |
| Checkout | Real selection | Payment | Empty basket | Payment/availability | Required | As supported | Required |
| Settings | Current values | Save/connect | Missing setup | Save/permission | Required | Required if supported | Required |
| Marketing | Main content | Media placeholders | Media fallback | Broken media/form | Required | Editorial choice | Required |

Mark nonapplicable states explicitly. Do not leave unchecked blanks that imply verification.

## 44. Verification checklist

### 44.1 Visual checks

- [ ] Capture representative routes at 390 px, 768 px, 1024 px, and 1440 px widths.
- [ ] Add 320 px when checking reflow.
- [ ] Check at least one very wide/resizable workspace if applicable.
- [ ] Primary content is recognizable immediately.
- [ ] Titles, controls, and data use the correct profile.
- [ ] Repeated elements align.
- [ ] No arbitrary spacing/radius/color values bypass tokens.
- [ ] No page-wide accidental horizontal overflow.
- [ ] Main image crops preserve meaningful content.
- [ ] Long values and realistic data volumes fit.
- [ ] No controls clip or overlap at text growth.
- [ ] Light/dark themes have deliberate depth and assets.
- [ ] Materials remain readable over varied content.

### 44.2 Interaction checks

- [ ] Hover, press, focus, selected, disabled, and busy states work.
- [ ] Primary workflow completes with real behavior.
- [ ] Browser Back/deep links work.
- [ ] Search/filter state remains coherent.
- [ ] Menus can open, navigate, select, and close.
- [ ] Dialog focus enters/restores correctly.
- [ ] Background content is inert only for modal surfaces.
- [ ] Pending actions prevent accidental duplicate work.
- [ ] Failed saves keep drafts.
- [ ] Destructive actions state their actual consequences.
- [ ] Undo works where advertised.
- [ ] Mobile keyboard does not hide the active field or required action.
- [ ] Touch users can access actions that desktop exposes on hover.

### 44.3 Accessibility checks

- [ ] Names, roles, and states are accurate.
- [ ] Heading outline and landmarks are coherent.
- [ ] Labels and errors are associated.
- [ ] Full primary task is keyboard-operable.
- [ ] Focus is visible and not covered.
- [ ] Screen-reader announcements are useful and restrained.
- [ ] Color is not the sole status channel.
- [ ] Required contrast pairs pass.
- [ ] 200% text and 400% zoom work.
- [ ] Reduced motion works.
- [ ] Applicable higher contrast/forced colors work.
- [ ] Dragging has an alternative.
- [ ] Meaningful media has captions/transcripts as applicable.
- [ ] Password managers/autofill/paste work.

### 44.4 Product and technical checks

- [ ] No authorization or API behavior regressed.
- [ ] Real values and units remain accurate.
- [ ] No fake progress or success states.
- [ ] Offline/stale/permission states are understandable.
- [ ] Existing required checks/build pass.
- [ ] Run meaningful interaction tests for changed risky behavior.
- [ ] Do not add tests that merely repeat static CSS declarations.
- [ ] Images/font/icon payloads remain proportionate.
- [ ] Layout shift and responsiveness are assessed.
- [ ] Existing route/workflow tests are preserved.

### 44.5 Verification record

Record the route, viewport, appearance, state, method, result, and unresolved issue. Distinguish “visually inspected,” “automated check passed,” and “workflow exercised.” Do not label a screen verified solely because the application compiles.

## 45. Review scorecard

Score each item 0–2: 0 = missing/broken, 1 = inconsistent/partial, 2 = complete and verified.

| Dimension | What earns 2 |
| --- | --- |
| Hierarchy | Main task, title, content, and action are unambiguous |
| Typography | Correct scales, readable text, robust growth |
| Spacing | Coherent shared rhythm and grouping |
| Surfaces | Appropriate opaque/material distinction |
| Color | Semantic use and checked contrast |
| Components | Shared rules across all relevant routes |
| Interaction | Complete truthful state transitions |
| Responsiveness | Useful narrow and resizable layouts |
| Accessibility | Keyboard, semantics, contrast, zoom, preferences verified |
| Preservation | Existing workflows/data/permissions remain intact |

Project quality target: at least 18/20, with no zero in interaction, accessibility, or preservation. This score is an internal review heuristic, not an official Apple or accessibility certification.

## 46. Execution instructions for a coding agent

### 46.1 Required workflow

1. Read project instructions and inspect the implementation.
2. Identify the relevant profiles.
3. Produce a concise route/component/state inventory.
4. Reuse compatible existing components and dependencies.
5. Implement semantic tokens and themes.
6. Update shared primitives.
7. Update shared navigation/layout.
8. Apply coherent screen compositions.
9. Complete states and recovery paths.
10. Verify realistic content at required sizes.
11. Run the project's appropriate checks.
12. Fix discovered issues before reporting completion.

### 46.2 Decision behavior

- Make routine reversible visual choices using this spec.
- Ask only when a material product ambiguity cannot be resolved from the existing implementation.
- Do not block on selecting between two equally suitable radius values.
- If backend behavior is unclear, inspect it before claiming a state.
- If the project lacks dark mode, assess scope and implement the applicable web theme when authorized; do not silently claim support.
- If a feature is missing, report it rather than hiding its absence.
- Work through all authorized routes/components, keeping scope focused on the UI request.

### 46.3 Change report

Report:

- What changed and the resulting behavior.
- Which profiles and tokens were used.
- Which workflows and viewports were checked.
- Important accessibility verification.
- Exceptions and remaining gaps.
- Any behavior changes that went beyond styling and why they were necessary.

Avoid a long chronological log of CSS edits.

## 47. Exceptions and customization

### 47.1 Exception format

| Field | Required content |
| --- | --- |
| Rule | The relevant section/token |
| Surface | Exact component/route |
| Reason | Concrete task, accessibility, platform, or content need |
| Alternative | Implemented replacement |
| Verification | How the replacement was checked |

Example: A large reconciliation table uses 38 px rows on fine-pointer desktop because the task requires many simultaneous records. Touch mode uses 48 px rows, and keyboard selection/focus is verified.

### 47.2 Brand adaptation

The project MAY replace:

- Accent hue.
- Logo.
- Original photography/illustration.
- A licensed compatible font.
- A restrained signature interaction.

It MUST retain:

- Semantic color roles.
- Readable hierarchy.
- Consistent components.
- Accessible states.
- Appropriate platform behavior.
- Honest status and recovery.

Do not use “brand personality” to justify unreadable controls or unfamiliar destructive behavior.

## 48. Compact rules and reusable full prompt

### 48.1 Highest-value rules

1. Make the user's task or the product benefit dominate.
2. Separate marketing composition from application composition.
3. Use semantic tokens and shared components.
4. Choose readable system typography and role-based scales.
5. Group through whitespace before adding cards.
6. Keep content opaque and glass restrained.
7. Use accent for action/selection, not everything.
8. Make every interaction state visible and truthful.
9. Preserve drafts, context, and a way to recover.
10. Adapt navigation and workspaces, not just font sizes.
11. Support keyboard, touch, screen readers, zoom, and reduced motion.
12. Verify the whole workflow with realistic content.

### 48.2 Copyable project instruction

> Redesign this project's UI using Apple_Inspired_UI_Design_Guidelines.md as the implementation specification. First inspect the existing framework, components, routes, and primary workflows. Select Marketing, Application, or Compact profiles per surface. Build semantic tokens for color, type, spacing, radii, elevation, motion, and layers; update reusable components before page-specific styling. Apply restrained neutral surfaces, deliberate whitespace, strong readable hierarchy, meaningful accent use, consistent icons, and limited translucent navigation/control chrome. Keep data, forms, editors, and review surfaces opaque.
>
> Complete hover, press, focus, selection, disabled, pending, error, empty, and success states wherever applicable. Preserve real functionality, permissions, data, integrations, routes, drafts, and user context. Use appropriate semantic HTML/native components, readable contrast, touch targets, keyboard behavior, accessible overlays, and responsive layouts. Honor relevant appearance and reduced-effect preferences. Do not copy Apple branding or proprietary assets.
>
> Apply the detailed screen recipes and component requirements in the file, including truthful AI/recording/transaction states if relevant. Verify important routes with realistic data at narrow, medium, and wide sizes, in applicable themes and failure states. Run the project's required checks and meaningful workflow tests. Fix discovered issues. Deliver a concise summary of changes, verification, exceptions, and any remaining gaps.

## 49. Sources and research notes

### 49.1 Apple website samples

Website appearance and product content can change. The observations above reflect available pages and stylesheet declarations reviewed on the research date.

| ID | Source | Research use |
| --- | --- | --- |
| W01 | [Apple homepage](https://www.apple.com/) | Global navigation, product sections, CTA rhythm, neutral palette |
| W02 | [iPhone category](https://www.apple.com/iphone/) | Category composition, typography, tiles, primary-action styles |
| W03 | [MacBook Air](https://www.apple.com/macbook-air/) | Product narrative, reading scale, galleries, section composition |
| W04 | [iPad category](https://www.apple.com/ipad/) | Product/category structure and imagery |
| W05 | [Apple Store](https://www.apple.com/store) | Offer/category organization and transactional entry points |
| W06 | [iOS overview](https://www.apple.com/os/ios/) | Current product UI presentation and design context |
| W07 | [macOS overview](https://www.apple.com/os/macos/) | Current desktop product UI presentation and design context |
| W08 | [Global header CSS sampled](https://www.apple.com/api-www/global-elements/global-header/v1/assets/globalheader.css) | Header variables and neutral colors |
| W09 | [Homepage CSS sampled](https://www.apple.com/v/homepage/a/styles/homepage.built.css) | Navigation-height and palette declarations |
| W10 | [iPhone CSS sampled](https://www.apple.com/v/iphone/home/ck/built/styles/overview.built.css) | Display/body type, button, tile declarations |
| W11 | [MacBook Air base CSS sampled](https://www.apple.com/v/macbook-air/z/built/styles/main.built.css) | Body/headline and container declarations |
| W12 | [MacBook Air overview CSS sampled](https://www.apple.com/v/macbook-air/z/built/styles/overview.built.css) | Product-specific overrides and gallery composition |

Do not copy these stylesheets into a project. The specification translates selected evidence into an independent token/component system.

### 49.2 Human Interface Guidelines

HIG article content was read from Apple's official documentation data underlying the public pages. The links below are the human-facing sources. Brief source-supported principles are separated from this document's numerical project defaults.

| ID | Official topic | Main relevance |
| --- | --- | --- |
| H01 | [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles) | Current conceptual foundation |
| H02 | [Typography](https://developer.apple.com/design/human-interface-guidelines/typography) | Legibility, system text styles, platform size guidance |
| H03 | [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Hierarchy, grouping, adaptation |
| H04 | [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) | Liquid Glass boundaries and standard materials |
| H05 | [Icons](https://developer.apple.com/design/human-interface-guidelines/icons) | Simplification, consistency, optical alignment |
| H06 | [SF Symbols](https://developer.apple.com/design/human-interface-guidelines/sf-symbols) | Native symbol behavior |
| H07 | [Branding](https://developer.apple.com/design/human-interface-guidelines/branding) | Brand restraint and familiar components |
| H08 | [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) | Purpose, prominence, press state, hit regions |
| H09 | [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) | Navigation hierarchy and adaptation |
| H10 | [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | Destination navigation, stability, labels |
| H11 | [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Action grouping and standard controls |
| H12 | [Menus](https://developer.apple.com/design/human-interface-guidelines/menus) | Command organization |
| H13 | [Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus) | Contextual action access |
| H14 | [Pop-up buttons](https://developer.apple.com/design/human-interface-guidelines/pop-up-buttons) | Selection controls |
| H15 | [Pull-down buttons](https://developer.apple.com/design/human-interface-guidelines/pull-down-buttons) | Action disclosure |
| H16 | [Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields) | Labels, validation, input size/order |
| H17 | [Segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls) | Related choices and state |
| H18 | [Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles) | Persistent binary state |
| H19 | [Pickers](https://developer.apple.com/design/human-interface-guidelines/pickers) | Structured selection |
| H20 | [Sliders](https://developer.apple.com/design/human-interface-guidelines/sliders) | Continuous-value interaction |
| H21 | [Steppers](https://developer.apple.com/design/human-interface-guidelines/steppers) | Incremental changes |
| H22 | [Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | Hierarchy and multicolumn productivity data |
| H23 | [Modality](https://developer.apple.com/design/human-interface-guidelines/modality) | Scoped interruption and dismissal |
| H24 | [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) | Related tasks and platform behavior |
| H25 | [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts) | Critical decisions and restrained interruption |
| H26 | [Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers) | Contextual anchored surfaces |
| H27 | [Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields) | Scope, suggestions, results |
| H28 | [Loading](https://developer.apple.com/design/human-interface-guidelines/loading) | Early useful content and background work |
| H29 | [Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators) | Honest progress feedback |
| H30 | [Charts](https://developer.apple.com/design/human-interface-guidelines/charts) | Mark type, axes, meaningful visual relationships |
| H31 | [Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop) | Direct manipulation |
| H32 | [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding) | Brief contextual learning |
| H33 | [Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy) | Timely permission, transparency, minimized access |
| H34 | [Settings](https://developer.apple.com/design/human-interface-guidelines/settings) | Preference structure |
| H35 | [Notifications](https://developer.apple.com/design/human-interface-guidelines/notifications) | Timely high-value information |
| H36 | [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback) | Clear response to interaction |
| H37 | [Motion](https://developer.apple.com/design/human-interface-guidelines/motion) | Purposeful optional brief motion |
| H38 | [Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards) | Full keyboard access and conventions |
| H39 | [Pointing devices](https://developer.apple.com/design/human-interface-guidelines/pointing-devices) | Pointer interaction |
| H40 | [Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures) | Familiar direct manipulation |
| H41 | [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Inclusive legibility/interaction and preferences |
| H42 | [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode) | Appearance adaptation |
| H43 | [Designing for iOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios) | Mobile platform intent |
| H44 | [Designing for iPadOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ipados) | Adaptive tablet experience |
| H45 | [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos) | Desktop platform intent |
| H46 | [Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets) | Glanceable focused surfaces |
| H47 | [Live Activities](https://developer.apple.com/design/human-interface-guidelines/live-activities) | Timely ongoing status |
| H48 | [Windows](https://developer.apple.com/design/human-interface-guidelines/windows) | Window/task organization |
| H49 | [Undo and redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo) | Recovery and familiar conventions |
| H50 | [Writing](https://developer.apple.com/design/human-interface-guidelines/writing) | Voice, contextual tone, clarity |
| H51 | [Color](https://developer.apple.com/design/human-interface-guidelines/color) | Semantic use and adaptive colors |
| H52 | [Scroll views](https://developer.apple.com/design/human-interface-guidelines/scroll-views) | Scrolling, nested regions, scroll edges |
| H53 | [Text views](https://developer.apple.com/design/human-interface-guidelines/text-views) | Longer editable content |
| H54 | [Labels](https://developer.apple.com/design/human-interface-guidelines/labels) | Readable descriptive text |
| H55 | [Action sheets](https://developer.apple.com/design/human-interface-guidelines/action-sheets) | Related action choices |
| H56 | [App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons) | App identity and platform appearance |
| H57 | [Multitasking](https://developer.apple.com/design/human-interface-guidelines/multitasking) | Context and window adaptation |
| H58 | [Launching](https://developer.apple.com/design/human-interface-guidelines/launching) | Initial app experience |

The central [Human Interface Guidelines index](https://developer.apple.com/design/human-interface-guidelines) provides the current taxonomy and additional specialized topics.

### 49.3 Implementation, licensing, and web accessibility references

| ID | Source | Used for |
| --- | --- | --- |
| R01 | [Apple fonts](https://developer.apple.com/fonts/) | Official typography resources and access to applicable terms |
| R02 | [SF Symbols](https://developer.apple.com/sf-symbols/) | Official symbol resources and usage context |
| R03 | [Apple UI design dos and don'ts](https://developer.apple.com/design/tips/) | Native touch-control guidance |
| R04 | [WCAG 2.2 contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Web text contrast and large-text threshold |
| R05 | [WCAG 2.2 target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | 24 px AA minimum and exceptions |
| R06 | [WCAG 2.2 reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | Narrow reflow and essential two-dimensional content |
| R07 | [ARIA APG modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Modal semantics, focus, and dismissal |
| R08 | [ARIA APG combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) | Custom selection/search semantics |
| R09 | [WCAG focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Focus visibility around sticky/overlay content |
| R10 | [WCAG non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | Required control/state visual distinctions |
| R11 | [Web Vitals](https://web.dev/articles/vitals) | LCP, INP, CLS thresholds and field measurement |
| R12 | [WCAG resize text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) | Text resizing |
| R13 | [WCAG dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Non-drag alternatives |

### 49.4 Maintenance

- Revisit official platform guidance when adopting a new OS/deployment target.
- Recheck materials and navigation rather than assuming an old visual treatment remains current.
- Keep project defaults versioned and change them centrally.
- Measure new color pairings and new component states.
- Update this specification when product requirements expose a justified exception.
- Preserve the distinction between Apple guidance, observed website declarations, and original project choices.

<!-- Reference keys for inline source citations. -->

[W01]: https://www.apple.com/
[W02]: https://www.apple.com/iphone/
[W03]: https://www.apple.com/macbook-air/
[W04]: https://www.apple.com/ipad/
[W05]: https://www.apple.com/store
[W06]: https://www.apple.com/os/ios/
[W07]: https://www.apple.com/os/macos/
[W08]: https://www.apple.com/api-www/global-elements/global-header/v1/assets/globalheader.css
[W09]: https://www.apple.com/v/homepage/a/styles/homepage.built.css
[W10]: https://www.apple.com/v/iphone/home/ck/built/styles/overview.built.css
[W11]: https://www.apple.com/v/macbook-air/z/built/styles/main.built.css
[W12]: https://www.apple.com/v/macbook-air/z/built/styles/overview.built.css
[H01]: https://developer.apple.com/design/human-interface-guidelines/design-principles
[H02]: https://developer.apple.com/design/human-interface-guidelines/typography
[H03]: https://developer.apple.com/design/human-interface-guidelines/layout
[H04]: https://developer.apple.com/design/human-interface-guidelines/materials
[H05]: https://developer.apple.com/design/human-interface-guidelines/icons
[H06]: https://developer.apple.com/design/human-interface-guidelines/sf-symbols
[H07]: https://developer.apple.com/design/human-interface-guidelines/branding
[H08]: https://developer.apple.com/design/human-interface-guidelines/buttons
[H09]: https://developer.apple.com/design/human-interface-guidelines/sidebars
[H10]: https://developer.apple.com/design/human-interface-guidelines/tab-bars
[H11]: https://developer.apple.com/design/human-interface-guidelines/toolbars
[H12]: https://developer.apple.com/design/human-interface-guidelines/menus
[H13]: https://developer.apple.com/design/human-interface-guidelines/context-menus
[H14]: https://developer.apple.com/design/human-interface-guidelines/pop-up-buttons
[H15]: https://developer.apple.com/design/human-interface-guidelines/pull-down-buttons
[H16]: https://developer.apple.com/design/human-interface-guidelines/text-fields
[H17]: https://developer.apple.com/design/human-interface-guidelines/segmented-controls
[H18]: https://developer.apple.com/design/human-interface-guidelines/toggles
[H19]: https://developer.apple.com/design/human-interface-guidelines/pickers
[H20]: https://developer.apple.com/design/human-interface-guidelines/sliders
[H21]: https://developer.apple.com/design/human-interface-guidelines/steppers
[H22]: https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
[H23]: https://developer.apple.com/design/human-interface-guidelines/modality
[H24]: https://developer.apple.com/design/human-interface-guidelines/sheets
[H25]: https://developer.apple.com/design/human-interface-guidelines/alerts
[H26]: https://developer.apple.com/design/human-interface-guidelines/popovers
[H27]: https://developer.apple.com/design/human-interface-guidelines/search-fields
[H28]: https://developer.apple.com/design/human-interface-guidelines/loading
[H29]: https://developer.apple.com/design/human-interface-guidelines/progress-indicators
[H30]: https://developer.apple.com/design/human-interface-guidelines/charts
[H31]: https://developer.apple.com/design/human-interface-guidelines/drag-and-drop
[H32]: https://developer.apple.com/design/human-interface-guidelines/onboarding
[H33]: https://developer.apple.com/design/human-interface-guidelines/privacy
[H34]: https://developer.apple.com/design/human-interface-guidelines/settings
[H35]: https://developer.apple.com/design/human-interface-guidelines/notifications
[H36]: https://developer.apple.com/design/human-interface-guidelines/feedback
[H37]: https://developer.apple.com/design/human-interface-guidelines/motion
[H38]: https://developer.apple.com/design/human-interface-guidelines/keyboards
[H39]: https://developer.apple.com/design/human-interface-guidelines/pointing-devices
[H40]: https://developer.apple.com/design/human-interface-guidelines/gestures
[H41]: https://developer.apple.com/design/human-interface-guidelines/accessibility
[H42]: https://developer.apple.com/design/human-interface-guidelines/dark-mode
[H43]: https://developer.apple.com/design/human-interface-guidelines/designing-for-ios
[H44]: https://developer.apple.com/design/human-interface-guidelines/designing-for-ipados
[H45]: https://developer.apple.com/design/human-interface-guidelines/designing-for-macos
[H46]: https://developer.apple.com/design/human-interface-guidelines/widgets
[H47]: https://developer.apple.com/design/human-interface-guidelines/live-activities
[H48]: https://developer.apple.com/design/human-interface-guidelines/windows
[H49]: https://developer.apple.com/design/human-interface-guidelines/undo-and-redo
[H50]: https://developer.apple.com/design/human-interface-guidelines/writing
[H51]: https://developer.apple.com/design/human-interface-guidelines/color
[H52]: https://developer.apple.com/design/human-interface-guidelines/scroll-views
[H53]: https://developer.apple.com/design/human-interface-guidelines/text-views
[H54]: https://developer.apple.com/design/human-interface-guidelines/labels
[H55]: https://developer.apple.com/design/human-interface-guidelines/action-sheets
[H56]: https://developer.apple.com/design/human-interface-guidelines/app-icons
[H57]: https://developer.apple.com/design/human-interface-guidelines/multitasking
[H58]: https://developer.apple.com/design/human-interface-guidelines/launching
[R01]: https://developer.apple.com/fonts/
[R02]: https://developer.apple.com/sf-symbols/
[R03]: https://developer.apple.com/design/tips/
[R04]: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
[R05]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
[R06]: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
[R07]: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
[R08]: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
[R09]: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
[R10]: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
[R11]: https://web.dev/articles/vitals
[R12]: https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html
[R13]: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
