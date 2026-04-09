import { useEffect, useMemo, useState } from 'react'
import { getReassignmentSuggestions, getSchools, getSummary, simulateTraining } from '../lib/api'
import { EmptyState, PageHeader, Spinner } from '../components/shared'

export default function InterventionsPage() {
  const [summary, setSummary] = useState(null)
  const [schools, setSchools] = useState([])
  const [reassignments, setReassignments] = useState([])
  const [simulation, setSimulation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [runningSim, setRunningSim] = useState(false)
  const [trainingCount, setTrainingCount] = useState(10)
  const [uplift, setUplift] = useState(12)

  useEffect(() => {
    setError('')
    Promise.all([
      getSummary(),
      getSchools(),
      getReassignmentSuggestions(20),
    ])
      .then(([summaryData, schoolsData, reassignmentData]) => {
        setSummary(summaryData)
        setSchools(schoolsData)
        setReassignments(reassignmentData)
        setSimulation(null)
      })
      .catch((e) => {
        setSummary(null)
        setSchools([])
        setReassignments([])
        setSimulation(null)
        setError(e?.message || 'Failed to load intervention data')
      })
      .finally(() => setLoading(false))
  }, [])

  const criticalSchools = useMemo(
    () => schools.filter((school) => school.priority_level === 'Critical').slice(0, 10),
    [schools]
  )

  const forecastRows = useMemo(() => {
    return schools
      .map((school) => {
        const lowCompetency = Math.max(0, 1 - (school.avg_competency_score ?? 0) / 100)
        const mismatch = (school.out_of_field_rate ?? 0) / 100
        const lowCoverage = Math.max(0, 1 - (school.training_coverage_pct ?? 0) / 100)
        const recencyGap = (school.training_recency_gap_pct ?? 0) / 100
        const load = Math.min((school.avg_student_ratio ?? 0) / 45, 1)

        const riskIndex = Math.round(
          100 * (
            0.30 * lowCompetency
            + 0.25 * mismatch
            + 0.20 * lowCoverage
            + 0.15 * recencyGap
            + 0.10 * load
          )
        )

        let riskBand = 'Watch'
        if (riskIndex >= 70) riskBand = 'At risk'
        else if (riskIndex >= 45) riskBand = 'Moderate risk'

        return {
          school_name: school.school_name,
          region: school.region,
          risk_index: riskIndex,
          risk_band: riskBand,
          reason: [
            lowCoverage >= 0.5 ? 'low training activity' : null,
            mismatch >= 0.3 ? 'high mismatch' : null,
            lowCompetency >= 0.45 ? 'low competency' : null,
          ].filter(Boolean).join(', ') || 'mixed signals',
        }
      })
      .sort((a, b) => b.risk_index - a.risk_index)
      .slice(0, 12)
  }, [schools])

  const runSimulation = async () => {
    setRunningSim(true)
    setError('')
    try {
      const result = await simulateTraining(trainingCount, uplift)
      setSimulation(result)
    } catch (e) {
      setSimulation(null)
      setError(e?.message || 'Failed to run simulation')
    } finally {
      setRunningSim(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Interventions"
        subtitle="Prioritization, reassignment matching, and impact simulation"
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="card border-l-4 border-red-500">
          <p className="text-sm text-slate-700">{error}</p>
          <p className="text-xs text-slate-500 mt-2">Check that backend is running on port 8000, then refresh.</p>
        </div>
      ) : !summary ? (
        <EmptyState message="No intervention data available" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="card border-l-4 border-red-500">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Critical schools</p>
              <p className="text-2xl font-display font-bold text-red-700">{criticalSchools.length}</p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">At-risk schools</p>
              <p className="text-2xl font-display font-bold text-slate-800">{summary.at_risk_schools ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Out-of-field (system)</p>
              <p className="text-2xl font-display font-bold text-slate-800">{summary.out_of_field_pct ?? 0}%</p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Recency gap</p>
              <p className="text-2xl font-display font-bold text-slate-800">{summary.training_recency_gap_pct ?? 0}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Priority school actions</p>
              <div className="space-y-3">
                {criticalSchools.length === 0 ? (
                  <p className="text-sm text-slate-400">No critical schools found.</p>
                ) : (
                  criticalSchools.map((school) => (
                    <div key={`${school.region}-${school.school_name}`} className="border border-slate-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-slate-700">{school.school_name}</p>
                        <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{school.priority_level}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-1">{school.region} · Score {school.priority_score}</p>
                      <p className="text-xs text-slate-600">{(school.recommendations ?? [])[0]}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Impact simulation</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Teachers to train</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={trainingCount}
                    onChange={(event) => setTrainingCount(Number(event.target.value || 0))}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Expected score uplift</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={uplift}
                    onChange={(event) => setUplift(Number(event.target.value || 0))}
                    className="input text-sm"
                  />
                </div>
              </div>
              <button type="button" onClick={runSimulation} disabled={runningSim} className="btn-primary text-xs mb-4">
                {runningSim ? 'Running simulation...' : 'Run simulation'}
              </button>

              {simulation && (
                <div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Baseline</p>
                      <p className="text-lg font-bold text-slate-800">{simulation.baseline_average_competency}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Projected</p>
                      <p className="text-lg font-bold text-slate-800">{simulation.projected_average_competency}</p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                      <p className="text-[10px] uppercase tracking-wide text-indigo-500 mb-1">Improvement</p>
                      <p className="text-lg font-bold text-indigo-700">+{simulation.improvement}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Simulated teachers: {simulation.teachers_simulated}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Deployment and relocation matching</p>
            {reassignments.length === 0 ? (
              <p className="text-sm text-slate-400">No reassignment suggestions available.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Teacher</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Current region</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Target school</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Target region</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Fit score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reassignments.map((match) => (
                      <tr key={`${match.teacher_id}-${match.target_school}`} className="border-b border-slate-50">
                        <td className="px-3 py-2 text-slate-700">{match.teacher_name}</td>
                        <td className="px-3 py-2 text-slate-600">{match.current_region}</td>
                        <td className="px-3 py-2 text-slate-600">{match.target_school}</td>
                        <td className="px-3 py-2 text-slate-600">{match.target_region}</td>
                        <td className="px-3 py-2 text-right text-slate-700 font-medium">{match.fit_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card mt-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">At-risk school forecast</p>
            <p className="text-xs text-slate-500 mb-3">Projected risk is based on low training activity, high mismatch, low competency, and high student load.</p>
            {forecastRows.length === 0 ? (
              <p className="text-sm text-slate-400">No forecast data available.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">School</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Region</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Reason</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Risk index</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Band</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecastRows.map((row) => (
                      <tr key={`${row.region}-${row.school_name}`} className="border-b border-slate-50">
                        <td className="px-3 py-2 text-slate-700">{row.school_name}</td>
                        <td className="px-3 py-2 text-slate-600">{row.region}</td>
                        <td className="px-3 py-2 text-slate-600">{row.reason}</td>
                        <td className="px-3 py-2 text-right text-slate-700 font-medium">{row.risk_index}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${row.risk_band === 'At risk' ? 'bg-red-100 text-red-700' : row.risk_band === 'Moderate risk' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {row.risk_band}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
