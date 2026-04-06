import { useEffect, useState } from 'react'
import { getRegions, getRegionDetail, getProvinces, getCities, getSubjectShortage, exportCSV } from '../lib/api'
import { GapBadge, GapBar, Spinner, PageHeader } from '../components/shared'
import PhilippinesMap from '../components/shared/PhilippinesMap'

const STAR_MODULES = [
  'Teaching Mathematics through Problem Solving',
  'Inquiry-based Approach for Teaching Science',
  'Interdisciplinary Contextualization',
  'Language Strategies for Teaching Science and Mathematics',
  'Design Thinking for K-3 Science and Mathematics',
  'Designing Assessment Activities for Blended Learning',
  'Instrumentation and Improvisation',
]

const SHORT_NAMES = {
  'Teaching Mathematics through Problem Solving':        'Math Problem Solving',
  'Inquiry-based Approach for Teaching Science':         'Inquiry-based Science',
  'Interdisciplinary Contextualization':                 'Interdisciplinary',
  'Language Strategies for Teaching Science and Mathematics': 'Language Strategies',
  'Design Thinking for K-3 Science and Mathematics':    'Design Thinking (K-3)',
  'Designing Assessment Activities for Blended Learning': 'Blended Assessment',
  'Instrumentation and Improvisation':                   'Instrumentation',
}

function uptakeLevel(pct) {
  if (pct >= 60) return 'high'
  if (pct >= 30) return 'moderate'
  return 'low'
}

function ModuleHeatmap({ moduleUptake, total }) {
  if (!moduleUptake || total === 0) return null

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Module uptake heatmap
      </p>
      <div className="flex gap-3 text-xs text-slate-400 mb-3">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#86efac' }} />
          Strong (≥60%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#fcd34d' }} />
          Moderate (30–59%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#fca5a5' }} />
          Low (&lt;30%) — priority
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {STAR_MODULES.map(module => {
          const count  = moduleUptake[module] ?? 0
          const pct    = total > 0 ? Math.round((count / total) * 100) : 0
          const level  = uptakeLevel(pct)
          const bgColor = level === 'high'
            ? '#86efac'
            : level === 'moderate'
            ? '#fcd34d'
            : '#fca5a5'
          const textColor = level === 'high'
            ? '#14532d'
            : level === 'moderate'
            ? '#451a03'
            : '#450a0a'

          return (
            <div key={module} className="flex items-center gap-3">
              {/* Module name */}
              <div className="w-44 shrink-0">
                <p className="text-xs text-slate-600 truncate" title={module}>
                  {SHORT_NAMES[module] ?? module}
                </p>
              </div>

              {/* Progress bar */}
              <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden relative">
                <div
                  className="h-full rounded-md transition-all duration-500"
                  style={{ width: `${Math.max(pct, 2)}%`, background: bgColor }}
                />
                <span
                  className="absolute inset-0 flex items-center px-2 text-xs font-medium"
                  style={{ color: pct >= 15 ? textColor : '#64748b' }}
                >
                  {count} teacher{count !== 1 ? 's' : ''} · {pct}%
                </span>
              </div>

              {/* Priority badge */}
              {level === 'low' && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full shrink-0 font-medium">
                  Priority
                </span>
              )}
              {level === 'moderate' && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">
                  Moderate
                </span>
              )}
              {level === 'high' && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">
                  Strong
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary insight */}
      <div className="mt-4 p-3 bg-slate-50 rounded-lg">
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-700">Priority modules for this region: </span>
          {STAR_MODULES
            .filter(m => uptakeLevel(
              total > 0 ? Math.round(((moduleUptake[m] ?? 0) / total) * 100) : 0
            ) === 'low')
            .map(m => SHORT_NAMES[m] ?? m)
            .join(', ') || 'None — all modules have adequate coverage'}
        </p>
      </div>
    </div>
  )
}

function SubjectShortageHeatmap({ regions }) {
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSubjectShortage()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-6"><Spinner /></div>
  if (!data || !data.matrix) return null

  const { matrix, subjects, region_totals } = data
  // Regions as columns, sorted by gap_score descending (use regions from props, same order as table)
  const sorted = [...regions].sort((a, b) => b.gap_score - a.gap_score)

  const cellColor = (count, total) => {
    if (!total || count === 0) return 'bg-slate-50 text-slate-300'
    const pct = (count / total) * 100
    if (pct >= 30) return 'bg-red-100 text-red-700'
    if (pct >= 10) return 'bg-amber-100 text-amber-700'
    return 'bg-green-100 text-green-700'
  }

  // subjects with at least one mismatch across all regions
  const activeSubjects = subjects.filter(s =>
    Object.values(matrix[s] ?? {}).some(v => v > 0)
  )

  return (
    <div className="card mb-6 overflow-x-auto">
      <div className="mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Subject shortage — out-of-specialization teachers per region
        </p>
        <p className="text-xs text-slate-400 mb-2">
          Shows subjects being taught by non-specialists. High counts = acute shortage.
        </p>
        <div className="flex gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-green-100 border border-green-200" />
            Low (&lt;10%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-amber-100 border border-amber-200" />
            Moderate (10–29%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-red-100 border border-red-200" />
            High (≥30%)
          </span>
        </div>
      </div>

      {activeSubjects.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">
          No out-of-specialization teaching detected.
        </p>
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left text-slate-500 font-semibold px-2 py-2 sticky left-0 bg-white z-10 min-w-40">
                Subject
              </th>
              {sorted.map(r => (
                <th key={r.region} className="text-center px-1 py-2 font-semibold text-slate-500 min-w-16"
                  title={`${region_totals[r.region] ?? r.total_teachers} teachers`}>
                  <div className="text-xs">{r.region}</div>
                  <div className="text-slate-400 font-normal">{r.total_teachers}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeSubjects.map(subj => (
              <tr key={subj} className="border-t border-slate-100">
                <td className="px-2 py-1.5 text-slate-600 sticky left-0 bg-white z-10 font-medium">
                  {subj}
                </td>
                {sorted.map(r => {
                  const count = matrix[subj]?.[r.region] ?? 0
                  const total = region_totals[r.region] ?? r.total_teachers ?? 0
                  return (
                    <td
                      key={r.region}
                      className={`text-center px-1 py-1.5 font-medium ${cellColor(count, total)}`}
                      title={`${subj} · ${r.region}: ${count} out-of-specialist`}
                    >
                      {count > 0 ? count : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Summary row */}
      {activeSubjects.length > 0 && (
        <div className="mt-3 p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">Most shortage by subject: </span>
            {[...activeSubjects]
              .sort((a, b) => {
                const sumA = Object.values(matrix[a] ?? {}).reduce((s, v) => s + v, 0)
                const sumB = Object.values(matrix[b] ?? {}).reduce((s, v) => s + v, 0)
                return sumB - sumA
              })
              .slice(0, 5)
              .join(', ')}
          </p>
        </div>
      )}
    </div>
  )
}

export default function RegionsPage() {
  const [regions, setRegions]             = useState([])
  const [provinces, setProvinces]         = useState([])
  const [cities, setCities]               = useState([])
  const [selected, setSelected]           = useState(null)
  const [detail, setDetail]               = useState(null)
  const [loading, setLoading]             = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sortBy, setSortBy]               = useState('gap_score')

  useEffect(() => {
    Promise.all([getRegions(), getProvinces(), getCities()])
      .then(([r, p, c]) => {
        setRegions(r)
        setProvinces(p)
        setCities(c)
      })
      .finally(() => setLoading(false))
  }, [])

  const selectRegion = (region) => {
    if (!region) return
    setSelected(region)
    setLoadingDetail(true)
    getRegionDetail(region)
      .then(setDetail)
      .finally(() => setLoadingDetail(false))
    setTimeout(() => {
      document.getElementById('region-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const sorted = [...regions].sort((a, b) => {
    if (sortBy === 'gap_score') return b.gap_score - a.gap_score
    if (sortBy === 'total')     return b.total_teachers - a.total_teachers
    if (sortBy === 'name')      return a.region.localeCompare(b.region)
    return 0
  })

  if (loading) return <Spinner />

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Regional gap analysis"
        subtitle="Zoom in to explore regions, provinces, and cities. Click a region to inspect."
        actions={
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="input text-xs w-36"
            >
              <option value="gap_score">Sort: gap score</option>
              <option value="total">Sort: teacher count</option>
              <option value="name">Sort: name</option>
            </select>
            <button onClick={() => exportCSV()} className="btn-secondary text-xs">
              Export CSV
            </button>
          </div>
        }
      />

      {/* Full-width map */}
      <div className="card mb-6 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">Philippines — administrative map</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Scroll to zoom &middot; Drag to pan &middot; Click a region to inspect
            </p>
          </div>
          <div className="flex gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block border border-slate-200"
                style={{ background: '#fca5a5' }} />
              High gap
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block border border-slate-200"
                style={{ background: '#fcd34d' }} />
              Moderate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block border border-slate-200"
                style={{ background: '#86efac' }} />
              Low
            </span>
          </div>
        </div>
        <PhilippinesMap
          regions={regions}
          provinces={provinces}
          cities={cities}
          selected={selected}
          onSelect={selectRegion}
          compact={false}
        />
      </div>

      {/* Subject shortage heatmap */}
      <SubjectShortageHeatmap regions={regions} />

      {/* Detail panel */}
      <div id="region-detail">
        {selected && (
          <div className="card mb-6">
            {loadingDetail ? (
              <Spinner />
            ) : detail ? (
              <div>
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="font-display font-bold text-slate-800 text-lg">{detail.region}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{detail.total_teachers} teachers registered</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <GapBadge level={detail.gap_level} />
                    <button
                      onClick={() => { setSelected(null); setDetail(null) }}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>

                {/* Gap score components */}
                <div className="mb-6">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Gap score components
                  </p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Training coverage',   key: 'coverage_score', desc: 'Untrained teachers' },
                      { label: 'Competency mismatch', key: 'mismatch_score', desc: 'Out of specialization' },
                      { label: 'Training recency',    key: 'recency_score',  desc: 'No training in 3 yrs' },
                      { label: 'Distance / access',   key: 'distance_score', desc: '3hrs+ from center' },
                    ].map(({ label, key, desc }) => (
                      <div key={key} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex justify-between text-xs mb-2">
                          <span className="font-medium text-slate-700">{label}</span>
                        </div>
                        <GapBar score={detail.components?.[key] ?? 0} />
                        <p className="text-xs text-slate-400 mt-1">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Module uptake heatmap */}
                <div className="mb-6">
                  <ModuleHeatmap
                    moduleUptake={detail.module_uptake}
                    total={detail.total_teachers}
                  />
                </div>

                {/* Subject coverage */}
                {Object.keys(detail.subject_breakdown ?? {}).length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Subject coverage
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(detail.subject_breakdown).map(([subj, count]) => (
                        <span key={subj}
                          className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                          {subj} <span className="text-slate-400">· {count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => exportCSV(detail.region)}
                  className="btn-secondary text-xs"
                >
                  Export region CSV
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Region table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Region</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Teachers</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Trained</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-40">Gap score</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Level</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => (
              <tr
                key={r.region}
                onClick={() => selectRegion(r.region)}
                className={`border-b border-slate-50 cursor-pointer transition-colors
                  ${selected === r.region ? 'bg-star-50' : 'hover:bg-slate-50'}`}
              >
                <td className="px-4 py-3 font-medium text-slate-700">{r.region}</td>
                <td className="px-4 py-3 text-right text-slate-500">{r.total_teachers}</td>
                <td className="px-4 py-3 text-right text-slate-500">
                  {r.trained_count}
                  <span className="text-slate-300 ml-1">
                    ({r.total_teachers > 0
                      ? Math.round(r.trained_count / r.total_teachers * 100)
                      : 0}%)
                  </span>
                </td>
                <td className="px-4 py-3 w-40"><GapBar score={r.gap_score} /></td>
                <td className="px-4 py-3 text-center"><GapBadge level={r.gap_level} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
