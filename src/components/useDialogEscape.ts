import { useEffect } from "react";

export function useDialogEscape(onCancel: () => void, isEnabled = true) {
  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isEnabled, onCancel]);
}
