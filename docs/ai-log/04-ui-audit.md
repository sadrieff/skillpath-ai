# 04. UI audit (web-interface-guidelines + ui-ux-pro-max)

Scope: `frontend/app/(app)/**`, `frontend/components/**` (landing excluded), `frontend/app/*.tsx`.
Rules: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md (fetched for this run).
Line numbers are from the state after the changes.

## Fixed

- `app/globals.css` (`:focus-visible`): visible focus ring on every interactive element; no `outline: none`.
- `app/globals.css` (`.btn-primary`, `.btn-secondary`, `.input`): `min-h-11` (44px) touch targets.
- `app/globals.css` (`@media prefers-reduced-motion`, line 132): transitions and one-shot animations cut to 0.01ms; spinner still turns.
- `app/globals.css` (`h1-h3`): `text-wrap: balance`.
- `app/globals.css` (`body`): `overflow-wrap: break-word` for long titles.
- `app/globals.css` (`a, button, input, ...`): `touch-action: manipulation`, tap highlight set on purpose.
- `components/ProgressBar.tsx:23`: `transition-all duration-500` with width and a gradient replaced by a `scaleX` transform (transform-only animation, no gradient).
- `components/ProgressBar.tsx:12`: percent uses `tabular-nums`.
- `components/StatCard.tsx`: decorative blurred glow removed (`blur-2xl`); values use `tabular-nums`.
- `components/Navbar.tsx`: `backdrop-blur` removed; mobile toggle is 44px and has `aria-controls`; active links get `aria-current="page"`; auth slot has a fixed min width, so the bar does not jump when the user loads.
- `app/(app)/layout.tsx:9-14`: skip link to `#main`, `main` landmark with `id="main"`.
- `app/(app)/admin/page.tsx:48-62`, `:82-86`: tabs get arrow, Home and End keys (roving tabindex); one shared `tabpanel` (`id="admin-panel"`) with `aria-labelledby` of the selected tab.
- `components/Quiz.tsx:196`: right/wrong answers carry an icon and text, not colour alone; not-passed result box uses the danger token.
- `app/(app)/dashboard/page.tsx:150-160`: pass/fail label ("Зачтено" / "Не зачтено") next to the percent badge, so the colour is not the only signal.
- `app/(app)/dashboard/page.tsx:62-73`, `app/(app)/courses/page.tsx:200-210`: spinner replaced by skeleton blocks with the same height as the content (no layout jump); `aria-busy` and a visually hidden status text.
- `app/(app)/courses/page.tsx:223`: result count is `aria-live="polite"`.
- `app/(app)/courses/page.tsx:158-160`: search has `name="q"` and `autoComplete="off"`.
- `components/admin/*Form.tsx` and `components/AiTutor.tsx`: `autoComplete="off"` on every non-auth input, select and textarea (CourseForm 88-151, LessonForm 176-257, QuizForm 180-283, AdminStructure 111/338/351, AdminQuizzes 139/158, AiTutor).
- `components/admin/LessonForm.tsx:225`, `:262`: `spellCheck={false}` on the video and material URL fields.
- `components/admin/{CourseForm,LessonForm,QuizForm}.tsx`, `AdminStructure.tsx` (ModuleForm): after a failed submit focus moves to the first `aria-invalid` field (`focusFirstInvalid` in `components/admin/ui.tsx`).
- Placeholders end with an ellipsis and show a pattern: `courses/page.tsx:158`, `CourseForm.tsx:107`, `LessonForm.tsx:228`, `:261`, `AiTutor.tsx:236`.
- Typography: three-dot ellipses replaced with `…` in all UI strings (32 places, components and pages). Example: `components/admin/AdminCourses.tsx:113`.
- Copy: "Добро пожаловать" removed from dashboard; "По вашему запросу курсы не найдены. Попробуйте изменить фильтры." changed to "Курсов не найдено. Измените запрос или фильтры." (`courses/page.tsx:209`); "..." on busy buttons changed to "Отписываем..." / "Сохраняем..." (`courses/page.tsx`, `courses/[id]/page.tsx:145`); eyebrow labels in caps removed; "Спросите о теме урока" changed to "Вопрос по теме урока" (`AiTutor.tsx:165`).
- Radius: one radius (6px) for the app through the Tailwind theme (`tailwind.config.js`); leftover `rounded-br-sm` / `rounded-bl-sm` removed from chat bubbles (`AiTutor.tsx:205-208`).
- Dark mode: `color-scheme: dark` on the root (`globals.css`); native selects use `.input` with explicit background and text colour.
- Landmarks: one `h1` per page on every app page; `nav` labelled in the navbar, the lesson breadcrumb and the pagination.
- `app/not-found.tsx` (new): custom 404 in Russian with a `main` landmark.
- `app/error.tsx` (new): error boundary in Russian with a retry button.

## Checked, not changed

- `components/Quiz.tsx` option labels wrap the radio input (single hit target).
- `components/Spinner.tsx`: `role="status"` with a text label.
- Lesson page previous/next: disabled neighbours are `<span aria-disabled="true">`, not links (no target to navigate to).
- No `<img>` in the app (landing images are out of scope here).
- No `transition: all` left in app code (grep).
- No emoji or exclamation marks in UI text (grep).

## Not fixed (open)

- `components/admin/CourseForm.tsx`, `LessonForm.tsx`, `QuizForm.tsx`: no `beforeunload` / router guard for unsaved changes. Needs dirty-state tracking in each form.
- Admin form controls (not search) have no `name` attribute. Forms are not submitted natively; names are only needed for autofill, which is off on purpose.
- Required fields are marked with a visual `*` only, not `required` / `aria-required`. The forms use `noValidate` and validate in code.
- Landing (`components/landing/*`, `app/landing.css`) is not audited; it is reviewed and out of scope.
