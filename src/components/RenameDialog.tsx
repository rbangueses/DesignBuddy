import type { FormEvent } from "react";
import { useId, useState } from "react";
import { validateDisplayName } from "../lib/designNames";
import { useDialogEscape } from "./useDialogEscape";

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

  useDialogEscape(onCancel);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <form onSubmit={handleSubmit}>
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
            <button type="submit">{submitLabel}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
