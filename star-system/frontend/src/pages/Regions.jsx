import { useEffect, useState } from 'react'
import { getRegions, getRegionDetail, exportCSV } from '../lib/api'
import { GapBadge, GapBar, Spinner, PageHeader, EmptyState } from '../components/shared'
import PhilippinesMap from '../components/shared/PhilippinesMap'

export default function RegionsPage() {
  const [regions, setRegions] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sortBy, setSortBy] = useState('gap_score')

  useEffect(() => {
    getRegions().then(setRegions).finally(() => setLoading(false))
  }, [])

  const selectRegion = (region) => {
    setSelected(region)
    setLoadingDetail(true)
    getRegionDetail(region)
      .then(setDetail)
      .finally(() => setLoadingDetail(false))
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
        subtitle="Underservice scores across all 17 STAR regions"
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

      <div className="flex gap-4 mb-5 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> High gap (&ge;70%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-300 inline-block" /> Moderate (40&ndash;69%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> Low (&lt;40%)
        </span>   
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="card lg:col-span-1 flex flex-col items-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 self-start">
            Click a region to inspect
          </p>
          <PhilippinesMap
            regions={regions}
            selected={selected}
            onSelect={selectRegion}
          />
        </div>

        <div className="card lg:col-span-2">
          {!selected ? (
            <EmptyState message="Click a region on the map or in the table below" />
          ) : loadingDetail ? (
            <Spinner />
          ) : detail ? (
            <div>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="font-display font-bold text-slate-800 text-lg">{detail.region}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{detail.total_teachers} teachers registered</p>
                </div>
                <GapBadge level={detail.gap_level} />
              </div>

              <div className="mb-6">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Gap score components
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Training coverage',   key: 'coverage_score',  desc: 'Untrained teachers' },
                    { label: 'Competency mismatch', key: 'mismatch_score',  desc: 'Teaching out of specialization' },
                    { label: 'Training recency',    key: 'recency_score',   desc: 'No training in 3 years' },
                    { label: 'Distance / access',   key: 'distance_score',  desc: '3hrs+ from training center' },
                  ].map(({ label, key, desc }) => (
                    <div key={key} className="bg-slate-50 rounded-lg p-3">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="font-medium text-slate-700">{label}</span>
                        <span className="text-slate-400">{desc}</span>
                      </div>
                      <GapBar score={detail.components?.[key] ?? 0} />
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
                        <span key={subj} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
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
                className="btn-secondary text-xs w-full mt-5"
              >
                Export region CSV
              </button>
            </div>
          ) : null}
        </div>
      </div>

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
