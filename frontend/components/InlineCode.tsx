/** Текст с кодом в обратных кавычках: `type(42)` показывается как код, а не с кавычками. */
export default function InlineCode({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.9em]">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}
