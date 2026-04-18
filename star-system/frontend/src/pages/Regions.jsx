import { useEffect, useState } from 'react'
import { getRegions, getRegionDetail, getProvinces, getCities, getSubjectShortage, exportCSV, updateRegionStatus } from '../lib/api'
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
  'Teaching Mathematics through Problem Solving': 'Math Problem Solving',
  'Inquiry-based Approach for Teaching Science': 'Inquiry-based Science',
  'Interdisciplinary Contextualization': 'Interdisciplinary',
  'Language Strategies for Teaching Science and Mathematics': 'Language Strategies',
  'Design Thinking for K-3 Science and Mathematics': 'Design Thinking (K-3)',
  'Designing Assessment Activities for Blended Learning': 'Blended Assessment',
  'Instrumentation and Improvisation': 'Instrumentation',
}

// WPI Component descriptions for tooltips
const WPI_COMPONENTS_INFO = {
  coverage_score: {
    title: 'Training Coverage',
    weight: '30%',
    description: 'Measures the percentage of teachers who have not received STAR training. Regions with more untrained teachers receive higher scores (higher priority).',
    rationale: 'Training coverage is weighted highest because it represents the most direct intervention opportunity - untrained teachers can attend STAR modules.',
  },
  mismatch_score: {
    title: 'Competency Mismatch',
    weight: '25%',
    description: 'Measures out-of-field teaching rates. Higher scores indicate more teachers teaching subjects outside their specialization.',
    rationale: 'Out-of-field teaching impacts student learning outcomes. This component helps identify regions needing teacher reassignment or upskilling.',
  },
  workload_score: {
    title: 'Instructional Workload',
    weight: '20%',
    description: 'Based on student-teacher ratio. Higher ratios indicate heavier workloads and fewer teachers per student.',
    rationale: 'High student-teacher ratios reduce individual attention and increase teacher burnout risk.',
  },
  distance_score: {
    title: 'Distance / Access',
    weight: '15%',
    description: 'Measures geographic and connectivity barriers. Remote areas with difficult access to training centers score higher.',
    rationale: 'Travel distance is a major barrier to training participation. Remote regions need targeted support like mobile training or blended learning.',
  },
  recency_score: {
    title: 'Training Recency',
    weight: '10%',
    description: 'Measures how recently teachers received training. Older training dates result in higher scores.',
    rationale: 'Skills degrade over time. Teachers trained 3+ years ago may need refresher courses to maintain competency.',
  },
  reward: {
    title: 'Participation Reward',
    weight: 'Bonus',
    description: 'Reduces the WPI score for regions with strong historical engagement in STAR programs. Acts as a "good behavior" bonus.',
    rationale: 'Regions that consistently participate in training should be rewarded with lower priority scores, allowing other regions to receive attention first.',
  },
}

function InfoTooltip({ componentKey }) {
  const [show, setShow] = useState(false)
  const info = WPI_COMPONENTS_INFO[componentKey]

  if (!info) return null

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-700 flex items-center justify-center text-[10px] font-bold transition-colors"
        type="button"
      >
        i
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white text-xs rounded-lg shadow-xl p-3">
          <p className="font-bold text-slate-100 mb-1">{info.title}</p>
          <p className="text-slate-300 mb-2">{info.description}</p>
          <div className="border-t border-slate-600 pt-2">
            <p className="text-slate-400"><span className="font-semibold text-slate-200">Weight:</span> {info.weight}</p>
            <p className="text-slate-400 mt-1"><span className="font-semibold text-slate-200">Why it matters:</span> {info.rationale}</p>
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-800" />
        </div>
      )}
    </div>
  )
}

function CalamityInfoTooltip() {
  const [show, setShow] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-700 flex items-center justify-center text-[10px] font-bold transition-colors"
        type="button"
      >
        ?
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-slate-800 text-white text-xs rounded-lg shadow-xl p-3">
          <p className="font-bold text-slate-100 mb-2">Calamity Status</p>
          <p className="text-slate-300 mb-2">
            Flag regions affected by natural calamities, conflicts, or emergencies that impact teacher capacity and training access.
          </p>
          <div className="border-t border-slate-600 pt-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm border border-amber-600" style={{ background: '#fcd34d', borderStyle: 'dashed' }} />
              <span className="text-slate-300"><strong className="text-amber-400">Calamity:</strong> Region affected by disaster (typhoon, earthquake, etc.)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm border border-red-600" style={{ background: '#fca5a5', borderStyle: 'dashed' }} />
              <span className="text-slate-300"><strong className="text-red-400">Emergency:</strong> Severe crisis requiring immediate response</span>
            </div>
          </div>
          <p className="text-slate-400 mt-2 text-[10px]">
            Affected regions are highlighted on the map and prioritized in the list.
          </p>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-800" />
        </div>
      )}
    </div>
  )
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
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Module uptake heatmap</p>
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
          const count = moduleUptake[module] ?? 0
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const level = uptakeLevel(pct)
          const bgColor = level === 'high' ? '#86efac' : level === 'moderate' ? '#fcd34d' : '#fca5a5'
          const textColor = level === 'high' ? '#14532d' : level === 'moderate' ? '#451a03' : '#450a0a'

          return (
            <div key={module} className="flex items-center gap-3">
              <div className="w-44 shrink-0">
                <p className="text-xs text-slate-600 truncate" title={module}>
                  {SHORT_NAMES[module] ?? module}
                </p>
              </div>

              <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden relative">
                <div className="h-full rounded-md transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%`, background: bgColor }} />
                <span className="absolute inset-0 flex items-center px-2 text-xs font-medium" style={{ color: pct >= 15 ? textColor : '#64748b' }}>
                  {count} teacher{count !== 1 ? 's' : ''} · {pct}%
                </span>
              </div>

              {level === 'low' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full shrink-0 font-medium">Priority</span>}
              {level === 'moderate' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">Moderate</span>}
              {level === 'high' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">Strong</span>}
            </div>
          )
        })}
      </div>

      <div className="mt-4 p-3 bg-slate-50 rounded-lg">
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-700">Priority modules for this region: </span>
          {STAR_MODULES
            .filter(m => uptakeLevel(total > 0 ? Math.round(((moduleUptake[m] ?? 0) / total) * 100) : 0) === 'low')
            .map(m => SHORT_NAMES[m] ?? m)
            .join(', ') || 'None — all modules have adequate coverage'}
        </p>
      </div>
    </div>
  )
}

function SubjectShortageHeatmap({ regions }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSubjectShortage().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-6"><Spinner /></div>
  if (!data || !data.matrix) return null

  const { matrix, subjects, region_totals } = data
  const sorted = [...regions].sort((a, b) => b.gap_score - a.gap_score)

  const cellColor = (count, total) => {
    if (!total || count === 0) return 'bg-slate-50 text-slate-300'
    const pct = (count / total) * 100
    if (pct >= 30) return 'bg-red-100 text-red-700'
    if (pct >= 10) return 'bg-amber-100 text-amber-700'
    return 'bg-green-100 text-green-700'
  }

  const activeSubjects = subjects.filter(s => Object.values(matrix[s] ?? {}).some(v => v > 0))

  return (
    <div className="card mb-6 overflow-x-auto">
      <div className="mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Subject shortage — out-of-specialization teachers per region</p>
        <p className="text-xs text-slate-400 mb-2">Shows subjects being taught by non-specialists. High counts = acute shortage.</p>
        <div className="flex gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-green-100 border border-green-200" />Low (&lt;10%)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-amber-100 border border-amber-200" />Moderate (10–29%)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-red-100 border border-red-200" />High (≥30%)</span>
        </div>
      </div>

      {activeSubjects.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">No out-of-specialization teaching detected.</p>
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left text-slate-500 font-semibold px-2 py-2 sticky left-0 bg-white z-10 min-w-40">Subject</th>
              {sorted.map(r => (
                <th key={r.region} className="text-center px-1 py-2 font-semibold text-slate-500 min-w-16" title={`${region_totals[r.region] ?? r.total_teachers} teachers`}>
                  <div className="text-xs">{r.region}</div>
                  <div className="text-slate-400 font-normal">{r.total_teachers}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeSubjects.map(subj => (
              <tr key={subj} className="border-t border-slate-100">
                <td className="px-2 py-1.5 text-slate-600 sticky left-0 bg-white z-10 font-medium">{subj}</td>
                {sorted.map(r => {
                  const count = matrix[subj]?.[r.region] ?? 0
                  const total = region_totals[r.region] ?? r.total_teachers ?? 0
                  return (
                    <td key={r.region} className={`text-center px-1 py-1.5 font-medium ${cellColor(count, total)}`} title={`${subj} · ${r.region}: ${count} out-of-specialist`}>
                      {count > 0 ? count : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

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
  const [regions, setRegions] = useState([])
  const [provinces, setProvinces] = useState([])
  const [cities, setCities] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sortBy, setSortBy] = useState('gap_score')
  const [compareMode, setCompareMode] = useState(false)
  const [compareSelection, setCompareSelection] = useState([])
  const [showComparison, setShowComparison] = useState(false)
  const [showCalamityOnly, setShowCalamityOnly] = useState(false)
  const [calamityForm, setCalamityForm] = useState({ status: '', reason: '' })
  const [updatingCalamity, setUpdatingCalamity] = useState(false)

  useEffect(() => {
    Promise.all([getRegions(), getProvinces(), getCities()])
      .then(([r, p, c]) => { setRegions(r); setProvinces(p); setCities(c) })
      .finally(() => setLoading(false))
  }, [])

  const selectRegion = (region) => {
    if (!region) return
    setSelected(region)
    setLoadingDetail(true)
    getRegionDetail(region).then(setDetail).finally(() => setLoadingDetail(false))
    setTimeout(() => {
      document.getElementById('region-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const toggleCompareSelection = (region) => {
    if (!compareMode) return
    setCompareSelection(prev => {
      if (prev.includes(region)) {
        return prev.filter(r => r !== region)
      }
      if (prev.length >= 4) {
        return prev // Max 4 regions
      }
      return [...prev, region]
    })
  }

  const showSelectedComparison = () => {
    if (compareSelection.length >= 2) {
      setShowComparison(true)
      setCompareMode(false)
    }
  }

  const openCalamityForm = (region) => {
    setCalamityForm({
      region,
      status: detail?.critical_status || 'normal',
      reason: detail?.critical_reason || '',
    })
  }

  const updateCalamityStatus = async () => {
    if (!calamityForm.region || !calamityForm.reason.trim()) return
    setUpdatingCalamity(true)
    try {
      // Call API to persist calamity status
      const updated = await updateRegionStatus(calamityForm.region, {
        critical_status: calamityForm.status,
        critical_reason: calamityForm.reason,
      })

      // Update local state with API response
      setRegions(prev => prev.map(r =>
        r.region === calamityForm.region
          ? { ...r, critical_status: updated.critical_status, critical_reason: updated.critical_reason }
          : r
      ))
      if (detail && detail.region === calamityForm.region) {
        setDetail(prev => ({
          ...prev,
          critical_status: updated.critical_status,
          critical_reason: updated.critical_reason,
        }))
      }
      setCalamityForm({ region: '', status: '', reason: '' })
    } catch (e) {
      console.error('Failed to update calamity status:', e)
      setError(`Failed to update status: ${e.message}`)
    } finally {
      setUpdatingCalamity(false)
    }
  }

  // Filter regions by calamity status if toggled
  const filteredRegions = showCalamityOnly
    ? regions.filter(r => r.critical_status === 'calamity' || r.critical_status === 'emergency')
    : regions

  const sorted = [...filteredRegions].sort((a, b) => {
    // Always sort calamity-affected regions to top
    if (a.critical_status && !b.critical_status) return -1
    if (!a.critical_status && b.critical_status) return 1
    if (sortBy === 'gap_score') return b.gap_score - a.gap_score
    if (sortBy === 'total') return b.total_teachers - a.total_teachers
    if (sortBy === 'name') return a.region.localeCompare(b.region)
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
            <button
              onClick={() => {
                setCompareMode(!compareMode)
                setCompareSelection([])
                setShowComparison(false)
              }}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                compareMode
                  ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {compareMode ? 'Selecting...' : 'Compare'}
            </button>
            {compareSelection.length >= 2 && (
              <button
                onClick={showSelectedComparison}
                className="btn-primary text-xs"
              >
                Compare {compareSelection.length}
              </button>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCalamityOnly(!showCalamityOnly)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                  showCalamityOnly
                    ? 'bg-red-100 border-red-300 text-red-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.334.192 3 1.732 3z" />
                </svg>
                Calamity
              </button>
              <CalamityInfoTooltip />
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input text-xs w-36">
              <option value="gap_score">Sort: gap score</option>
              <option value="total">Sort: teacher count</option>
              <option value="name">Sort: name</option>
            </select>
            <button onClick={() => exportCSV()} className="btn-secondary text-xs">Export CSV</button>
          </div>
        }
      />

      {/* Compare mode instructions */}
      {compareMode && (
        <div className="card mb-6 bg-indigo-50 border border-indigo-100 p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-indigo-800 mb-1">How to compare regions</h3>
              <ol className="text-xs text-indigo-700 space-y-1">
                <li>1. Click on checkboxes next to 2-4 regions in the table below</li>
                <li>2. Click the "Compare X" button to see side-by-side analysis</li>
                <li>3. View WPI component breakdown to understand why each region has its score</li>
                <li>4. Click "Dismiss" to return to normal view</li>
              </ol>
            </div>
            <button
              onClick={() => {
                setCompareMode(false)
                setCompareSelection([])
                setShowComparison(false)
              }}
              className="text-indigo-400 hover:text-indigo-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="card mb-6 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">Philippines — administrative map</p>
            <p className="text-xs text-slate-400 mt-0.5">Scroll to zoom · Drag to pan · Click a region to inspect</p>
          </div>
          <div className="flex gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block border border-slate-200" style={{ background: '#fca5a5' }} />High gap</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block border border-slate-200" style={{ background: '#fcd34d' }} />Moderate</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block border border-slate-200" style={{ background: '#86efac' }} />Low</span>
          </div>
        </div>
        <PhilippinesMap regions={regions} provinces={provinces} cities={cities} selected={selected} onSelect={selectRegion} compact={false} />
      </div>

      {/* Comparison View */}
      {showComparison && compareSelection.length >= 2 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Regional Comparison</h2>
              <p className="text-xs text-slate-500 mt-0.5">Side-by-side analysis of {compareSelection.length} selected regions</p>
            </div>
            <button
              onClick={() => {
                setShowComparison(false)
                setCompareSelection([])
              }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Dismiss ×
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 min-w-32 sticky left-0 bg-slate-50">Metric</th>
                  {compareSelection.map(regionName => {
                    const r = regions.find(reg => reg.region === regionName)
                    return (
                      <th key={regionName} className="text-center px-2 py-2 font-semibold text-slate-700 min-w-28">
                        <div className="font-bold">{regionName}</div>
                        <div className="text-slate-400 font-normal">{r?.total_teachers ?? 0} teachers</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-600 font-medium sticky left-0 bg-white">Gap Score</td>
                  {compareSelection.map(regionName => {
                    const r = regions.find(reg => reg.region === regionName)
                    const score = Math.round((r?.gap_score ?? 0) * 100)
                    return (
                      <td key={regionName} className="px-2 py-2 text-center">
                        <span className={`font-bold ${score >= 70 ? 'text-red-600' : score >= 40 ? 'text-amber-600' : 'text-green-600'}`}>
                          {score}%
                        </span>
                      </td>
                    )
                  })}
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-600 font-medium sticky left-0 bg-white">Training Coverage</td>
                  {compareSelection.map(regionName => {
                    const r = regions.find(reg => reg.region === regionName)
                    const coverage = r?.total_teachers > 0 ? Math.round((r.trained_count / r.total_teachers) * 100) : 0
                    return (
                      <td key={regionName} className="px-2 py-2 text-center text-slate-700">
                        {coverage}%
                      </td>
                    )
                  })}
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-600 font-medium sticky left-0 bg-white">Student-Teacher Ratio</td>
                  {compareSelection.map(regionName => {
                    const r = regions.find(reg => reg.region === regionName)
                    return (
                      <td key={regionName} className="px-2 py-2 text-center text-slate-700">
                        {r?.avg_student_ratio ?? 0}:1
                      </td>
                    )
                  })}
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-600 font-medium sticky left-0 bg-white">Gap Level</td>
                  {compareSelection.map(regionName => {
                    const r = regions.find(reg => reg.region === regionName)
                    return (
                      <td key={regionName} className="px-2 py-2 text-center">
                        <GapBadge level={r?.gap_level ?? 'Low'} />
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {detail && compareSelection.includes(detail.region) && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-2">Why {detail.region} has this score:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-[10px] text-slate-400">Training gap</p>
                  <p className="text-xs font-bold text-slate-700">{Math.round((detail.components?.coverage_score ?? 0) * 100)}%</p>
                  <p className="text-[9px] text-slate-400">30% weight</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-[10px] text-slate-400">Mismatch</p>
                  <p className="text-xs font-bold text-slate-700">{Math.round((detail.components?.mismatch_score ?? 0) * 100)}%</p>
                  <p className="text-[9px] text-slate-400">25% weight</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-[10px] text-slate-400">Workload</p>
                  <p className="text-xs font-bold text-slate-700">{Math.round((detail.components?.workload_score ?? 0) * 100)}%</p>
                  <p className="text-[9px] text-slate-400">20% weight</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <SubjectShortageHeatmap regions={regions} />

      <div id="region-detail">
        {selected && (
          <div className="card mb-6">
            {loadingDetail ? (
              <Spinner />
            ) : detail ? (
              <div>
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-display font-bold text-slate-800 text-lg">{detail.region}</h2>
                      {detail.critical_status && detail.critical_status !== 'normal' && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          detail.critical_status === 'emergency'
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-amber-500 text-white'
                        }`}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.334.192 3 1.732 3z" />
                          </svg>
                          {detail.critical_status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{detail.total_teachers} teachers · {detail.total_students?.toLocaleString()} students</p>
                    {detail.critical_reason && (
                      <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {detail.critical_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openCalamityForm(detail.region)}
                      className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.334.192 3 1.732 3z" />
                      </svg>
                      {detail.critical_status && detail.critical_status !== 'normal' ? 'Update status' : 'Mark calamity'}
                    </button>
                    {detail.impact_score > 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md">Impact: {detail.impact_score.toLocaleString()}</span>
                    )}
                    <GapBadge level={detail.gap_level} />
                    <button onClick={() => { setSelected(null); setDetail(null) }} className="text-xs text-slate-400 hover:text-slate-600">Dismiss</button>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Weighted Priority Index (WPI) Components</p>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    {[
                      { label: 'Training coverage', key: 'coverage_score', desc: 'Untrained teachers (30%)' },
                      { label: 'Competency mismatch', key: 'mismatch_score', desc: 'Out of specialization (25%)' },
                      { label: 'Instructional workload', key: 'workload_score', desc: `${detail.avg_student_ratio}:1 S/T ratio (20%)` },
                      { label: 'Distance / access', key: 'distance_score', desc: 'Connectivity barriers (15%)' },
                      { label: 'Training recency', key: 'recency_score', desc: 'Stale skills (10%)' },
                      { label: 'Participation reward', key: 'reward', desc: 'Historical engagement bonus', value: detail.engagement_reward, isReward: true },
                    ].map(({ label, key, desc, value, isReward }) => (
                      <div key={key} className={`rounded-lg p-3 ${isReward ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50'}`}>
                        <div className="flex justify-between items-center text-xs mb-2">
                          <span className={`font-medium ${isReward ? 'text-indigo-700' : 'text-slate-700'}`}>{label}</span>
                          <InfoTooltip componentKey={key} />
                        </div>
                        {isReward ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-indigo-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${(value || 0) * 100}%` }} /></div>
                            <span className="text-[10px] font-bold text-indigo-600">{(value || 0).toFixed(2)}</span>
                          </div>
                        ) : <GapBar score={detail.components?.[key] ?? 0} />}
                        <p className={`text-[10px] mt-1 ${isReward ? 'text-indigo-400' : 'text-slate-400'}`}>{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Out-of-field rate</p>
                    <p className="text-lg font-bold text-slate-800">{detail.out_of_field_rate ?? 0}%</p>
                    <p className="text-[11px] text-slate-500">Teachers outside specialization</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Avg competency</p>
                    <p className="text-lg font-bold text-slate-800">{detail.avg_competency_score ?? 0}</p>
                    <p className="text-[11px] text-slate-500">Explainable teacher score</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Training recency gap</p>
                    <p className="text-lg font-bold text-slate-800">{detail.training_recency_gap_pct ?? 0}%</p>
                    <p className="text-[11px] text-slate-500">Teachers needing refreshers</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">At-risk schools</p>
                    <p className="text-lg font-bold text-slate-800">{detail.at_risk_schools ?? 0}</p>
                    <p className="text-[11px] text-slate-500">Critical priority schools</p>
                  </div>
                </div>

                {/* Calamity Status Form */}
                {calamityForm.region === detail.region && (
                  <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.334.192 3 1.732 3z" />
                      </svg>
                      <h3 className="text-sm font-bold text-amber-800">Calamity Status for {detail.region}</h3>
                      <CalamityInfoTooltip />
                    </div>
                    <p className="text-xs text-amber-700 mb-3 -mt-2">
                      Use this form to flag regions affected by disasters. This affects priority scoring and visual indicators on the map.
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-amber-700 mb-1">Status</label>
                        <select
                          value={calamityForm.status}
                          onChange={(e) => setCalamityForm({ ...calamityForm, status: e.target.value })}
                          className="input text-sm w-full"
                        >
                          <option value="normal">Normal operations</option>
                          <option value="calamity">Calamity-affected</option>
                          <option value="emergency">State of emergency</option>
                        </select>
                        <p className="text-[10px] text-amber-600 mt-1">
                          <strong>Calamity:</strong> Typhoon, earthquake, flood · <strong>Emergency:</strong> Severe crisis, armed conflict
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-amber-700 mb-1">Reason / Event</label>
                        <input
                          type="text"
                          value={calamityForm.reason}
                          onChange={(e) => setCalamityForm({ ...calamityForm, reason: e.target.value })}
                          placeholder="e.g. Typhoon Karding, Earthquake"
                          className="input text-sm w-full"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setCalamityForm({ region: '', status: '', reason: '' })}
                        className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={updateCalamityStatus}
                        disabled={updatingCalamity || !calamityForm.reason.trim()}
                        className="btn-primary text-xs"
                      >
                        {updatingCalamity ? 'Updating...' : 'Save status'}
                      </button>
                    </div>
                  </div>
                )}

                {detail.recommendations && detail.recommendations.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M12 2v4"/><path d="m16.2 4.2 2.8 2.8"/><path d="M18 12h4"/><path d="m16.2 19.8 2.8-2.8"/><path d="M12 18v4"/><path d="m4.2 19.8 2.8-2.8"/><path d="M2 12h4"/><path d="m4.2 4.2 2.8 2.8"/></svg>
                      Prescriptive strategy
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {detail.recommendations.map((rec, idx) => (
                        <div key={idx} className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl p-4 shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0"><span className="text-[10px] font-bold text-indigo-600">{idx + 1}</span></div>
                            <p className="text-xs text-slate-700 leading-relaxed font-medium">{rec}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <ModuleHeatmap moduleUptake={detail.module_uptake} total={detail.total_teachers} />
                </div>

                {detail.schools?.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">School-level priorities</p>
                    <div className="overflow-hidden rounded-xl border border-slate-100">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-slate-500">School</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-500">Teachers</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-500">Competency</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-500">Out-of-field</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-500">Coverage</th>
                            <th className="text-center px-3 py-2 font-semibold text-slate-500">Priority</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.schools.slice(0, 6).map(school => (
                            <tr key={`${school.school_name}-${school.region}`} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-700">
                                <div className="font-medium">{school.school_name}</div>
                                <div className="text-[11px] text-slate-400">{school.region}{school.province ? ` · ${school.province}` : ''}</div>
                              </td>
                              <td className="px-3 py-2 text-right text-slate-600">{school.total_teachers}</td>
                              <td className="px-3 py-2 text-right text-slate-600">{school.avg_competency_score}</td>
                              <td className="px-3 py-2 text-right text-slate-600">{school.out_of_field_rate}%</td>
                              <td className="px-3 py-2 text-right text-slate-600">{school.training_coverage_pct}%</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${school.priority_level === 'Critical' ? 'bg-red-100 text-red-700' : school.priority_level === 'Moderate' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                  {school.priority_level}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {detail.schools.slice(0, 4).map((school, idx) => (
                        <div key={`${school.school_name}-rec-${idx}`} className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                          <p className="text-xs font-semibold text-indigo-700 mb-1">{school.school_name}</p>
                          <p className="text-xs text-slate-600 mb-2">{school.recommendations?.[0]}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(school.module_recommendations || []).slice(0, 3).map(mod => (
                              <span key={mod} className="text-[10px] bg-white text-indigo-600 border border-indigo-100 rounded-full px-2 py-0.5">{mod}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(detail.subject_breakdown ?? {}).length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Subject coverage</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(detail.subject_breakdown).map(([subj, count]) => (
                        <span key={subj} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{subj} <span className="text-slate-400">· {count}</span></span>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => exportCSV(detail.region)} className="btn-secondary text-xs">Export region CSV</button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {compareMode && (
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 w-12">Select</th>
              )}
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Region</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Teachers</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Trained</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Ratio</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-40">Gap score</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Level</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const isSelected = compareSelection.includes(r.region)
              const canSelect = !isSelected && compareSelection.length >= 4
              const isCalamity = r.critical_status && r.critical_status !== 'normal'

              return (
                <tr
                  key={r.region}
                  onClick={() => compareMode ? toggleCompareSelection(r.region) : selectRegion(r.region)}
                  className={`border-b border-slate-50 transition-colors ${
                    compareMode
                      ? isSelected ? 'bg-indigo-50' : canSelect ? 'cursor-pointer hover:bg-slate-50' : 'cursor-not-allowed opacity-50'
                      : isCalamity
                        ? selected === r.region ? 'bg-star-50 border-l-4 border-l-red-500' : 'cursor-pointer hover:bg-red-50 border-l-4 border-l-red-300'
                        : selected === r.region ? 'bg-star-50' : 'cursor-pointer hover:bg-slate-50'
                  }`}
                >
                  {compareMode && (
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCompareSelection(r.region)}
                        disabled={canSelect && !isSelected}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-slate-700">
                    <div className="flex items-center gap-2">
                      {r.region}
                      {isCalamity && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                          r.critical_status === 'emergency'
                            ? 'bg-red-600 text-white'
                            : 'bg-amber-500 text-white'
                        }`}>
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.334.192 3 1.732 3z" />
                          </svg>
                          {r.critical_status}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{r.total_teachers}</td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {r.trained_count}
                    <span className="text-slate-300 ml-1">({r.total_teachers > 0 ? Math.round((r.trained_count / r.total_teachers) * 100) : 0}%)</span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 font-medium whitespace-nowrap">{r.avg_student_ratio}:1</td>
                  <td className="px-4 py-3 w-40"><GapBar score={r.gap_score} /></td>
                  <td className="px-4 py-3 text-center"><GapBadge level={r.gap_level} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {compareMode && compareSelection.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg z-50">
          <p className="text-sm font-medium">
            {compareSelection.length} region{compareSelection.length !== 1 ? 's' : ''} selected
            {compareSelection.length >= 2 && (
              <span className="ml-3 text-xs text-slate-300">Click "Compare {compareSelection.length} regions" above</span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}