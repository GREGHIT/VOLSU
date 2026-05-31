function joinClasses(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function SkeletonBlock({ className = "" }) {
  return <div className={joinClasses("skeleton-block rounded-2xl", className)} aria-hidden="true" />;
}

export function SkeletonLines({ rows = 3, className = "" }) {
  return (
    <div className={joinClasses("grid gap-3", className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonBlock
          key={index}
          className={joinClasses(
            "h-4",
            index === 0 ? "w-full" : "",
            index === rows - 1 ? "w-3/4" : ""
          )}
        />
      ))}
    </div>
  );
}

export function SectionSkeleton({
  title = true,
  stats = 0,
  rows = 3,
  className = "",
  children = null,
}) {
  return (
    <section className={joinClasses("theme-surface-panel rounded-[26px] border border-slate-300/85 bg-white/95 p-5 shadow-sm", className)}>
      {title ? (
        <div className="mb-5 grid gap-3">
          <SkeletonBlock className="h-3 w-36 rounded-full" />
          <SkeletonBlock className="h-9 w-72" />
        </div>
      ) : null}

      {stats > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: stats }, (_, index) => (
            <div key={index} className="theme-surface-inset rounded-[24px] border border-slate-300 p-4">
              <SkeletonBlock className="h-3 w-32 rounded-full" />
              <SkeletonBlock className="mt-4 h-10 w-20" />
              <SkeletonBlock className="mt-4 h-4 w-40" />
            </div>
          ))}
        </div>
      ) : children ? (
        children
      ) : (
        <SkeletonLines rows={rows} />
      )}
    </section>
  );
}

export default function PageSkeleton({ includeStats = true, sections = 2 }) {
  return (
    <div className="mx-auto max-w-[1760px] space-y-6">
      <section className="theme-surface-panel rounded-[28px] border border-slate-300/85 bg-white/92 p-6 shadow-sm">
        <div className="grid gap-3">
          <SkeletonBlock className="h-3 w-36 rounded-full" />
          <SkeletonBlock className="h-12 w-[min(28rem,90%)]" />
          <SkeletonLines rows={3} className="max-w-4xl" />
          <div className="mt-2 flex flex-wrap gap-2">
            <SkeletonBlock className="h-8 w-20 rounded-full" />
            <SkeletonBlock className="h-8 w-24 rounded-full" />
            <SkeletonBlock className="h-8 w-28 rounded-full" />
          </div>
        </div>
      </section>

      {includeStats ? <SectionSkeleton title={false} stats={4} /> : null}

      {Array.from({ length: sections }, (_, index) => (
        <SectionSkeleton key={index} rows={4} />
      ))}
    </div>
  );
}
