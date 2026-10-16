interface ErrorBoxProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorBox({ message, onRetry }: ErrorBoxProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded border border-danger/40 bg-danger/10 p-4 text-sm text-danger sm:flex-row sm:items-center sm:justify-between"
    >
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary !py-1.5 self-start sm:self-auto">
          Повторить
        </button>
      )}
    </div>
  );
}
