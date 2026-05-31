export default function FeedbackMessage({ tone = "error", children, className = "" }) {
  const tones = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-blue-200 bg-blue-50 text-blue-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm ${tones[tone] || tones.error} ${className}`}>
      {children}
    </div>
  );
}
