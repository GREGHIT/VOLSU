export default function FilterSelect({ value, onChange, options = [], className = "", ...props }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 theme-surface-button theme-readable-strong ${className}`.trim()}
      {...props}
    >
      {options.map((option) => (
        <option key={String(option.value)} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
