import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

let toastId = 0;

function ToastItem({ toast, onDismiss }) {
  return (
    <div
      className={`toast toast-${toast.type} ${toast.exiting ? "toast-exit" : "toast-enter"}`}
      role="status"
      onClick={() => onDismiss(toast.id)}
    >
      <span className="toast-icon" aria-hidden="true">
        {toast.type === "success" && "✓"}
        {toast.type === "error" && "!"}
        {toast.type === "warning" && "⚠"}
        {toast.type === "info" && "i"}
      </span>
      <p className="toast-message">{toast.message}</p>
      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss notification"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
      >
        ×
      </button>
    </div>
  );
}

function ConfirmDialog({ confirmState, onCancel, onConfirm }) {
  if (!confirmState) return null;

  return (
    <div className="confirm-overlay confirm-enter" onClick={onCancel}>
      <div
        className="confirm-dialog confirm-dialog-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title" className="confirm-title">
          {confirmState.title}
        </h3>
        <p className="confirm-message">{confirmState.message}</p>
        <div className="confirm-actions">
          <button type="button" className="btn btn-confirm-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-confirm-danger" onClick={onConfirm}>
            {confirmState.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const dismissToast = useCallback((id) => {
    setToasts((prev) =>
      prev.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 280);
  }, []);

  const showToast = useCallback(
    (message, type = "info", duration = 4500) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type, exiting: false }]);
      setTimeout(() => dismissToast(id), duration);
    },
    [dismissToast]
  );

  const confirm = useCallback(
    ({
      title = "Are you sure?",
      message = "This action cannot be undone.",
      confirmLabel = "Confirm",
    } = {}) =>
      new Promise((resolve) => {
        setConfirmState({ title, message, confirmLabel, resolve });
      }),
    []
  );

  const closeConfirm = useCallback((result) => {
    setConfirmState((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, confirm }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
      <ConfirmDialog
        confirmState={confirmState}
        onCancel={() => closeConfirm(false)}
        onConfirm={() => closeConfirm(true)}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
