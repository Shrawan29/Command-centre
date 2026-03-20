export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  className = '',
  disabled,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const styles =
    variant === 'primary'
      ? 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900'
      : variant === 'danger'
        ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600'
        : 'bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 focus:ring-slate-300';

  return (
    <button
      type={type}
      className={`${base} ${styles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
