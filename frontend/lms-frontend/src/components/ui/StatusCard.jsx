export default function StatusCard({ title, value, description, tone = "slate", children = null }) {
  const tones = {
    slate: "stat-card-slate border-slate-200 bg-slate-50 text-slate-900",
    blue: "stat-card-blue border-blue-200 bg-blue-50 text-blue-950",
    amber: "stat-card-amber border-amber-200 bg-amber-50 text-amber-950",
    emerald: "stat-card-emerald border-emerald-200 bg-emerald-50 text-emerald-950",
    violet: "stat-card-violet border-violet-200 bg-violet-50 text-violet-950",
  };

  return (
    <div className={`stat-card rounded-[24px] border p-4 ${tones[tone] || tones.slate}`}>
      <div className="stat-card-label theme-readable-soft text-xs font-bold uppercase tracking-[0.16em] opacity-80">{title}</div>
      {value != null ? <div className="stat-card-value theme-readable-strong mt-2 text-3xl font-black">{value}</div> : null}
      {description ? <div className="stat-card-description theme-readable-soft mt-2 text-sm opacity-90">{description}</div> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
