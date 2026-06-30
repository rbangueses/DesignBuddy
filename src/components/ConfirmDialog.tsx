import { useId, useState } from "react";

type ConfirmDialogProps = {
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
};

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const errorId = useId();

  async function handleConfirm() {
    setError(null);
    setIsPending(true);

    try {
      await onConfirm();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : String(confirmError));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <p>{body}</p>
        {error ? (
          <p className="form-error" id={errorId}>
            {error}
          </p>
        ) : null}
        <div className="dialog-actions">
          <button type="button" onClick={onCancel} disabled={isPending}>
            Cancel
          </button>
          <button
            type="button"
            className="danger-button"
            onClick={() => {
              void handleConfirm();
            }}
            disabled={isPending}
            aria-describedby={error ? errorId : undefined}
          >
            {isPending ? `${confirmLabel}...` : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
