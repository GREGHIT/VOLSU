export default function SegmentedToggle({ value, onChange, options = [], className = "" }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
              selected
                ? "border-blue-500 bg-blue-500 text-white"
                : "theme-surface-button border-slate-300 text-slate-700 hover:border-blue-300"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
