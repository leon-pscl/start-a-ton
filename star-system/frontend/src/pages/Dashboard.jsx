/**
 * Dashboard Page Component
 *
 * The main landing page showing system-wide statistics and overview.
 * Displays:
 * - Summary cards (total teachers, coverage, high-gap regions, training records)
 * - Interactive map of the Philippines (compact view)
 * - Bar chart of gap scores by region
 * - Priority regions list (high-gap areas)
 * - STAR modules list
 *
 * Data is fetched from the analytics API on mount.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getSummary, getRegions, exportCSV, exportPDF } from '../lib/api'
import { GAP_COLORS } from '../lib/constants'
import { StatCard, GapBar, Spinner, PageHeader } from '../components/shared'
import PhilippinesMap from '../components/shared/PhilippinesMap'

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

export default function Dashboard() {
  // State for API data
  const [summary, setSummary] = useState(null)    // Summary statistics
  const [regions, setRegions] = useState([])       // Regional gap analysis
  const [loading, setLoading] = useState(true)     // Loading state
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // Fetch data on mount
  useEffect(() => {
    Promise.all([getSummary(), getRegions()])
      .then(([s, r]) => { setSummary(s); setRegions(r) })
      .catch((e) => setError(e?.message || 'Failed to load dashboard data'))
      .finally(() => setLoading(false))
  }, [])

  // Show loading spinner while fetching
  if (loading) return <Spinner />
  if (error || !summary) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <PageHeader title="System overview" subtitle="Unable to load analytics right now" />
        <div className="card border-l-4 border-red-500">
          <p className="text-sm text-slate-700">{error || 'Dashboard data is unavailable.'}</p>
          <p className="text-xs text-slate-500 mt-2">Check that backend is running on port 8000, then refresh.</p>
        </div>
      </div>
    )
  }

  // Prepare data for display
  // Rank by Impact Score (Impact = Gap * Students Affected)
  const interventions = summary.high_impact_interventions ?? []
  const chartData = regions
    .sort((a, b) => b.gap_score - a.gap_score)  // Sort by gap score (highest first)
    .slice(0, 12)                                // Show top 12
    .map(r => ({
      name: r.region.replace('Region ', 'R'),   // Abbreviate for chart
      score: Math.round(r.gap_score * 100),      // Convert to percentage
      level: r.gap_level,
    }))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="System overview"
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

      {/* ----------------------------------------------------------------------- */}
      {/* Summary Statistics Cards                                                */}
      {/* ----------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
          label="High-gap regions"
          value={summary.high_gap_regions}
          sub="Priority for deployment"
          accent="text-red-600"
        />
        <StatCard
          label="Training records"
          value={summary.total_training_records.toLocaleString()}
          sub="STAR module completions"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Competency low"
          value={summary.competency_distribution?.low ?? 0}
          sub="Teachers needing intervention"
          accent="text-red-600"
        />
        <StatCard
          label="Competency medium"
          value={summary.competency_distribution?.medium ?? 0}
          sub="Teachers on watch"
          accent="text-amber-600"
        />
        <StatCard
          label="Competency high"
          value={summary.competency_distribution?.high ?? 0}
          sub="Ready for advanced modules"
          accent="text-green-600"
        />
        <StatCard
          label="At-risk schools"
          value={summary.at_risk_schools ?? 0}
          sub={`Out-of-field ${summary.out_of_field_pct ?? 0}%`}
          accent="text-indigo-700"
        />
      </div>

      {/* ----------------------------------------------------------------------- */}
      {/* Map and Chart Row                                                       */}
      {/* ----------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Compact map - navigates to Regions page on click */}
        <div className="card flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Regional overview</h2>
            <button
              onClick={() => navigate('/regions')}
              className="text-xs text-star-600 hover:underline"
            >
              View full map →
            </button>
          </div>
          <PhilippinesMap
            regions={regions}
            compact={true}
            onSelect={(region) => navigate(`/regions?selected=${encodeURIComponent(region)}`)}
          />
        </div>

        {/* Gap score bar chart */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Gap scores by region
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`}
                tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={52}
                tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => [`${v}%`, 'Gap score']} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={14}>
                {/* Color bars by gap level */}
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={GAP_COLORS[entry.level]?.hex ?? '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ----------------------------------------------------------------------- */}
      {/* Priority Regions and STAR Modules                                      */}
      {/* ----------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Priority regions - those with high gap scores */}
        <div className="card border-l-4 border-indigo-500">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">
            High-impact interventions
          </h2>
          <p className="text-xs text-indigo-500 font-medium mb-4 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Priority by potential student reach
          </p>
          {interventions.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No impact data available</p>
          ) : (
            <div className="flex flex-col gap-4">
              {interventions.slice(0, 5).map((item, index) => (
                <div
                  key={`${item.school_name}-${index}`}
                  className="group cursor-pointer"
                  onClick={() => navigate(`/regions?selected=${encodeURIComponent(item.region)}`)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-700">{item.school_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded">
                        Impact: {item.priority_score?.toLocaleString?.() ?? item.priority_score}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
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
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] text-slate-500">
                      {item.region} · <span className="font-semibold">{item.total_teachers}</span> teachers · <span className="font-semibold">{item.training_coverage_pct}%</span> coverage
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {item.reason}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {item.recommendations?.[0]}
                  </p>
                  <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700" 
                      style={{ width: `${Math.min(100, (item.priority_score / ((interventions[0]?.priority_score) || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* STAR modules list */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">STAR modules</h2>
          <p className="text-xs text-slate-400 mb-4">7 capacity-building modules</p>
          <div className="flex flex-wrap gap-2">
            {(summary.star_modules ?? []).map(m => (
              <span key={m} className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg">
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}