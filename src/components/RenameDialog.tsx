import { useId, useState } from "react";
import { validateDisplayName } from "../lib/designNames";

type RenameDialogProps = {
  title: string;
  inputLabel: string;
  initialName?: string;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (name: string) => Promise<void> | void;
};

export function RenameDialog({
  title,
  inputLabel,
  initialName = "",
  submitLabel,
  onCancel,
  onSubmit,
}: RenameDialogProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = `${inputId}-error`;

  async function submit() {
    const validation = validateDisplayName(name);

    if (validation) {
      setError(validation);
      return;
    }

    setError(null);

    try {
      await onSubmit(name.trim());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <label htmlFor={inputId}>{inputLabel}</label>
        <input
          id={inputId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-describedby={error ? errorId : undefined}
          autoFocus
        />
        {error ? (
          <p className="form-error" id={errorId}>
            {error}
          </p>
        ) : null}
        <div className="dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={submit}>
            {submitLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
