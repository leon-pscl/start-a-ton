/**
 * Dashboard Page Component (Command Center)
 *
 * Redesigned with data hierarchy for Program Officers:
 * - Level 1: Critical alerts and priority actions (what to act on NOW)
 * - Level 2: System health metrics (compact)
 * - Level 3: Detailed analytics (collapsible, progressive disclosure)
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getSummary, getRegions, exportCSV, exportPDF } from '../lib/api'
import { GAP_COLORS } from '../lib/constants'
import { StatCard, GapBar, Spinner, PageHeader } from '../components/shared'
import PhilippinesMap from '../components/shared/PhilippinesMap'
import { getCurrentUser } from '../lib/auth'

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const user = getCurrentUser()
  const [summary, setSummary] = useState(null)
  const [regions, setRegions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [selectedAlertRegion, setSelectedAlertRegion] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([getSummary(), getRegions()])
      .then(([s, r]) => { setSummary(s); setRegions(r) })
      .catch((e) => setError(e?.message || 'Failed to load dashboard data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (error || !summary) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <PageHeader title="Command Center" subtitle="Unable to load analytics right now" />
        <div className="card border-l-4 border-red-500">
          <p className="text-sm text-slate-700">{error || 'Dashboard data is unavailable.'}</p>
          <p className="text-xs text-slate-500 mt-2">Check that backend is running on port 8000, then refresh.</p>
        </div>
      </div>
    )
  }

  // Calculate critical alerts (regions exceeding 70% WPI)
  const criticalRegions = regions.filter(r => r.gap_score >= 0.70)
  const highGapRegions = regions.filter(r => r.gap_level === 'High')

  // Priority interventions ranked by impact score
  const interventions = summary.high_impact_interventions ?? []

  // Chart data (top 12 by gap score)
  const chartData = regions
    .sort((a, b) => b.gap_score - a.gap_score)
    .slice(0, 12)
    .map(r => ({
      name: r.region.replace('Region ', 'R'),
      score: Math.round(r.gap_score * 100),
      level: r.gap_level,
    }))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Command Center"
        subtitle="STAR capacity-building data across all regions"
        actions={
          <div className="flex gap-2">
            <button onClick={() => exportPDF()} className="btn-primary text-xs flex items-center gap-1.5 px-4 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Executive PDF
            </button>
            <button onClick={() => exportCSV()} className="btn-secondary text-xs">
              Export all CSV
            </button>
          </div>
        }
      />

      {/* ======================================================================= */}
      {/* LEVEL 1: CRITICAL ALERTS (what needs immediate attention)                */}
      {/* ======================================================================= */}
      {criticalRegions.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.334.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-800 mb-1">
                Critical Alert: {criticalRegions.length} region{criticalRegions.length !== 1 ? 's' : ''} exceed 70% gap score
              </h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {criticalRegions.map(r => (
                  <button
                    key={r.region}
                    onClick={() => {
                      setSelectedAlertRegion(r.region)
                      navigate(`/regions?selected=${encodeURIComponent(r.region)}`)
                    }}
                    className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors font-medium"
                  >
                    {r.region} — {Math.round(r.gap_score * 100)}% gap
                  </button>
                ))}
              </div>
              <p className="text-xs text-red-600 mt-2">
                Click a region to view detailed breakdown and recommended interventions
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* LEVEL 1: PRIORITY ACTIONS (top interventions to act on)                  */}
      {/* ======================================================================= */}
      <div className="card border-l-4 border-indigo-500 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Priority Actions</h2>
            <p className="text-xs text-slate-500 mt-0.5">Top interventions ranked by potential student impact</p>
          </div>
          <button
            onClick={() => navigate('/interventions')}
            className="text-xs text-indigo-600 hover:underline font-medium"
          >
            View all interventions →
          </button>
        </div>

        {interventions.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No priority interventions identified</p>
        ) : (
          <div className="space-y-3">
            {interventions.slice(0, 5).map((item, index) => (
              <div
                key={`${item.school_name}-${index}`}
                className="group cursor-pointer p-3 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all"
                onClick={() => navigate(`/regions?selected=${encodeURIComponent(item.region)}`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{item.school_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      Impact: {item.priority_score?.toLocaleString?.() ?? item.priority_score}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      item.priority_level === 'Critical'
                        ? 'bg-red-100 text-red-700'
                        : item.priority_level === 'Moderate'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {item.priority_level}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                  <span>{item.region}</span>
                  <span>·</span>
                  <span><span className="font-semibold">{item.total_teachers}</span> teachers</span>
                  <span>·</span>
                  <span><span className="font-semibold">{item.training_coverage_pct}%</span> coverage</span>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-slate-600">
                      <span className="font-medium text-slate-700">Issue: </span>
                      {item.reason}
                    </p>
                    <p className="text-xs text-indigo-700 mt-1">
                      <span className="font-medium">Action: </span>
                      {item.recommendations?.[0] || 'Review regional data'}
                    </p>
                  </div>
                  <div className="w-32 shrink-0">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                        style={{ width: `${Math.min(100, (item.priority_score / (interventions[0]?.priority_score || 1)) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 text-right mt-0.5">Relative priority</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ======================================================================= */}
      {/* LEVEL 2: SYSTEM HEALTH + MINI MAP                                        */}
      {/* ======================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left: Stat cards */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <StatCard
            label="Total teachers"
            value={summary.total_teachers.toLocaleString()}
            sub="Across all regions"
          />
          <StatCard
            label="Training coverage"
            value={`${summary.training_coverage_pct}%`}
            sub={`${summary.trained_teachers} of ${summary.total_teachers} trained`}
            accent={summary.training_coverage_pct >= 60 ? 'text-green-600' : 'text-amber-600'}
          />
          <StatCard
            label="Critical regions"
            value={criticalRegions.length}
            sub="Require immediate action"
            accent={criticalRegions.length > 0 ? 'text-red-600' : 'text-green-600'}
          />
          <StatCard
            label="At-risk schools"
            value={summary.at_risk_schools ?? 0}
            sub={`System OOF: ${summary.out_of_field_pct ?? 0}%`}
            accent="text-indigo-700"
          />
        </div>

        {/* Right: Mini map */}
        <div className="card flex flex-col items-center p-4">
          <div className="flex items-center justify-between w-full mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Regional overview</h3>
            <button
              onClick={() => navigate('/regions')}
              className="text-xs text-star-600 hover:underline"
            >
              Full map →
            </button>
          </div>
          <div className="w-full aspect-square">
            <PhilippinesMap
              regions={regions}
              compact={true}
              onSelect={(region) => navigate(`/regions?selected=${encodeURIComponent(region)}`)}
            />
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* GAP SCORE CHART                                                          */}
      {/* ======================================================================= */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Gap scores by region</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`}
              tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={52}
              tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={v => [`${v}%`, 'Gap score']} />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={14}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={GAP_COLORS[entry.level]?.hex ?? '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ======================================================================= */}
      {/* COMPETENCY DISTRIBUTION                                                  */}
      {/* ======================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <p className="text-xs font-medium text-slate-500">Competency Low</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{summary.competency_distribution?.low ?? 0}</p>
          <p className="text-xs text-slate-400 mt-1">Teachers needing intervention</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <p className="text-xs font-medium text-slate-500">Competency Medium</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{summary.competency_distribution?.medium ?? 0}</p>
          <p className="text-xs text-slate-400 mt-1">Teachers on watch</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-xs font-medium text-slate-500">Competency High</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{summary.competency_distribution?.high ?? 0}</p>
          <p className="text-xs text-slate-400 mt-1">Ready for advanced modules</p>
        </div>
      </div>
    </div>
  )
}
