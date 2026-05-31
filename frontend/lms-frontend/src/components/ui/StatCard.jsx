export default function StatCard({ tone = "slate", label, value, description, action = null, children = null }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700 stat-card stat-card-slate",
    blue: "border-blue-200 bg-blue-50 text-blue-700 stat-card stat-card-blue",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 stat-card stat-card-emerald",
    violet: "border-violet-200 bg-violet-50 text-violet-700 stat-card stat-card-violet",
    amber: "border-amber-200 bg-amber-50 text-amber-700 stat-card stat-card-amber",
    rose: "border-rose-200 bg-rose-50 text-rose-700 stat-card stat-card-rose",
  };

  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="stat-card-label text-sm font-semibold uppercase tracking-[0.12em]">{label}</div>
          <div className="stat-card-value mt-3 text-3xl font-black text-slate-950">{value}</div>
          {description ? <div className="stat-card-description mt-2 text-sm leading-6 text-slate-500">{description}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
