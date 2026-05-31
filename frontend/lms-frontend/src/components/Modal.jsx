import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import AppIcon from "./ui/AppIcon";

export default function Modal({ open, title, children, onClose }) {
  const { t } = useTranslation();

  if (!open) return null;

  return createPortal(
    <div className="app-modal-backdrop fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mt-6 w-[min(920px,92vw)] overflow-hidden rounded-[24px] border border-slate-300 bg-white shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] theme-surface-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 theme-surface-divider">
          <h3 className="text-xl font-black tracking-tight text-slate-950 theme-readable-strong">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 theme-surface-button theme-readable-muted"
          >
            <AppIcon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="theme-scrollbar max-h-[80vh] overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
