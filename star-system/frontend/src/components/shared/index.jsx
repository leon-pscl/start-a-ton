import { GAP_COLORS } from '../../lib/constants'

export function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</span>
      <span className={`text-3xl font-display font-bold ${accent ?? 'text-slate-800'}`}>
        {value}
      </span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  )
}

export function GapBadge({ level }) {
  const c = GAP_COLORS[level] ?? GAP_COLORS.low
  return (
    <span className={`${c.bg} ${c.text} text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize`}>
      {level}
    </span>
  )
}

export function GapBar({ score }) {
  const pct = Math.round(score * 100)
  const color = score >= 0.7 ? '#dc2626' : score >= 0.4 ? '#d97706' : '#16a34a'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-star-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-display font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}

export function Select({ value, onChange, options, placeholder, className = '' }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`input ${className}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>
          {o.label ?? o}
        </option>
      ))}
    </select>
  )
}

export function CheckboxGroup({ label, options, selected, onChange }) {
  const toggle = (val) => {
    const next = selected.includes(val)
      ? selected.filter(v => v !== val)
      : [...selected, val]
    onChange(next)
  }
  return (
    <div>
      {label && <p className="text-xs font-medium text-slate-600 mb-2">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              selected.includes(o)
                ? 'bg-star-600 text-white border-star-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-star-300'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}