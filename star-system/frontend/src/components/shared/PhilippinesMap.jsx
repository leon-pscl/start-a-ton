/**
 * PhilippinesMap.jsx
 * SVG-based choropleth map of the Philippines.
 * Each region is a simplified path colored by gap score level.
 *
 * Props:
 *   regions   — array from GET /analytics/regions
 *   onSelect  — callback(regionName) when a region is clicked
 *   selected  — currently selected region name (optional)
 *   compact   — boolean, renders smaller version for Dashboard
 */

const GAP_FILLS = {
  high:     { default: '#fca5a5', hover: '#f87171', selected: '#dc2626' },
  moderate: { default: '#fcd34d', hover: '#fbbf24', selected: '#d97706' },
  low:      { default: '#86efac', hover: '#4ade80', selected: '#16a34a' },
  none:     { default: '#e2e8f0', hover: '#cbd5e1', selected: '#94a3b8' },
}

// Simplified SVG paths for all 17 Philippine regions
// ViewBox: 0 0 400 800 — Luzon top, Visayas middle, Mindanao bottom
const REGION_PATHS = {
  'CAR': {
    path: 'M148 68 L162 62 L175 70 L178 88 L168 98 L155 95 L144 84 Z',
    labelX: 161, labelY: 82,
  },
  'Region I': {
    path: 'M118 72 L136 65 L144 84 L138 105 L122 110 L108 98 L110 82 Z',
    labelX: 124, labelY: 90,
  },
  'Region II': {
    path: 'M175 58 L196 52 L210 65 L208 88 L192 96 L178 88 L175 70 Z',
    labelX: 192, labelY: 76,
  },
  'NCR': {
    path: 'M130 118 L148 112 L155 122 L148 134 L132 132 Z',
    labelX: 142, labelY: 124,
  },
  'Region III': {
    path: 'M122 110 L138 105 L155 95 L168 98 L172 115 L165 130 L148 134 L132 132 L118 124 Z',
    labelX: 145, labelY: 115,
  },
  'Region IV-A': {
    path: 'M128 136 L148 134 L165 130 L172 148 L160 165 L140 168 L122 158 L118 144 Z',
    labelX: 145, labelY: 152,
  },
  'Region IV-B': {
    path: 'M155 168 L175 162 L192 170 L196 188 L180 198 L160 194 L150 180 Z',
    labelX: 173, labelY: 182,
  },
  'Region V': {
    path: 'M172 148 L192 140 L212 148 L218 168 L205 182 L188 178 L175 162 Z',
    labelX: 195, labelY: 162,
  },
  'Region VI': {
    path: 'M118 208 L138 200 L155 210 L158 230 L142 242 L122 238 L112 224 Z',
    labelX: 135, labelY: 222,
  },
  'Region VII': {
    path: 'M165 218 L182 212 L196 222 L198 242 L182 250 L166 244 L158 230 Z',
    labelX: 178, labelY: 232,
  },
  'Region VIII': {
    path: 'M205 205 L222 198 L238 208 L240 230 L224 240 L208 234 L200 218 Z',
    labelX: 220, labelY: 220,
  },
  'Region IX': {
    path: 'M115 295 L132 288 L148 298 L150 318 L134 328 L116 322 L108 308 Z',
    labelX: 129, labelY: 308,
  },
  'Region X': {
    path: 'M158 285 L178 278 L195 288 L198 310 L180 320 L162 315 L152 300 Z',
    labelX: 175, labelY: 300,
  },
  'Region XI': {
    path: 'M195 318 L215 310 L232 320 L235 342 L218 352 L198 346 L188 332 Z',
    labelX: 212, labelY: 332,
  },
  'Region XII': {
    path: 'M148 325 L168 318 L185 328 L185 350 L168 360 L148 355 L138 340 Z',
    labelX: 162, labelY: 340,
  },
  'Region XIII': {
    path: 'M225 278 L245 270 L260 282 L258 305 L240 312 L222 305 L218 290 Z',
    labelX: 240, labelY: 292,
  },
  'BARMM': {
    path: 'M108 335 L128 328 L142 338 L140 360 L122 368 L105 360 L100 346 Z',
    labelX: 121, labelY: 350,
  },
}

export default function PhilippinesMap({ regions = [], onSelect, selected, compact = false }) {
  const gapByRegion = {}
  regions.forEach(r => {
    gapByRegion[r.region] = { level: r.gap_level, score: r.gap_score, total: r.total_teachers }
  })

  const w = compact ? 220 : 380
  const h = compact ? 440 : 760
  const scale = compact ? 0.55 : 0.95

  return (
    <div className="relative">
      <svg
        width="100%"
        viewBox="0 0 400 800"
        style={{ maxHeight: compact ? 380 : 680 }}
      >
        <g transform={`scale(${scale}) translate(${compact ? 30 : 10}, ${compact ? 10 : 5})`}>
          {Object.entries(REGION_PATHS).map(([regionName, { path, labelX, labelY }]) => {
            const data   = gapByRegion[regionName]
            const level  = data?.level ?? 'none'
            const fills  = GAP_FILLS[level]
            const isSelected = selected === regionName
            const fill   = isSelected ? fills.selected : fills.default

            return (
              <g
                key={regionName}
                onClick={() => onSelect?.(regionName)}
                style={{ cursor: onSelect ? 'pointer' : 'default' }}
                className="region-group"
              >
                <path
                  d={path}
                  fill={fill}
                  stroke="white"
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  strokeLinejoin="round"
                  style={{ transition: 'fill 0.15s' }}
                  onMouseEnter={e => {
                    if (!isSelected) e.target.setAttribute('fill', fills.hover)
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.target.setAttribute('fill', fill)
                  }}
                />
                {!compact && (
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={regionName.length > 10 ? 7 : 8}
                    fontWeight={isSelected ? '700' : '500'}
                    fill={isSelected || level === 'high' ? 'white' : '#1e293b'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {regionName === 'Region IV-A' ? 'IV-A' :
                     regionName === 'Region IV-B' ? 'IV-B' :
                     regionName.replace('Region ', 'R')}
                  </text>
                )}
              </g>
            )
          })}
        </g>

        {/* Legend */}
        {!compact && (
          <g transform="translate(270, 620)">
            <rect x="0" y="0" width="115" height="88" rx="6"
              fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <text x="10" y="18" fontSize="9" fontWeight="600" fill="#475569">Gap level</text>
            {[
              { level: 'high',     label: 'High (≥70%)',     fill: '#fca5a5' },
              { level: 'moderate', label: 'Moderate (40–69%)', fill: '#fcd34d' },
              { level: 'low',      label: 'Low (<40%)',       fill: '#86efac' },
              { level: 'none',     label: 'No data',          fill: '#e2e8f0' },
            ].map(({ label, fill }, i) => (
              <g key={label} transform={`translate(10, ${30 + i * 16})`}>
                <rect width="10" height="10" rx="2" fill={fill} stroke="#cbd5e1" strokeWidth="0.5" />
                <text x="16" y="9" fontSize="8" fill="#475569">{label}</text>
              </g>
            ))}
          </g>
        )}
      </svg>

      {/* Compact legend */}
      {compact && (
        <div className="flex gap-3 justify-center mt-2 flex-wrap">
          {[
            { label: 'High',     color: '#fca5a5' },
            { label: 'Moderate', color: '#fcd34d' },
            { label: 'Low',      color: '#86efac' },
          ].map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-sm inline-block border border-slate-200"
                style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
