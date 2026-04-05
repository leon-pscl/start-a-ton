import { useEffect, useState } from 'react'
import { getRegions, getRegionDetail, getProvinces, getCities, exportCSV } from '../lib/api'
import { GapBadge, GapBar, Spinner, PageHeader, EmptyState } from '../components/shared'
import PhilippinesMap from '../components/shared/PhilippinesMap'

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

      {/* Detail panel — appears below map when region is selected */}
      <div id="region-detail">
        {selected && (
          <div className="card mb-6">
            {loadingDetail ? (
              <Spinner />
            ) : detail ? (
              <div>
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

                {/* Score components */}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {Object.keys(detail.subject_breakdown ?? {}).length > 0 && (
                    <div>
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

                  {Object.keys(detail.module_uptake ?? {}).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        Module uptake
                      </p>
                      <div className="flex flex-col gap-1">
                        {Object.entries(detail.module_uptake)
                          .sort(([, a], [, b]) => b - a)
                          .map(([mod, count]) => (
                            <div key={mod} className="flex justify-between text-xs">
                              <span className="text-slate-600 truncate pr-2">{mod}</span>
                              <span className="text-slate-400 shrink-0">{count}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => exportCSV(detail.region)}
                  className="btn-secondary text-xs mt-5"
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
