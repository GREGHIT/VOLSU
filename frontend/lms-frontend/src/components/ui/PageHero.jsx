export default function PageHero({
  eyebrow,
  title,
  description,
  actions = null,
  chips = [],
  className = "",
}) {
  return (
    <section className={`theme-surface-panel overflow-hidden rounded-[28px] border border-slate-300/85 bg-white/92 p-6 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.35)] backdrop-blur lg:p-7 ${className}`}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="theme-readable-accent text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">{eyebrow}</div>
          ) : null}
          <h1 className="theme-readable-strong mt-2 text-3xl font-black tracking-tight text-slate-950 lg:text-4xl">{title}</h1>
          {description ? (
            <p className="theme-readable-soft mt-3 max-w-4xl text-sm leading-7 text-slate-600 lg:text-[15px]">{description}</p>
          ) : null}
          {chips?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="theme-glass-chip theme-readable-soft rounded-full border border-slate-300 bg-slate-50/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div> : null}
      </div>
    </section>
  );
}
