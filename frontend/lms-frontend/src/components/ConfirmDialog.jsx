import Modal from "./Modal";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  tone = "danger",
  busy = false,
  onCancel,
  onConfirm,
}) {
  const confirmClass =
    tone === "danger"
      ? "border-red-300 bg-red-600 hover:bg-red-700"
      : "border-blue-400 bg-blue-600 hover:bg-blue-700";

  return (
    <Modal open={open} title={title} onClose={busy ? undefined : onCancel}>
      <div className="space-y-5">
        <div className="theme-surface-note theme-readable-soft rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm leading-6 text-gray-700">
          {message}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="theme-surface-button theme-readable-muted rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 ${confirmClass}`}
          >
            {busy ? "Подождите..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
