import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getSchools } from '../lib/api'
import { REGIONS } from '../lib/constants'
import { EmptyState, PageHeader, Select, Spinner } from '../components/shared'

function schoolKey(school) {
  return `${school.region}::${school.province || ''}::${school.city || ''}::${school.school_name}`
}

function formatNeedLine(school) {
  const teachers = school.teachers ?? []
  const mathUpskilling = teachers.filter((teacher) =>
    (teacher.recommended_modules ?? []).includes('Teaching Mathematics through Problem Solving')
  ).length
  const scienceAlignment = teachers.filter((teacher) =>
    (teacher.out_of_field_subjects ?? []).some((subject) =>
      ['General Science', 'Biology', 'Chemistry', 'Physics', 'Earth Science'].includes(subject)
    )
  ).length

  const parts = []
  if (mathUpskilling > 0) {
    parts.push(`${mathUpskilling} teacher${mathUpskilling !== 1 ? 's' : ''} need math upskilling`)
  }
  if (scienceAlignment > 0) {
    parts.push(`${scienceAlignment} teacher${scienceAlignment !== 1 ? 's' : ''} require science specialization alignment`)
  }
  return parts
}

export default function SchoolsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialRegion = searchParams.get('region') || ''
  const [region, setRegion] = useState('')
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSchoolId, setSelectedSchoolId] = useState('')

  useEffect(() => {
    if (initialRegion && REGIONS.includes(initialRegion)) {
      setRegion(initialRegion)
    }
  }, [initialRegion])

  useEffect(() => {
    if (region) {
      setSearchParams({ region })
      return
    }
    setSearchParams({})
  }, [region, setSearchParams])

  useEffect(() => {
    setLoading(true)
    setError('')
    getSchools(region)
      .then((data) => {
        setSchools(data)
        if (data.length === 0) {
          setSelectedSchoolId('')
          return
        }
        setSelectedSchoolId((current) => current || schoolKey(data[0]))
      })
      .catch((e) => {
        setSchools([])
        setSelectedSchoolId('')
        setError(e?.message || 'Failed to load schools')
      })
      .finally(() => setLoading(false))
  }, [region])

  const selectedSchool = useMemo(
    () => schools.find((school) => schoolKey(school) === selectedSchoolId) || null,
    [schools, selectedSchoolId]
  )

  const critical = schools.filter((school) => school.priority_level === 'Critical').length
  const moderate = schools.filter((school) => school.priority_level === 'Moderate').length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="School priorities"
        subtitle="Region -> school -> teacher drilldown with actionable recommendations"
        actions={
          <Select
            value={region}
            onChange={setRegion}
            options={REGIONS}
            placeholder="All regions"
            className="w-44 text-sm"
          />
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Schools analyzed</p>
          <p className="text-2xl font-display font-bold text-slate-800">{schools.length}</p>
        </div>
        <div className="card border-l-4 border-red-500">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Critical</p>
          <p className="text-2xl font-display font-bold text-red-700">{critical}</p>
        </div>
        <div className="card border-l-4 border-amber-500">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Moderate</p>
          <p className="text-2xl font-display font-bold text-amber-700">{moderate}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Top urgency score</p>
          <p className="text-2xl font-display font-bold text-indigo-700">{schools[0]?.priority_score ?? 0}</p>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="card border-l-4 border-red-500">
          <p className="text-sm text-slate-700">{error}</p>
          <p className="text-xs text-slate-500 mt-2">Check that backend is running on port 8000, then refresh.</p>
        </div>
      ) : schools.length === 0 ? (
        <EmptyState message="No schools found for current filters" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3 card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">School</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Priority</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Teachers</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Student ratio</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Out-of-field</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => {
                  const id = schoolKey(school)
                  return (
                    <tr
                      key={id}
                      onClick={() => setSelectedSchoolId(id)}
                      className={`border-b border-slate-50 cursor-pointer transition-colors ${selectedSchoolId === id ? 'bg-star-50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-medium">{school.school_name}</div>
                        <div className="text-[11px] text-slate-400">{school.region}{school.province ? ` · ${school.province}` : ''}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${school.priority_level === 'Critical' ? 'bg-red-100 text-red-700' : school.priority_level === 'Moderate' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {school.priority_level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{school.total_teachers}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{school.avg_student_ratio}:1</td>
                      <td className="px-4 py-3 text-right text-slate-600">{school.out_of_field_rate}%</td>
                      <td className="px-4 py-3 text-right text-slate-600">{school.training_coverage_pct}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="xl:col-span-2">
            {selectedSchool ? (
              <div className="card">
                <h2 className="font-display font-bold text-slate-800 text-lg">{selectedSchool.school_name}</h2>
                <p className="text-xs text-slate-400 mt-0.5 mb-4">{selectedSchool.region}{selectedSchool.city ? ` · ${selectedSchool.city}` : ''}</p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Avg competency</p>
                    <p className="text-lg font-bold text-slate-800">{selectedSchool.avg_competency_score}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Training recency gap</p>
                    <p className="text-lg font-bold text-slate-800">{selectedSchool.training_recency_gap_pct}%</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">School recommendations</p>
                  <div className="space-y-2">
                    {(selectedSchool.recommendations ?? []).map((item, index) => (
                      <p key={index} className="text-xs text-slate-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">{item}</p>
                    ))}
                    {formatNeedLine(selectedSchool).map((line) => (
                      <p key={line} className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">{line}</p>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recommended STAR modules</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedSchool.module_recommendations ?? []).map((module) => (
                      <span key={module} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{module}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Teacher-level actions</p>
                  <div className="max-h-72 overflow-auto border border-slate-100 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-2 py-2 font-semibold text-slate-500">Teacher</th>
                          <th className="text-right px-2 py-2 font-semibold text-slate-500">Score</th>
                          <th className="text-right px-2 py-2 font-semibold text-slate-500">Mismatch</th>
                          <th className="text-left px-2 py-2 font-semibold text-slate-500">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedSchool.teachers ?? []).map((teacher) => (
                          <tr key={teacher.teacher_id} className="border-t border-slate-100">
                            <td className="px-2 py-2 text-slate-700">{teacher.teacher_name}</td>
                            <td className="px-2 py-2 text-right text-slate-600">{teacher.competency_score}</td>
                            <td className="px-2 py-2 text-right text-slate-600">{teacher.is_out_of_field ? 'Yes' : 'No'}</td>
                            <td className="px-2 py-2 text-slate-600">{teacher.recommended_action || 'Upskilling'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card">
                <p className="text-sm text-slate-500">Select a school from the table to see drilldown details.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
