# SkillPath AI — design brief

Sources: ui-ux-pro-max (rules, tokens), design-taste-frontend / taste-skill (landing direction), web-design-guidelines (audit).
Full landing direction sheet: `docs/design/taste-sheet-landing.md` (seed 5644890, direction `type-only-statement`).

## Decisions and deviations from the dealt sheet (record in the report)
1. **Type: Onest** (display 700-800, text 400-500) via `next/font/google` with `subsets: ['latin','cyrillic']`.
   Dealt face Red Hat Display has no Cyrillic glyphs → redrawn for coverage.
2. **Colour: keep the product's dark navy ground, replace violet.** House rules ban violet/indigo accents and the
   dealt "candy chapters" palette would clash with the dark app. Tokens (single source, `tailwind.config.js` + CSS vars):
   - ground `#0b1020`, surface `#121936`, surface-2 `#1a2347`, ink `#f2f5ff`, muted `#aab3d6` (>= 4.5:1 on ground)
   - accent `#c8f169` (lime), accent-ink `#0b1020`; danger `#ff6b6b`; success `#5ee6a8`
   - Landing may use one inverted field (ground ↔ ink) for CTA and footer.
   Replace the old violet token usage everywhere (`accent`, `btn-primary`, progress bars, focus rings).
3. **Hero live thing:** instead of variable-font chips, the hero carries a working mini-quiz (2 questions about Python,
   real content). Wrong answer → an "ИИ-наставник" response appears with a short explanation (static canned text, no API call).
   Idea sentence: "On this page, **the mistake in a quiz** becomes **the explanation the tutor writes back**."
4. Everything else from the sheet is adopted: statement hero (2 lines, 9–14vw, full width), capabilities-as-menu,
   call-and-response column, headline-you-can-type, large-questions FAQ, inverted CTA, wordmark footer.

## House rules that apply to the landing (measured by inspect.mjs)
No eyebrows/pill badges, no monospace outside code, no index numbering, no thin rules, no gradients, no shadows at rest,
no icon-topped card rows, no glass/blur, no emoji, <= 2 typefaces, headlines <= 2 lines at every width,
running text >= 16px, nothing smaller than 13px, >= 4 real pictures (SVG drawings do not count), one moving picture if an honest clip exists.
Real pictures: search the open collections with `assets.mjs` (education/learning/old classroom/blackboard/library engravings),
download with `--get`, credit in the footer (`--credits`). They depict the world, never "our students/team".

## App screens (dashboard, catalog, course, lesson, admin) — ui-ux-pro-max rules
- Contrast >= 4.5:1; visible focus ring (accent) on every interactive element; labels on all inputs; `aria-label` on icon-only buttons.
- Touch targets >= 44px; hover never the only affordance; loading skeletons/spinners; empty and error states for each list.
- SVG icons (lucide-style inline), no emoji icons; semantic HTML (`main`, `nav`, `section`, headings in order).
- Motion: 150–300ms transform/opacity only, `prefers-reduced-motion` respected.
- Responsive at 375 / 768 / 1024 / 1440, no horizontal scroll; `<meta viewport>` default of Next.
- Quiz: progress shown, answered state is not colour-only (icon + text), explanation next to the answer.
- AI tutor panel: clear "ответ сгенерирован ИИ" note, loading indicator, retry on error, keyboard submit (Ctrl+Enter).
- Charts/progress: percent shown as text next to the bar (not colour alone).
