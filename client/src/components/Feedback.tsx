import { useEffect, useState } from "react";

type ToastProps = {
  message: string | null;
  tone?: "error" | "info";
  onDismiss: () => void;
};

export function Toast({ message, tone = "info", onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className={`toast toast--${tone}`} role="alert">
      <span>{message}</span>
      <button type="button" aria-label="Cerrar aviso" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}

type ConfirmationProps = {
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationDialog({
  question,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmationProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="dialog__backdrop" role="presentation" onClick={onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={question}
        onClick={(event) => event.stopPropagation()}
      >
        <p>{question}</p>
        <div className="dialog__actions">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Estado local para diálogos de confirmación puntuales. */
export function useConfirmation<T>() {
  const [pending, setPending] = useState<T | null>(null);
  return { pending, ask: setPending, clear: () => setPending(null) };
}
