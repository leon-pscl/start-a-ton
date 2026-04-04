import { useEffect, useState } from 'react'
import { getTeachers } from '../../lib/api'
import { REGIONS, SUBJECTS } from '../../lib/constants'
import { Spinner, EmptyState, PageHeader, GapBadge, Select } from '../shared'

export default function TeachersPage() {
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState('')
  const [subject, setSubject] = useState('')
  const [trained, setTrained] = useState('')
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    const params = {}
    if (region) params.region = region
    if (subject) params.subject = subject
    if (trained !== '') params.trained = trained === 'yes'
    getTeachers(params).then(setTeachers).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [region, subject, trained])

  const visible = search
    ? teachers.filter(t =>
        t.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (t.school_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : teachers

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Teacher records"
        subtitle={`${teachers.length} records loaded`}
      />

      {/* Filters */}
      <div className="card mb-5 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name or school..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input flex-1 min-w-48 text-sm"
        />
        <Select
          value={region}
          onChange={setRegion}
          options={REGIONS}
          placeholder="All regions"
          className="w-40 text-sm"
        />
        <Select
          value={subject}
          onChange={setSubject}
          options={SUBJECTS}
          placeholder="All subjects"
          className="w-40 text-sm"
        />
        <Select
          value={trained}
          onChange={setTrained}
          options={[{ value: 'yes', label: 'Trained' }, { value: 'no', label: 'Not trained' }]}
          placeholder="Any training"
          className="w-36 text-sm"
        />
        <button onClick={load} className="btn-primary text-xs">Apply</button>
      </div>

      {/* Table */}
      {loading ? <Spinner /> : visible.length === 0 ? (
        <EmptyState message="No teachers match the current filters" />
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Name', 'Region', 'School', 'Specialization', 'Position', 'Training', 'Source'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(t => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{t.full_name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{t.region}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-36 truncate">{t.school_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(t.subject_specializations ?? []).slice(0, 2).map(s => (
                        <span key={s} className="text-xs bg-star-50 text-star-700 px-2 py-0.5 rounded">{s}</span>
                      ))}
                      {(t.subject_specializations ?? []).length > 2 && (
                        <span className="text-xs text-slate-400">+{t.subject_specializations.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{t.position ?? '—'}</td>
                  <td className="px-4 py-3">
                    {t.is_trained ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {t.training_count} module{t.training_count !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      t.source === 'self-registry'
                        ? 'bg-teal-50 text-teal-700'
                        : t.source === 'sf7'
                        ? 'bg-purple-50 text-purple-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {t.source}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
            Showing {visible.length} of {teachers.length} records
          </div>
        </div>
      )}
    </div>
  )
}
