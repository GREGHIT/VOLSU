export default function SectionCard({ title, subtitle, actions = null, className = "", children }) {
  return (
    <section className={`theme-surface-panel rounded-[26px] border border-slate-300/85 bg-white/95 p-5 shadow-[0_16px_45px_-34px_rgba(15,23,42,0.28)] ${className}`}>
      {(title || subtitle || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {subtitle ? <div className="theme-readable-muted text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{subtitle}</div> : null}
            {title ? <div className="theme-readable-strong mt-1 text-2xl font-black tracking-tight text-slate-950">{title}</div> : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
