interface ErrorBoxProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorBox({ message, onRetry }: ErrorBoxProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-danger/40 bg-surface p-5 text-[0.9375rem] text-danger sm:flex-row sm:items-center sm:justify-between"
    >
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary self-start !min-h-10 !py-1.5 sm:self-auto">
          Повторить
        </button>
      )}
    </div>
  );
}
