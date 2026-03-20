export default function Field({
  label,
  children,
  hint,
  className = '',
}) {
  return (
    <label className={`block ${className}`}>
      {label ? <div className="mb-1 text-sm font-medium text-slate-700">{label}</div> : null}
      {children}
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </label>
  );
}
