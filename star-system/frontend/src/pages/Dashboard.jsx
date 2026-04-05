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
import { getSummary, getRegions, exportCSV } from '../lib/api'
import { GAP_COLORS, pct } from '../lib/constants'
import { StatCard, GapBadge, GapBar, Spinner, PageHeader } from '../components/shared'
import PhilippinesMap from '../components/shared/PhilippinesMap'

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

export default function Dashboard() {
  // State for API data
  const [summary, setSummary] = useState(null)    // Summary statistics
  const [regions, setRegions] = useState([])       // Regional gap analysis
  const [loading, setLoading] = useState(true)     // Loading state
  const navigate = useNavigate()

  // Fetch data on mount
  useEffect(() => {
    Promise.all([getSummary(), getRegions()])
      .then(([s, r]) => { setSummary(s); setRegions(r) })
      .finally(() => setLoading(false))
  }, [])

  // Show loading spinner while fetching
  if (loading) return <Spinner />

  // Prepare data for display
  const topGap = regions.filter(r => r.gap_level === 'high').slice(0, 5)  // Top 5 high-gap regions
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
          <button onClick={() => exportCSV()} className="btn-secondary text-xs">
            Export all CSV
          </button>
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
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Priority regions
            <span className="ml-2 text-xs font-normal text-slate-400">High gap score</span>
          </h2>
          {topGap.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No high-gap regions detected</p>
          ) : (
            <div className="flex flex-col gap-4">
              {topGap.map(r => (
                <div key={r.region}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{r.region}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{r.total_teachers} teachers</span>
                      <GapBadge level={r.gap_level} />
                    </div>
                  </div>
                  <GapBar score={r.gap_score} />
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