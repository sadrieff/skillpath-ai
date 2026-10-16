# DIRECTION SHEET — Type and nothing else
seed 5644890 · drawn 2026-10-16 · sector education · tone technical
Brief: SkillPath AI: платформа онлайн-курсов с ИИ-наставником, который объясняет ошибки в тестах; курс, урок, тест, разбор ошибок, прогресс

| | |
| --- | --- |
| Direction | Type and nothing else |
| Hero | Controls on the sentence |
| Type | Red Hat Display / Red Hat Text |
| Colour | Candy chapters |
| Sections | features (Capabilities as a menu) → how-it-works (Call and response column) → showcase (Headline you can type) → faq (Large questions, answers beside) → cta (The idea again, inverted) → footer (Columns above, wordmark below) |
| Motion | Masked headline |
| Photographs | the "People" set, as atmosphere |

This is the direction for this build. Adopt it. Do not blend it with the layout you would have made anyway,
and do not redraw because it is unfamiliar: unfamiliar is the point. Redraw a slot only when it conflicts
with a stated brand constraint or needs an asset that does not exist, and say why in your report.

The parts of this sheet were written separately and will disagree in small ways. Settle every disagreement in this order:
**house rules** (including type no smaller than 13px and body text of 16px or more) → **the direction** (the idea, the composition habits, where the
one accent goes) → **the type system and the palette** (which face does which job, the five size steps, which colour is the ground and where the
accent goes) → **the hero blueprint** → **the section blueprints**. Under each blueprint below, "Adjusted for this page" lists where it disagrees.
In practice: take geometry from blueprints (columns, proportions, what sits where) and take everything else from above them. Map every size a
blueprint names onto one of your five type steps instead of adding a sixth. Use one button shape, one corner radius and one pair of page margins on
the whole page, whatever individual blueprints say. If a blueprint names a kind of typeface (a light serif, a heavy grotesk), use the dealt face.

## 1. The idea
The first screen is made only of words, colour and space, good enough that nobody misses a picture there. Pictures arrive later, large and few, as relief from the type. This is the honest answer when a subject has nothing worth photographing: instead of inventing illustrations, set what you have to say as well as it can be set. The typography carries a point of view through scale (one enormous statement, everything else small), through measure (a narrow, bookish column or a full-width line), and through one committed colour.

Before anything else, write one sentence in your notes: "On this page, <the subject's own material> becomes <the device>."
Fill the first blank from your inventory of what only this client has (its name and what it means, its street, its numbers, its
constraint), then put the nearest competitor in the sentence: if it still works, the idea is the category's, not the client's.
Then name the one live thing the visitor can do on the page (SKILL.md step 4).

## 2. Composition
First screen: the statement, two lines at most, set at 9–14vw and occupying the full width with tight leading, positioned in the upper two-thirds. One supporting sentence at 20–24px sits bottom-left on the same margin and the single action sits bottom-right on the same baseline. No navigation bar; two or three links in a top corner. Sections that follow are typographic set pieces, each different: a list of five to eight capabilities set at 4–6vw one per line; a paragraph at 28–36px in a 28ch column pushed to the right half; a pair of large numerals with a sentence each; a single quotation filling a colour field. Each section uses a different horizontal position (left, right, full) so the page has movement without imagery.

## 3. Type — Red Hat Display / Red Hat Text
A geometric black with round bowls and flat terminals, cleaner and more even than a grotesque at the same weight. Suits fintech, apps and portfolios that want heavy type with a tidy, technical finish.
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@900&family=Red+Hat+Text:wght@400;500&display=swap" rel="stylesheet">
```
- Display: **Red Hat Display** — weight 900 · tracking -0.03em · leading 0.92 · uppercase; centred three-line stacks work well
- Text: **Red Hat Text** — 400 for body, 500 for emphasis · leading 1.5 · tracking 0
```css
:root {
  --step-small: clamp(0.8125rem, 0.79rem + 0.1vw, 0.875rem);
  --step-body: clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem);
  --step-lead: clamp(1.25rem, 1.1rem + 0.7vw, 1.625rem);
  --step-head: clamp(2.5rem, 1.2rem + 5vw, 5.5rem);
}
```
This direction lives or dies on the face and its settings. Display at tight tracking and leading; text sizes few and far apart (for example 15, 22, 34 and the display size). Use real typographic detail: proper quotes, balanced line breaks, hung punctuation where it helps.
The direction decides sizes and how many of them; the type system decides how this face is set. Where the two give different tracking or leading, use the values of the type system: they are tuned to this face.
The display size itself comes from the hero blueprint below.

## 4. Colour — Candy chapters
```css
:root {
  --bg: #ffd249;
  --surface: #f5c63c;
  --ink: #0a0a0a;
  --muted: #5e4a0a;
  --accent: #f53fd6;
  --accent-ink: #0a0a0a;
  --field-1: #ffd249;  --field-1-ink: #0a0a0a;
  --field-2: #ffffff;  --field-2-ink: #0a0a0a;
  --field-3: #ffc4ef;  --field-3-ink: #0a0a0a;
  --field-4: #a4f6f8;  --field-4-ink: #0a0a0a;
  --field-5: #f9a21f;  --field-5-ink: #0a0a0a;
}
```
Each section owns one flat candy colour: yellow first, then white, pink, cyan and orange, with all type in black. Magenta is kept for buttons alone.
Either one saturated ground for the whole page with a single ink, or paper and ink with one section inverted and one in the accent as a full field. Colour does the job images would have done.

## 5. Imagery
**The project has no photographs of its own yet.** First choice: **real pictures of the subject's world from the open collections**: its city and street in old postcards and photographs, an old map of the neighbourhood, its materials up close, its trade in engravings, museum objects of its kind (references/imagery.md §3). Start with `node C:/Users/tenzo/.claude/skills/design-taste-frontend/scripts/assets.mjs "education"`, then queries from your inventory (its street, its materials, its trade's tools and history). Download what you use into the project with `--get` and credit every one on the page (`--credits` prints the footer line). They show the world around the client, never the client's own room, dish, product, person or team. Second, for what no honest picture exists of: draw the subject's own things in code, large, in one flat graphic language and the palette's real colours (its tiles, its windows, its objects; references/imagery.md §8). Third: the dealt photographs, only where an honestly generic picture fits (the sea, the weather, a material), never one a visitor could take for the thing itself and never an unrelated scene. One treatment for all of them. If this direction is built on photographs, plan the set before building (four to six pictures of one family) and reuse them at different crops and scales instead of finding or drawing a new picture for every slot; keep drawings as `<symbol>` + `<use>` or generate them with a small script so the page stays light. List every found picture (with its source and licence), every dealt photograph and every drawing that stands in for photography in your report.

The first screen has no picture. Further down, real pictures of the subject's world (found with scripts/assets.mjs) arrive large and few: a full-bleed photograph between two type sections, a looping clip in one band, an archival image beside a list. Do not add icons, shapes, patterns or abstract graphics to compensate for anything.

**Floor (the inspector checks it):** at least four real pictures on the page, usually six to twelve; SVG drawings do not count. One moving picture where an honest clip exists: `node <skill>/scripts/assets.mjs --video "<query>"`, used as a muted loop with a poster frame. Whatever this direction says about pictures, it is carried out with real ones.

Photographs dealt for this build, from the "People" set (figures, silhouettes and portraits, mostly unposed)
Order of preference for imagery: (1) the project's own photographs and product shots; (2) images you generate, if an image tool is
available; (3) real pictures of the subject's world found in the open collections (assets.mjs, downloaded and credited on the page);
(4) drawings of the subject in code; (5) these. They are real photographs (Unsplash licence, served by picsum.photos) of places, light and
texture. They are atmosphere, never a stand-in for a specific product, dish, person or interface. List the ones you use in your report so
they can be replaced.
- `https://picsum.photos/id/669/1600/1000` — Person in a mustard jacket and grey beanie seen from behind in fog · light tone · mustard, pale grey, white · calm area: left · native landscape · photo: Luke Pamer
- `https://picsum.photos/id/338/1600/1000` — Person in a hooded coat seen from behind facing a misty sea · mid tone · slate blue, grey, charcoal · calm area: left · native landscape · photo: Patryk Sobczak
- `https://picsum.photos/id/685/1600/1000` — Man sitting on a rock looking over a sea of clouds · mid tone · pale gold, grey, dark brown · calm area: right · native landscape · photo: Joshua Earle
- `https://picsum.photos/id/177/1600/1000` — Hiker with a backpack looking over a hazy mountain valley · mid tone · warm tan, hazy gold, olive · calm area: left · native landscape · photo: Danka & Peter
- `https://picsum.photos/id/821/1600/1000` — Woman seen from behind on a platform as a train blurs past · light tone · white, grey, black · black-and-white · calm area: left · native landscape · photo: Eutah Mizushima
- `https://picsum.photos/id/768/1600/1000` — Person sitting alone on a bench facing sandy dunes · light tone · sand beige, pale blue, soft white · calm area: top · native landscape · photo: Mikael Kristenson
- `https://picsum.photos/id/91/1600/1000` — Person in dark jacket holding a vintage twin-lens camera, monochrome · mid tone · grey, black · black-and-white · native landscape · photo: Jennifer Trovato
- `https://picsum.photos/id/665/1600/1000` — Man sitting on a stone wall overlooking a hazy valley · mid tone · pale teal, cream, grey · calm area: top · native landscape · photo: Joshua Earle
The last two path numbers are width and height: request the exact crop you render (`/1200/1500` for a 4:5 portrait, `/2400/1350` for a hero) and
add `?grayscale` to desaturate. Use three to six of them, not all eight. Always set `width`, `height`, `alt` and `loading="lazy"` (not on the hero image).
Other sets that fit this brief: mountain, forest, field-and-farm, sky-and-space — `node draw.mjs --photos <set>` prints one in full; `--photos list` shows all sets. Taking photographs from another set is your call and is not a redraw; keep them to one light and one treatment.

## 6. Hero — Controls on the sentence
A dark flat ground with no logo bar: a 14px wordmark top-left and the single action as an underlined text link top-right, both 28px in. The headline is a two-line sentence, centred, at clamp(96px, 9vw, 150px), line-height 1.0, occupying the middle 64% of the width and sitting slightly above the midline. It is set in a variable font and it is the demonstration. Three small control chips from the product sit on top of the sentence, each about 300 by 80px with the product's true radius, a text label and a numeric readout: one above the first line near its left end, one overlapping the start of the second line, and a two-state switch at the lower right. They are tilted 2 to 4 degrees and filled solid, one step lighter than the ground. Each one works: dragging the first changes the headline's weight through `font-variation-settings`, the second changes its letter-spacing, the third toggles uppercase. Mark each chip's root with data-ui. One supporting sentence at 17px, max 40ch, is centred 72px under the headline. The bottom third of the screen stays empty.

On a phone: The sentence stays on two lines at 13.5vw, centred at 38% of the height. The three chips shrink to 200 by 60px and move off the letters: one above the sentence and two side by side beneath it, untilted and still live. The supporting sentence follows at 16px. The wordmark stays top-left and the action link top-right.
Headline: A two-line sentence of three to five words, up to about 11 characters per line at 9vw, that still reads when its weight and spacing change.

Adjusted for this page:
- It names a kind of typeface: use the dealt faces (display Red Hat Display, text Red Hat Text) and their settings; capitals only where the type system sets them.
- It sets a sentence large over several lines: jurors read that as a long headline. Either cut it to a two-line headline at display size, or keep it a statement at 36px or less on three lines (24px, four lines on a phone).
- Its action is a text link: the primary action on the first screen is a real button (filled or solid-bordered, 44px or taller), placed where the blueprint puts the link. A second action may stay a link.

## 7. Sections, in order
Each is a composition to rebuild with this project's content. Keep the geometry; change the subject. Re-order or drop a
section when the argument of the page needs it (see references/copy.md), never to fall back to a card grid.

### 1. features — Capabilities as a menu (table)
The capabilities are set as a printed menu or price list. One paper-coloured sheet, 520–600px wide and taller than it is wide, sits on a contrasting flat ground, centred or starting at column 2; its top and bottom edges are cut into shallow scallops or a zigzag with clip-path, its sides straight. On it, centred at the top, the heading: two or three words at 44–56px, then 40px of space. Below, items in two or three groups; each group opens with its name at 20px bold. Each item is a row: the name at 19px on the left, a short value on the right (a price, a time, a quantity, 'included'), and between them a leader of round 4px dots (border-bottom: 4px dotted, sitting on the baseline). A description at 15px in the soft ink sits under the name, at most 34ch. 18px between items, 44px between groups.
On a phone: The sheet fills the width minus 12px margins and keeps its cut top and bottom edges. Names stay left and values right on one line with the dot leader between; descriptions wrap beneath at 15px. Group names drop to 18px. Padding inside the sheet is 20px.

Adjusted for this page:
- It draws lines or borders: keep them only inside a table, a form or a `data-ui` fragment; elsewhere separate with space or a change of ground.

### 2. how-it-works — Call and response column (list)
The sequence is shown as what you give and what comes back, in one narrow column 560px wide starting at column 4, or on the page's text axis. Three exchanges, 88px apart. Each opens with a sentence at 20px medium that begins with its order word ('First, install it.' 'Then ask for a chart.'). 16px under it, the call: the literal thing the user enters, in a filled panel one tone off the ground, radius 8px, padding 20px. For a developer tool that is real code in `<pre><code>` at 14px with a working copy button; otherwise it is the product's own input holding real typed text. Under the call, indented 56px, the response: a true-size fragment marked data-ui showing what the product returns. The third response is the finished result and breaks out of the column, 760px wide, running to column 12. The heading, two to four words at 28px, sits 56px above the first sentence.
On a phone: The column fills the width with 20px margins. Calls and responses stack without the indent; a 24px gap and a lighter panel tone set the response apart. Code panels scroll sideways inside themselves. The final result runs edge to edge at true size, cropped on the right if wider.

Adjusted for this page:
- It names its own corners: use the one radius of this page (square unless the direction says otherwise) and one button shape.

### 3. showcase — Headline you can type (statement)
The section's headline is an input. One line at clamp(48px, 8vw, 132px), tight tracking, flush left across columns 1–12, is a real `<input>` (root marked data-ui) with no border and no fill, prefilled with a believable two-to-five-word example of what a user gives the product: a search, a question, a date in words, a colour name. A solid caret block 0.08em wide blinks after the last character. 48px beneath, on the same left edge, the product's answer appears at true interface size, at most 560px wide: three result rows, one parsed value, or a swatch, updating as the visitor types. Bottom-left, three more examples at 17px act as plain text buttons that refill the line. The rest of the 88svh field is empty. If the text outgrows the line it scrolls inside the input; it never wraps.
On a phone: The input is set at 11vw on one line and scrolls sideways inside itself when the text runs long. The answer follows 28px below at full width and true size. The three examples become a wrapping row of filled blocks 44px tall beneath the answer; tapping one refills the line.

### 4. faq — Large questions, answers beside (table)
Every answer is open; nothing collapses. Each question-and-answer pair is a row on the 12-column grid: the question in columns 1–6 at clamp(26px, 2.6vw, 40px), medium weight, leading 1.1, no more than two lines; its answer in columns 8–12 at 17–18px with leading 1.55 and a measure near 40ch, its first baseline level with the question's first baseline. Rows are separated by 72–88px of empty space and nothing else. Five to seven rows. The section heading, two or three words, is set at the same size as the questions but in the softer ink and sits as the first row's left cell with an empty right cell, so it reads as the top of the same table rather than a title above it. Because questions are large and answers small, the left column works as a scannable index.
On a phone: Each pair stacks: question at 24px, answer 12px beneath at 17px, then 56px of space before the next. The heading leads at the same 24px in the softer ink. Answers stay open; there is no accordion on the phone either.

### 5. cta — The idea again, inverted (statement)
The close flips the page's colours: ink becomes the ground and the ground becomes the ink, across a full-bleed field at least 90svh tall. The page's opening idea returns as a headline of three to five words at 9–11vw on two lines, leading 0.9, flush left, positioned in the upper two-thirds; it should echo the hero's wording, not repeat it. Along the bottom, on one shared baseline 40px above the edge: one supporting sentence at 20px in columns 1–5 and one rectangular button in the accent colour, right-aligned in columns 10–12, about 56px tall. Nothing else: no image, no second button, no logo. The field's top edge is a hard horizontal line where it meets the section above. If the footer follows on the same inverted field, leave 160px before it so the close still reads as its own screen.
On a phone: The same inverted field at 80svh. Headline at 15vw on two lines at the top. The sentence sits lower at 17px, and the button spans the full width at the bottom, 56px tall, with 20px margins. Nothing else is added.

### 6. footer — Columns above, wordmark below (stack)
The footer inverts ground and ink and fills a whole viewport (min-height 100svh), arranged as three rows in a grid (auto 1fr auto). Top row, 40px from the edge: four small columns on the 12-column grid (address, navigation, social, hours or contact), each a plain list at 15–16px with its first line in the full ink and the rest in the softer ink. Middle row: empty. Bottom row: the wordmark alone, sized to run from the left margin to the right margin on one line. Set it as inline SVG text with a `viewBox` fitted to the word and `width: 100%`, or tune `font-size` in `vw` to the letter count, so it never wraps; its baseline sits 20px above a single line of legal text at 13px. With `position: sticky; bottom: 0` and a lower `z-index` than the page, the last section slides away to uncover it.
On a phone: Columns become two by two at 15px with 32px between rows, at the top. A gap of about 20svh follows. The wordmark spans the full width at the bottom; a name longer than ten letters stacks on two lines, each fitted to the width. Legal line beneath at 12px.

Adjusted for this page:
- It sets text at 12px: use your small step (13px or more) instead.

## 8. Motion — Masked headline
On load, each line of the headline rises from behind its own baseline, about 900ms with a strong ease-out, the second line 110ms after the first; the supporting sentence and the action then fade up together. Nothing else on the page performs. Because headlines are two lines at most, you author the line breaks and wrap each line yourself. Recipe: 'Masked line reveal' in references/motion.md.
This is the signature move, the one loud moment. Around it the page still needs the rest of the motion layer (SKILL.md step 9): an entrance for the parts of every section, feedback on every control, and one moving picture. The inspector fails a page that barely moves. Recipes: references/motion.md.

## 9. Where the richness comes from
Scale contrast and colour mass. A capability list set at 5vw is an image in its own right.

## 10. How this direction goes wrong
Without pictures, weak copy has nowhere to hide: write real sentences. Vary the set pieces; four sections of big-heading-plus-paragraph is a text document, not a design. Keep all headings within two lines.

## 11. Real references
Studied sites that work this way. Take the principle, never the specifics: no names, copy, images or signature assets of theirs.
- **CoffeeTech®** (Awwwards Site of the Day, studied score 7.1) `aww-coffeetech-r`
  Idea: Present an industrial roaster maker like a design brand: one enormous three-word statement on black, with the machine withheld until the first scroll, where it emerges from the dark.
  Hero: Near-black viewport with nothing but type. A centred three-line headline, one word per line, in Inter Medium at about 15vw with tight tracking; the first line starts a third of the way down and the last runs to within 35px of the bottom edge, its widest word spanning roughly 70% of the width. Cream letters; no subhead, no media, no hero button. Navigation is one quiet row: logo with a terracotta mark at left, four text links centred, then a filled terracotta 'Products' button with a grid icon, an outlined contact button and a language dropdown at right. The top third stays empty.
  Worth taking: Let a three-word headline at about 15vw be the entire first viewport and withhold the product until the first scroll.
- **bleibtgleich’26** (Awwwards Site of the Day, studied score 7.5) `aww-bleibtgleich26`
  Idea: One thin vertical rule runs down the page and a tight bold grotesk sentence wraps around it, words stepping from one side of the line to the other.
  Hero: White page, black type. Content sits in a narrow band between 26% and 68% of the width. A 1px vertical rule drops from the top edge at 37% for two-thirds of the height. Left of it: a black blob avatar at the top, a tiny role caption at its foot. Right of it: a tiny location note at the top, the name in two lines of 90px medium grotesk at the bottom. The tagline continues below at the same size, flush to the band's left edge, running past the fold. The upper half is otherwise blank. The handle is split into two pale-grey words fixed in the bottom corners; a black menu pill sits top-right.
  Worth taking: Draw one 1px vertical rule and typeset a large sentence around it, alternating words to either side so the line becomes the text's spine.
Full notes on any of them: `node draw.mjs --site <id>`.

## Always
Headlines two lines or fewer at every width. No eyebrow labels, no monospace, no 01/02/03, no thin rules, no gradients, no shadows at rest,
no cream-and-terracotta, no violet. `inspect.mjs` measures all of it.

Saved to C:/Users/tenzo/Desktop/projects/skillpath-ai/.taste-skill/direction.json · reprint with `node draw.mjs --show`
