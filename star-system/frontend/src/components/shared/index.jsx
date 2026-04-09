/**
 * Shared UI Components
 *
 * Reusable components for the STAR system frontend.
 * These components provide consistent styling and behavior across pages.
 */

import { GAP_COLORS } from '../../lib/constants'

// Re-export ChatWidget for easy import
export { default as ChatWidget } from './ChatWidget'

// ---------------------------------------------------------------------------
// StatCard - Dashboard Summary Metric
// ---------------------------------------------------------------------------

/**
 * Displays a single metric with label and optional subtitle.
 * Used in the Dashboard for showing aggregate statistics.
 *
 * @param {object} props
 * @param {string} props.label - Metric label
 * @param {string|number} props.value - Main metric value
 * @param {string} [props.sub] - Optional subtitle
 * @param {string} [props.accent] - Optional text color class for value
 */
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

// ---------------------------------------------------------------------------
// GapBadge - Gap Level Indicator Badge
// ---------------------------------------------------------------------------

/**
 * Displays the gap level as a colored badge.
 * Color coding: green (low), amber (moderate), red (high).
 *
 * @param {object} props
 * @param {string} props.level - Gap level ('low', 'moderate', or 'high')
 */
export function GapBadge({ level }) {
  const c = GAP_COLORS[level] ?? GAP_COLORS.low
  return (
    <span className={`${c.bg} ${c.text} text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize`}>
      {level}
    </span>
  )
}

// ---------------------------------------------------------------------------
// GapBar - Visual Gap Score Progress Bar
// ---------------------------------------------------------------------------

/**
 * Displays a gap score as a horizontal progress bar.
 * Bar color changes based on score threshold:
 * - Green: < 40% (low)
 * - Amber: 40-69% (moderate)
 * - Red: >= 70% (high)
 *
 * @param {object} props
 * @param {number} props.score - Gap score (0-1)
 */
export function GapBar({ score }) {
  const pct = Math.round(score * 100)
  const color = score >= 0.7 ? '#dc2626' : score >= 0.4 ? '#d97706' : '#16a34a'
  return (
    <div className="flex items-center gap-2">
      {/* Progress bar container */}
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      {/* Percentage label */}
      <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Spinner - Loading Indicator
// ---------------------------------------------------------------------------

/**
 * Centered loading spinner.
 * Used while data is being fetched from the API.
 */
export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-star-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// EmptyState - No Data Message
// ---------------------------------------------------------------------------

/**
 * Displays a message when no data is available.
 * Used when filters return no results or data hasn't loaded yet.
 *
 * @param {object} props
 * @param {string} props.message - Message to display
 */
export function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      {/* Inbox icon */}
      <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PageHeader - Consistent Page Title
// ---------------------------------------------------------------------------

/**
 * Standard page header with title, subtitle, and optional action buttons.
 * Responsive: stacks vertically on mobile, horizontally on desktop.
 * Used at the top of most pages for consistent layout.
 *
 * @param {object} props
 * @param {string} props.title - Page title
 * @param {string} [props.subtitle] - Optional subtitle
 * @param {React.ReactNode} [props.actions] - Optional action buttons
 */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <div className="flex-1">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Select - Dropdown Input Component
// ---------------------------------------------------------------------------

/**
 * Styled dropdown select component.
 * Wraps the native <select> with consistent Tailwind styling.
 *
 * @param {object} props
 * @param {string} props.value - Current selected value
 * @param {function} props.onChange - Change handler (receives selected value)
 * @param {Array} props.options - Options as {value, label} or strings
 * @param {string} [props.placeholder] - Placeholder text for empty option
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.disabled] - Disable the select
 */
export function Select({ value, onChange, options, placeholder, className = '', disabled }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={`input ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {/* Placeholder option (empty value) */}
      {placeholder && <option value="">{placeholder}</option>}
      {/* Render options - support both {value, label} and string formats */}
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>
          {o.label ?? o}
        </option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// HoverTags - Tag list with hover tooltip for overflow
// ---------------------------------------------------------------------------

/**
 * Renders a list of tags, showing only the first `max` items inline.
 * On hover, displays a tooltip with the full list.
 *
 * @param {object} props
 * @param {Array<string>} props.items - Full list of items to display
 * @param {string} [props.color] - Tag color variant: 'star' (default), 'slate', 'amber'
 * @param {number} [props.max] - Max items to show inline (default 2)
 * @param {string} [props.label] - Tooltip header label (default 'Full list')
 */
export function HoverTags({ items = [], color = 'star', max = 2, label = 'Full list' }) {
  if (items.length === 0) return <span className="text-slate-300">—</span>

  const visible = items.slice(0, max)
  const extra = items.length - max

  const colorClasses = {
    star: 'bg-star-50 text-star-700',
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-600',
  }[color]

  if (extra <= 0) {
    return (
      <div className="flex flex-wrap gap-1">
        {visible.map(s => (
          <span key={s} className={`text-xs px-2 py-0.5 rounded ${colorClasses}`}>{s}</span>
        ))}
      </div>
    )
  }

  return (
    <div className="relative group inline-block">
      <div className="flex flex-wrap gap-1">
        {visible.map(s => (
          <span key={s} className={`text-xs px-2 py-0.5 rounded ${colorClasses}`}>{s}</span>
        ))}
        <span className="text-xs text-slate-400">+{extra}</span>
      </div>
      {/* Tooltip */}
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50">
        <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap max-w-xs break-words">
          <p className="font-medium mb-1.5 text-slate-300 text-xs uppercase tracking-wide">{label}</p>
          {items.map(s => (
            <p key={s} className="whitespace-nowrap">{s}</p>
          ))}
          {/* Arrow */}
          <div className="absolute top-full left-4 -mt-px">
            <div className="border-4 border-transparent border-t-slate-800" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CheckboxGroup - Multi-Select Button Group
// ---------------------------------------------------------------------------

/**
 * Toggle buttons for multi-select scenarios.
 * Used in registration form for subjects, modules, etc.
 *
 * @param {object} props
 * @param {string} [props.label] - Optional group label
 * @param {Array<string>} props.options - Available options
 * @param {Array<string>} props.selected - Currently selected values
 * @param {function} props.onChange - Change handler (receives new selection array)
 */
export function CheckboxGroup({ label, options, selected, onChange }) {
  /**
   * Toggle a value in the selection.
   * Adds if not present, removes if present.
   */
  const toggle = (val) => {
    const next = selected.includes(val)
      ? selected.filter(v => v !== val)   // Remove if selected
      : [...selected, val]                 // Add if not selected
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
                ? 'bg-star-600 text-white border-star-600'    // Selected state
                : 'bg-white text-slate-600 border-slate-200 hover:border-star-300'  // Unselected
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}