export default function Field({ label, error, children, hint }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger-bg">{error}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink';
