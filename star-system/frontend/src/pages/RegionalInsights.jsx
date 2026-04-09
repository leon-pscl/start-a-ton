import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRegionalInsights } from '../lib/api'
import { EmptyState, PageHeader, Spinner } from '../components/shared'

export default function RegionalInsightsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
    getRegionalInsights()
      .then(setRows)
      .catch((e) => {
        setRows([])
        setError(e?.message || 'Failed to load regional insights')
      })
      .finally(() => setLoading(false))
  }, [])

  const topOutOfField = [...rows].sort((a, b) => b.out_of_field_pct - a.out_of_field_pct)[0]
  const topAtRisk = [...rows].sort((a, b) => b.at_risk_schools - a.at_risk_schools)[0]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Regional insights"
        subtitle="Out-of-field rates, training gaps by subject, and school-level aggregation"
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="card border-l-4 border-red-500">
          <p className="text-sm text-slate-700">{error}</p>
          <p className="text-xs text-slate-500 mt-2">Check that backend is running on port 8000, then refresh.</p>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState message="No regional insight data available" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Regions analyzed</p>
              <p className="text-2xl font-display font-bold text-slate-800">{rows.length}</p>
            </div>
            <div className="card border-l-4 border-red-500">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Highest out-of-field</p>
              <p className="text-lg font-display font-bold text-red-700">{topOutOfField?.region || 'N/A'}</p>
              <p className="text-xs text-slate-500 mt-1">{topOutOfField?.out_of_field_pct ?? 0}% out-of-field</p>
            </div>
            <div className="card border-l-4 border-indigo-500">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Most at-risk schools</p>
              <p className="text-lg font-display font-bold text-indigo-700">{topAtRisk?.region || 'N/A'}</p>
              <p className="text-xs text-slate-500 mt-1">{topAtRisk?.at_risk_schools ?? 0} schools</p>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Region</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Gap score</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Out-of-field</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Avg competency</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Recency gap</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Schools</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Critical</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Top subject gaps</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.region} className="border-b border-slate-50">
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      <button
                        onClick={() => navigate(`/schools?region=${encodeURIComponent(row.region)}`)}
                        className="text-left hover:underline text-indigo-700"
                        title="Open School priorities for this region"
                      >
                        {row.region}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{Math.round((row.gap_score ?? 0) * 100)}%</td>
                    <td className="px-4 py-3 text-right text-slate-600">{row.out_of_field_pct}%</td>
                    <td className="px-4 py-3 text-right text-slate-600">{row.avg_competency_score}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{row.training_recency_gap_pct}%</td>
                    <td className="px-4 py-3 text-right text-slate-600">{row.school_count}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{row.critical_schools}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {(row.top_subject_gaps ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {row.top_subject_gaps.map((item) => (
                            <span key={`${row.region}-${item.subject}`} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                              {item.subject}: {item.count}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">No major subject gaps</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
