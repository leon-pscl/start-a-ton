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
  const [bulkSelection, setBulkSelection] = useState([])
  const [bulkAction, setBulkAction] = useState('')
  const [showBulkMenu, setShowBulkMenu] = useState(false)
  const [savedScenarios, setSavedScenarios] = useState([])
  const [showGuide, setShowGuide] = useState(true)

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

  const runPresetSimulation = async (preset) => {
    switch (preset) {
      case 'math50':
        setTrainingCount(50)
        setUplift(15)
        break
      case 'region10':
        setTrainingCount(10)
        setUplift(10)
        break
      case 'full':
        setTrainingCount(100)
        setUplift(20)
        break
      default:
        break
    }
    setTimeout(() => runSimulation(), 100)
  }

  const saveScenario = () => {
    if (!simulation) return
    const scenario = {
      id: Date.now(),
      name: `Scenario ${savedScenarios.length + 1}`,
      trainingCount,
      uplift,
      result: simulation,
      savedAt: new Date().toISOString(),
    }
    setSavedScenarios(prev => [...prev, scenario])
  }

  const toggleBulkSelection = (schoolName) => {
    setBulkSelection(prev => {
      if (prev.includes(schoolName)) {
        return prev.filter(s => s !== schoolName)
      }
      return [...prev, schoolName]
    })
  }

  const handleBulkAction = () => {
    if (!bulkAction || bulkSelection.length === 0) return
    // In a real implementation, this would call an API
    alert(`Bulk action "${bulkAction}" on ${bulkSelection.length} schools: ${bulkSelection.join(', ')}`)
    setBulkSelection([])
    setBulkAction('')
    setShowBulkMenu(false)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Planning & Simulation"
        subtitle="Prioritization, reassignment matching, and impact simulation"
        actions={
          <div className="flex items-center gap-3">
            {bulkSelection.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{bulkSelection.length} selected</span>
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value)}
                  className="input text-xs w-40"
                >
                  <option value="">Select action...</option>
                  <option value="deploy_math">Deploy Math Module</option>
                  <option value="deploy_science">Deploy Science Module</option>
                  <option value="schedule_training">Schedule Training</option>
                </select>
                <button onClick={handleBulkAction} disabled={!bulkAction} className="btn-primary text-xs py-1">
                  Apply
                </button>
                <button onClick={() => { setBulkSelection([]); setBulkAction('') }} className="text-xs text-slate-400 hover:text-slate-600">
                  Clear
                </button>
              </div>
            )}
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {showGuide ? 'Hide Guide' : 'Show Guide'}
            </button>
          </div>
        }
      />

      {/* Quick Guide */}
      {showGuide && (
        <div className="mb-6 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-5">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold text-indigo-800">How to Use This Page</h3>
            <button onClick={() => setShowGuide(false)} className="text-indigo-400 hover:text-indigo-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="flex gap-3">
              <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
              <div>
                <p className="font-medium text-slate-700">Review Critical Schools</p>
                <p className="text-xs text-slate-500 mt-0.5">See schools that need immediate intervention. Select schools for bulk actions.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
              <div>
                <p className="font-medium text-slate-700">Run Simulations</p>
                <p className="text-xs text-slate-500 mt-0.5">Set teachers to train and expected uplift, then click "Run simulation" to see projected impact.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
              <div>
                <p className="font-medium text-slate-700">Explore Reassignments</p>
                <p className="text-xs text-slate-500 mt-0.5">View teacher relocation suggestions to fill gaps in underserved schools.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</div>
              <div>
                <p className="font-medium text-slate-700">Check Risk Forecast</p>
                <p className="text-xs text-slate-500 mt-0.5">See which schools are projected to become at-risk based on current metrics.</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-100">
            <p className="text-xs text-indigo-600">
              <strong>Tip:</strong> Use the preset scenario buttons for quick simulations, or customize values manually. Save scenarios to compare different approaches.
            </p>
          </div>
        </div>
      )}

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
          {/* Quick stats for context */}
          <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Critical = Immediate action needed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              At-risk = Monitor closely
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              Watch = Stable for now
            </span>
          </div>
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
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Priority school actions</p>
                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkSelection.length === criticalSchools.length && criticalSchools.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setBulkSelection(criticalSchools.map(s => s.school_name))
                      } else {
                        setBulkSelection([])
                      }
                    }}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  Select all
                </label>
              </div>
              <div className="space-y-3">
                {criticalSchools.length === 0 ? (
                  <p className="text-sm text-slate-400">No critical schools found.</p>
                ) : (
                  criticalSchools.map((school) => (
                    <div
                      key={`${school.region}-${school.school_name}`}
                      className={`border rounded-lg p-3 transition-colors ${
                        bulkSelection.includes(school.school_name)
                          ? 'border-indigo-300 bg-indigo-50'
                          : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={bulkSelection.includes(school.school_name)}
                          onChange={() => toggleBulkSelection(school.school_name)}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold text-slate-700">{school.school_name}</p>
                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{school.priority_level}</span>
                          </div>
                          <p className="text-xs text-slate-500 mb-1">{school.region} · Score {school.priority_score}</p>
                          <p className="text-xs text-slate-600">{(school.recommendations ?? [])[0]}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Impact simulation</p>

              {/* Preset scenarios */}
              <div className="flex flex-wrap gap-2 mb-3">
                <button onClick={() => runPresetSimulation('math50')} className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors">
                  Train 50 teachers (Math)
                </button>
                <button onClick={() => runPresetSimulation('region10')} className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors">
                  10% uplift (1 region)
                </button>
                <button onClick={() => runPresetSimulation('full')} className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors">
                  Full deployment (100 teachers)
                </button>
              </div>

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
                <button onClick={saveScenario} className="text-xs text-indigo-600 hover:underline mb-3 block">
                  Save this scenario
                </button>
              )}

              {simulation && (
                <div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-slate-50 rounded-lg p-3 group relative">
                      <div className="flex items-center gap-1 mb-1">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">Baseline</p>
                        <span className="cursor-help">
                          <svg className="w-3 h-3 text-slate-400 hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="absolute left-0 top-full mt-1 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 w-44">
                            Current average competency score across all teachers before training.
                          </div>
                        </span>
                      </div>
                      <p className="text-lg font-bold text-slate-800">{simulation.baseline_average_competency}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 group relative">
                      <div className="flex items-center gap-1 mb-1">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">Projected</p>
                        <span className="cursor-help">
                          <svg className="w-3 h-3 text-slate-400 hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="absolute left-0 top-full mt-1 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 w-44">
                            Expected competency score after training the specified number of teachers.
                          </div>
                        </span>
                      </div>
                      <p className="text-lg font-bold text-slate-800">{simulation.projected_average_competency}</p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 group relative">
                      <div className="flex items-center gap-1 mb-1">
                        <p className="text-[10px] uppercase tracking-wide text-indigo-500">Improvement</p>
                        <span className="cursor-help">
                          <svg className="w-3 h-3 text-indigo-400 hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="absolute right-0 top-full mt-1 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 w-44">
                            The difference between projected and baseline scores. Higher is better.
                          </div>
                        </span>
                      </div>
                      <p className="text-lg font-bold text-indigo-700">+{simulation.improvement}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <span>Simulated teachers: {simulation.teachers_simulated}</span>
                    <span className="cursor-help relative group">
                      <svg className="w-3 h-3 text-slate-400 hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="absolute left-0 top-full mt-1 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 w-52">
                        Number of teachers included in this simulation who would receive training.
                      </div>
                    </span>
                  </div>
                </div>
              )}

              {/* Saved scenarios */}
              {savedScenarios.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Saved scenarios</p>
                  <div className="space-y-2">
                    {savedScenarios.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-xs font-medium text-slate-700">{s.name}</p>
                          <p className="text-[10px] text-slate-400">{s.trainingCount} teachers · +{s.uplift}% · {s.result.improvement} improvement</p>
                        </div>
                        <button
                          onClick={() => {
                            setTrainingCount(s.trainingCount)
                            setUplift(s.uplift)
                            setSimulation(s.result)
                          }}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Load
                        </button>
                      </div>
                    ))}
                  </div>
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
