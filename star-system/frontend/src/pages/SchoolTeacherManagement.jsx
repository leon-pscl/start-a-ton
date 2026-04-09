import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getSchools } from '../lib/api'
import { REGIONS } from '../lib/constants'
import { EmptyState, PageHeader, Select, Spinner } from '../components/shared'

function schoolId(school) {
  return `${school.region}::${school.city || ''}::${school.division || ''}::${school.school_name}`
}

function subjectSummary(values) {
  if (!values || values.length === 0) return 'Not available'
  return values.join(', ')
}

function educationLabel(teacher) {
  const program = teacher.degree_program || 'Education not recorded'
  return teacher.graduation_year ? `${program} (${teacher.graduation_year} graduated)` : program
}

function scoreClass(score) {
  if (score >= 90) return 'bg-green-100 text-green-700 border-green-200'
  if (score >= 70) return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (score >= 50) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-red-100 text-red-700 border-red-200'
}

function scoreLabel(score) {
  if (score >= 90) return 'Very aligned'
  if (score >= 70) return 'Aligned'
  if (score >= 50) return 'Partial'
  return 'Needs review'
}

function divisionFeedback(teacher) {
  const action = teacher.recommended_action || 'Upskilling'
  const modules = teacher.recommended_modules || []
  if (action === 'Certification') {
    return 'Division feedback: prioritize certification support and assign mentoring for this cycle.'
  }
  if (action === 'Reassignment') {
    return 'Division feedback: review class load and align subject assignments with specialization.'
  }
  if (action === 'Maintain') {
    return 'Division feedback: maintain current deployment and consider advanced coaching role.'
  }
  if (modules.length > 0) {
    return `Division feedback: prioritize upskilling in ${modules[0]}.`
  }
  return 'Division feedback: prioritize targeted upskilling support this term.'
}

export default function SchoolTeacherManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialRegion = searchParams.get('region') || ''
  const initialSchool = searchParams.get('school') || ''

  const [region, setRegion] = useState(initialRegion)
  const [schoolQuery, setSchoolQuery] = useState(initialSchool)
  const [schools, setSchools] = useState([])
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [uplift, setUplift] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setSearchParams(
      Object.fromEntries(
        Object.entries({ region, school: schoolQuery }).filter(([, value]) => value)
      )
    )
  }, [region, schoolQuery, setSearchParams])

  useEffect(() => {
    setLoading(true)
    setError('')
    getSchools({ region })
      .then((rows) => {
        const filtered = schoolQuery
          ? rows.filter((school) =>
              (school.school_name || '').toLowerCase().includes(schoolQuery.toLowerCase())
            )
          : rows

        setSchools(filtered)
        if (filtered.length > 0) {
          setSelectedSchoolId((current) => current || schoolId(filtered[0]))
        } else {
          setSelectedSchoolId('')
        }
      })
      .catch((e) => {
        setSchools([])
        setSelectedSchoolId('')
        setError(e?.message || 'Failed to load school teacher management data')
      })
      .finally(() => setLoading(false))
  }, [region, schoolQuery])

  const selectedSchool = useMemo(
    () => schools.find((school) => schoolId(school) === selectedSchoolId) || null,
    [schools, selectedSchoolId]
  )

  const projectedTeachers = (selectedSchool?.teachers || []).map((teacher) => {
    const current = teacher.competency_score || 0
    const projected = Math.min(100, current + Number(uplift || 0))
    return {
      ...teacher,
      projected_score: projected,
    }
  }).sort((a, b) => (a.school_fit_score ?? a.competency_score ?? 0) - (b.school_fit_score ?? b.competency_score ?? 0))

  const selectedCount = selectedSchool?.total_teachers || 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="School teacher management"
        subtitle="Understand each teacher profile, score alignment, and decide school-level support actions"
        actions={
          <div className="flex gap-2">
            <Select
              value={region}
              onChange={setRegion}
              options={REGIONS}
              placeholder="All regions"
              className="w-44 text-sm"
            />
            <input
              value={schoolQuery}
              onChange={(e) => setSchoolQuery(e.target.value)}
              className="input w-56 text-sm"
              placeholder="Filter school name"
            />
          </div>
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="card border-l-4 border-red-500">
          <p className="text-sm text-slate-700">{error}</p>
          <p className="text-xs text-slate-500 mt-2">Check backend on port 8000 and refresh.</p>
        </div>
      ) : schools.length === 0 ? (
        <EmptyState message="No schools found for current filters" />
      ) : (
        <>
          <div className="card mb-5 bg-slate-50 border border-slate-200">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-semibold text-slate-700 mb-1">How to use this view</p>
                <p className="text-slate-600">1) Choose a school. 2) Review cards from lowest match score first. 3) Use feedback and module suggestions to plan support.</p>
              </div>
              <div>
                <p className="font-semibold text-slate-700 mb-1">Match score legend</p>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">90-99 Very aligned</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">70-89 Aligned</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">50-69 Partial</span>
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">0-49 Needs review</span>
                </div>
              </div>
              <div>
                <p className="font-semibold text-slate-700 mb-1">Interpretation note</p>
                <p className="text-slate-600">A teacher can still be aligned when they handle their specialization together with related subjects.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-2 card p-3 overflow-auto max-h-[75vh]">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Choose a school</p>
              <div className="space-y-2">
                {schools.map((school) => {
                  const id = schoolId(school)
                  const active = selectedSchoolId === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedSchoolId(id)}
                      className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${active ? 'bg-star-50 border-star-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                    >
                      <p className="text-sm font-semibold text-slate-700">{school.school_name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{school.city || 'Unknown city'} · {school.division || 'No division set'}</p>
                      <div className="mt-2 flex items-center gap-2 text-[11px]">
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">Need support: {school.teachers_needing_training ?? 0}</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Coverage: {school.training_coverage_pct ?? 0}%</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="xl:col-span-3">
              {!selectedSchool ? (
                <div className="card">
                  <p className="text-sm text-slate-500">Select a school to manage teacher profiles.</p>
                </div>
              ) : (
                <>
                  <div className="card mb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="font-display font-bold text-slate-800 text-lg">{selectedSchool.school_name}</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {selectedSchool.region} · {selectedSchool.city || 'Unknown city'} · {selectedSchool.division || 'No division set'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">Teachers: {selectedCount}</span>
                        <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">Need support: {selectedSchool.teachers_needing_training ?? 0}</span>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">Coverage: {selectedSchool.training_coverage_pct ?? 0}%</span>
                        <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">Priority score: {selectedSchool.priority_score ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">Projected uplift</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={uplift}
                          onChange={(e) => setUplift(Number(e.target.value || 0))}
                          className="input w-20 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projectedTeachers.map((teacher) => (
                      <div key={teacher.teacher_id} className="card border border-slate-100 shadow-sm">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{teacher.teacher_name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{educationLabel(teacher)}</p>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${
                              teacher.recommended_action === 'Certification'
                                ? 'bg-red-100 text-red-700'
                                : teacher.recommended_action === 'Reassignment'
                                ? 'bg-amber-100 text-amber-700'
                                : teacher.recommended_action === 'Maintain'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-indigo-100 text-indigo-700'
                            }`}>
                              {teacher.recommended_action}
                            </span>
                            <div className={`mt-2 inline-flex text-xs font-semibold px-2.5 py-1 rounded-full border ${scoreClass(teacher.school_fit_score ?? teacher.competency_score ?? 0)}`}>
                              Match {teacher.school_fit_score ?? teacher.competency_score ?? 0} · {scoreLabel(teacher.school_fit_score ?? teacher.competency_score ?? 0)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                          <div className="bg-slate-50 rounded p-2">Experience: <span className="font-medium">{teacher.years_experience ?? 'N/A'} years</span></div>
                          <div className="bg-slate-50 rounded p-2">Specialization: <span className="font-medium">{teacher.primary_specialization || 'N/A'}</span></div>
                          <div className="bg-indigo-50 border border-indigo-100 rounded p-2 col-span-2">
                            Projected score after support: <span className="font-semibold text-indigo-700">{teacher.projected_score}</span>
                          </div>
                        </div>

                        <div className="mb-3">
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">School-fit assessment</p>
                          <p className="text-xs text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                            {teacher.school_fit_summary || 'School-fit details unavailable.'}
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                            <div className="bg-slate-50 rounded p-2">Alignment: <span className="font-medium text-slate-700">{teacher.school_fit_breakdown?.specialization_alignment ?? 0}%</span></div>
                            <div className="bg-slate-50 rounded p-2">Experience factor: <span className="font-medium text-slate-700">{teacher.school_fit_breakdown?.experience ?? 0}%</span></div>
                          </div>
                        </div>

                        <div className="mb-3">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Specialization and subject load</p>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {(teacher.subject_specializations || []).map((item) => (
                              <span key={item} className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-full">
                                {item}
                              </span>
                            ))}
                            {(teacher.subject_specializations || []).length === 0 && (
                              <span className="text-[11px] text-slate-400">No specialization data yet</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">Currently handling: {subjectSummary(teacher.subjects_currently_teaching || [])}</p>
                        </div>

                        <div className="mb-3">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Trainings</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(teacher.training_history || []).length > 0 ? (
                              teacher.training_history.map((item, index) => (
                                <span key={`${item.module_name}-${index}`} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                                  {item.module_name}{item.year ? ` · ${item.year}` : ''}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-400">No STAR training records yet</span>
                            )}
                          </div>
                        </div>

                        <div className="mb-3">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Recommended modules</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(teacher.recommended_modules || []).map((module) => (
                              <span key={module} className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-full">
                                {module}
                              </span>
                            ))}
                            {(teacher.recommended_modules || []).length === 0 && (
                              <span className="text-[11px] text-slate-400">No module recommendation needed right now</span>
                            )}
                          </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          <p className="text-[11px] font-semibold text-amber-700 mb-1">Feedback from School Division</p>
                          <p className="text-xs text-slate-700">{divisionFeedback(teacher)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
