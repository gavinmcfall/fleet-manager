export default function FilterSelect({ value, onChange, options, allLabel, className = '' }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`bg-sc-panel border border-sc-border rounded px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-sc-accent/50 ${className}`}
    >
      {options.map((opt) => {
        if (typeof opt === 'object') {
          return <option key={opt.value} value={opt.value}>{opt.label}</option>
        }
        return (
          <option key={opt} value={opt}>
            {opt === 'all' && allLabel ? allLabel : opt}
          </option>
        )
      })}
    </select>
  )
}
