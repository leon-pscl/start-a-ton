import { useEffect, useMemo, useState } from 'react'
import { getDivisions } from '../lib/api'
import { REGIONS } from '../lib/constants'
import { EmptyState, PageHeader, Select, Spinner } from '../components/shared'

function divisionKey(item) {
  return `${item.region}::${item.city || ''}::${item.division}`
}

export default function DivisionsPage() {
  const [region, setRegion] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedKey, setSelectedKey] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    getDivisions({ region, city: cityFilter })
      .then((data) => {
        setRows(data)
        if (data.length > 0) {
          setSelectedKey((current) => current || divisionKey(data[0]))
        } else {
          setSelectedKey('')
        }
      })
      .catch((e) => {
        setRows([])
        setSelectedKey('')
        setError(e?.message || 'Failed to load division office analytics')
      })
      .finally(() => setLoading(false))
  }, [region, cityFilter])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      return (
        (row.division || '').toLowerCase().includes(q)
        || (row.city || '').toLowerCase().includes(q)
        || (row.region || '').toLowerCase().includes(q)
      )
    })
  }, [rows, search])

  const selected = filteredRows.find((row) => divisionKey(row) === selectedKey) || filteredRows[0] || null

  const totalNeed = filteredRows.reduce((acc, row) => acc + (row.teachers_needing_training || 0), 0)
  const totalTeachers = filteredRows.reduce((acc, row) => acc + (row.total_teachers || 0), 0)
  const totalSchools = filteredRows.reduce((acc, row) => acc + (row.school_count || 0), 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Division offices"
        subtitle="School Division Office view: training demand, school rollups, and teacher action profiles"
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
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="input w-40 text-sm"
              placeholder="City filter"
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Division offices</p>
          <p className="text-2xl font-display font-bold text-slate-800">{filteredRows.length}</p>
        </div>
        <div className="card border-l-4 border-indigo-500">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Teachers needing training</p>
          <p className="text-2xl font-display font-bold text-indigo-700">{totalNeed}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Teachers covered</p>
          <p className="text-2xl font-display font-bold text-slate-800">{totalTeachers}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Schools in scope</p>
          <p className="text-2xl font-display font-bold text-slate-800">{totalSchools}</p>
        </div>
      </div>

      <div className="card mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input text-sm"
          placeholder="Search division, city, or region"
        />
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="card border-l-4 border-red-500">
          <p className="text-sm text-slate-700">{error}</p>
          <p className="text-xs text-slate-500 mt-2">Check backend on port 8000, then refresh.</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <EmptyState message="No division office records found for current filters" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3 card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Division office</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Need training</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Teachers</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Schools</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const key = divisionKey(row)
                  return (
                    <tr
                      key={key}
                      onClick={() => setSelectedKey(key)}
                      className={`border-b border-slate-50 cursor-pointer transition-colors ${selectedKey === key ? 'bg-star-50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-medium">{row.division}</div>
                        <div className="text-[11px] text-slate-400">{row.city || 'Unknown city'} · {row.region}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-indigo-700 font-semibold">{row.teachers_needing_training}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.total_teachers}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.school_count}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.training_coverage_pct}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="xl:col-span-2">
            {selected ? (
              <div className="card">
                <h2 className="font-display font-bold text-slate-800 text-lg">{selected.division}</h2>
                <p className="text-xs text-slate-400 mt-0.5 mb-4">{selected.city || 'Unknown city'} · {selected.region}</p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Need training</p>
                    <p className="text-lg font-bold text-indigo-700">{selected.teachers_needing_training}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Out-of-field rate</p>
                    <p className="text-lg font-bold text-slate-800">{selected.out_of_field_rate}%</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Action summary</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 rounded px-2 py-2">Upskilling: <span className="font-semibold">{selected.action_summary?.upskilling ?? 0}</span></div>
                    <div className="bg-slate-50 rounded px-2 py-2">Certification: <span className="font-semibold">{selected.action_summary?.certification ?? 0}</span></div>
                    <div className="bg-slate-50 rounded px-2 py-2">Reassignment: <span className="font-semibold">{selected.action_summary?.reassignment ?? 0}</span></div>
                    <div className="bg-slate-50 rounded px-2 py-2">Maintain: <span className="font-semibold">{selected.action_summary?.maintain ?? 0}</span></div>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Top training module needs</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected.top_module_needs ?? []).map((item) => (
                      <span key={`${item.module}-${item.count}`} className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-full">
                        {item.module} ({item.count})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Schools needing support</p>
                  <div className="max-h-40 overflow-auto border border-slate-100 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-2 py-2 font-semibold text-slate-500">School</th>
                          <th className="text-right px-2 py-2 font-semibold text-slate-500">Need training</th>
                          <th className="text-right px-2 py-2 font-semibold text-slate-500">Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selected.schools ?? []).slice(0, 12).map((school) => (
                          <tr key={`${school.region}-${school.school_name}`} className="border-t border-slate-100">
                            <td className="px-2 py-2 text-slate-700">{school.school_name}</td>
                            <td className="px-2 py-2 text-right text-slate-600">{school.teachers_needing_training ?? 0}</td>
                            <td className="px-2 py-2 text-right text-slate-600">{school.priority_level}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Teacher profiles (highest need)</p>
                  <div className="max-h-56 overflow-auto border border-slate-100 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-2 py-2 font-semibold text-slate-500">Teacher</th>
                          <th className="text-right px-2 py-2 font-semibold text-slate-500">Score</th>
                          <th className="text-left px-2 py-2 font-semibold text-slate-500">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selected.teacher_profiles ?? []).slice(0, 20).map((teacher) => (
                          <tr key={teacher.teacher_id} className="border-t border-slate-100">
                            <td className="px-2 py-2 text-slate-700">{teacher.teacher_name}</td>
                            <td className="px-2 py-2 text-right text-slate-600">{teacher.competency_score}</td>
                            <td className="px-2 py-2 text-slate-600">{teacher.recommended_action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card">
                <p className="text-sm text-slate-500">Select a division office to inspect schools and teacher profiles.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
