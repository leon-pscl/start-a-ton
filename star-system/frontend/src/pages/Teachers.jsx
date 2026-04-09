/**
 * Teachers Page Component
 *
 * Displays a searchable, filterable table of all teachers in the system.
 * Features:
 * - Search by name or school
 * - Filter by region, subject, and training status
 * - Pagination (50 records per page)
 * - Visual indicators for training status and data source
 *
 * Data is fetched from the teachers API endpoint.
 */

import { useEffect, useState } from 'react'
import { getTeachers, getTeacher } from '../lib/api'
import { REGIONS, SUBJECTS } from '../lib/constants'
import { Spinner, EmptyState, PageHeader, Select, HoverTags } from '../components/shared'

// Number of records per page
const PAGE_SIZE = 50

// ---------------------------------------------------------------------------
// Main Teachers Component
// ---------------------------------------------------------------------------

export default function TeachersPage() {
  // State for API data and filters
  const [data, setData] = useState({ total: 0, pages: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter state
  const [region, setRegion] = useState('')     // Selected region filter
  const [subject, setSubject] = useState('')   // Selected subject filter
  const [trained, setTrained] = useState('')   // Training status filter (yes/no)
  const [search, setSearch] = useState('')     // Text search filter
  const [page, setPage] = useState(0)         // Current page number
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  /**
   * Fetch teachers from API with current filters.
   * Called when filters change or pagination is used.
   */
  const load = (pageIndex = 0) => {
    setLoading(true)
    setError('')
    const params = { limit: PAGE_SIZE, offset: pageIndex * PAGE_SIZE }
    if (region) params.region = region
    if (subject) params.subject = subject
    if (trained !== '') params.trained = trained === 'yes'
    if (search) params.search = search
    getTeachers(params)
      .then(res => { setData(res); setPage(pageIndex) })
      .catch((e) => {
        setData({ total: 0, pages: 0, results: [] })
        setError(e?.message || 'Failed to load teacher records')
      })
      .finally(() => setLoading(false))
  }

  const openTeacher = (teacherId) => {
    setSelectedId(teacherId)
    setDetailLoading(true)
    getTeacher(teacherId)
      .then(setDetail)
      .finally(() => setDetailLoading(false))
  }

  // Reload data when filters change
  useEffect(() => { load(0) }, [region, subject, trained])

  // Get teachers for display (apply local text search)
  const teachers = data.results ?? []

  // Pagination controls
  const hasPrev = page > 0
  const hasNext = page + 1 < data.pages

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Teacher records"
        subtitle={`${data.total} total records`}
      />

      {/* ----------------------------------------------------------------------- */}
      {/* Filters Row                                                            */}
      {/* ----------------------------------------------------------------------- */}
      <div className="card mb-5 flex flex-wrap gap-3 items-center">
        {/* Text search */}
        <input
          type="text"
          placeholder="Search by name or school..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(0)}
          className="input flex-1 min-w-48 text-sm"
        />
        {/* Region filter */}
        <Select
          value={region}
          onChange={v => { setRegion(v) }}
          options={REGIONS}
          placeholder="All regions"
          className="w-40 text-sm"
        />
        {/* Subject filter */}
        <Select
          value={subject}
          onChange={v => { setSubject(v) }}
          options={SUBJECTS}
          placeholder="All subjects"
          className="w-40 text-sm"
        />
        {/* Training status filter */}
        <Select
          value={trained}
          onChange={v => { setTrained(v) }}
          options={[
            { value: 'yes', label: 'Trained' },
            { value: 'no',  label: 'Not trained' },
          ]}
          placeholder="Any training"
          className="w-36 text-sm"
        />
        <button onClick={() => load(0)} className="btn-primary text-xs">Apply</button>
      </div>

      {/* ----------------------------------------------------------------------- */}
      {/* Teachers Table                                                          */}
      {/* ----------------------------------------------------------------------- */}
      {loading ? <Spinner /> : error ? (
        <div className="card border-l-4 border-red-500">
          <p className="text-sm text-slate-700">{error}</p>
          <p className="text-xs text-slate-500 mt-2">Check that backend is running on port 8000, then refresh.</p>
        </div>
      ) : teachers.length === 0 ? (
        <EmptyState message="No teachers match the current filters" />
      ) : (
        <div className="space-y-4">
          {detail && (
            <div className="card border-l-4 border-indigo-500">
              {detailLoading ? (
                <Spinner />
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="font-display font-bold text-slate-800 text-lg">{detail.full_name}</h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {detail.region} · {detail.school_name || 'Unknown school'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${
                        detail.competency_level === 'high'
                          ? 'bg-green-100 text-green-700'
                          : detail.competency_level === 'medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {detail.competency_level} competency
                      </span>
                      {detail.is_out_of_field && (
                        <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-red-50 text-red-700">
                          out-of-field
                        </span>
                      )}
                      <button onClick={() => { setSelectedId(''); setDetail(null) }} className="text-xs text-slate-400 hover:text-slate-600">
                        Dismiss
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Competency score</p>
                      <p className="text-lg font-bold text-slate-800">{detail.competency_score}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Primary specialization</p>
                      <p className="text-sm font-semibold text-slate-800">{detail.primary_specialization || '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Last training</p>
                      <p className="text-sm font-semibold text-slate-800">{detail.last_training_year || 'No record'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Relocation preference</p>
                      <p className="text-sm font-semibold text-slate-800">{detail.preferred_relocation_type || 'same region'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Subjects taught</p>
                      <HoverTags items={detail.subjects_currently_teaching ?? []} color="amber" max={4} label="Subjects taught" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Training history</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(detail.trainings ?? []).length > 0 ? detail.trainings.map(tr => (
                          <span key={`${tr.module_name}-${tr.year}`} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg">
                            {tr.module_name} {tr.year ? `· ${tr.year}` : ''}
                          </span>
                        )) : <span className="text-xs text-slate-400">No STAR training on record</span>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-100 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Identified gaps</p>
                      <ul className="space-y-2">
                        {(detail.identified_gaps ?? []).length > 0 ? detail.identified_gaps.map((gap, idx) => (
                          <li key={idx} className="text-xs text-slate-600 flex gap-2">
                            <span className="text-red-400">•</span>
                            <span>{gap}</span>
                          </li>
                        )) : <li className="text-xs text-slate-400">No major gaps flagged</li>}
                      </ul>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recommendations</p>
                      <ul className="space-y-2">
                        {(detail.recommendations ?? []).map((rec, idx) => (
                          <li key={idx} className="text-xs text-slate-600 flex gap-2">
                            <span className="text-indigo-400">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(detail.recommended_modules ?? []).map(mod => (
                          <span key={mod} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                            {mod}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        <div className="card p-0 overflow-x-auto">
          <table className="min-w-[1320px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Name', 'Region', 'Province', 'City', 'School', 'Specialization', 'Teaching', 'Degree / Primary', 'Competency', 'Position', 'Training', 'Flags'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teachers.map(t => (
                <tr
                  key={t.id}
                  onClick={() => openTeacher(t.id)}
                  className={`border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${selectedId === t.id ? 'bg-star-50' : ''}`}
                >
                  {/* Name */}
                  <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{t.full_name}</td>
                  {/* Region */}
                  <td className="px-4 py-3 text-slate-500 text-xs">{t.region}</td>
                  {/* Province */}
                  <td className="px-4 py-3 text-slate-500 text-xs">{t.province ?? '—'}</td>
                  {/* City */}
                  <td className="px-4 py-3 text-slate-500 text-xs">{t.city ?? '—'}</td>
                  {/* School (truncated) */}
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-36 truncate">{t.school_name ?? '—'}</td>
                  {/* Subject specializations (as tags, hoverable) */}
                  <td className="px-4 py-3">
                    <HoverTags items={t.subject_specializations ?? []} color="star" max={2} label="Specializations" />
                  </td>
                  {/* Subjects currently teaching (hoverable) */}
                  <td className="px-4 py-3">
                    <HoverTags items={t.subjects_currently_teaching ?? []} color="amber" max={2} label="Currently Teaching" />
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-36 truncate">
                    <div>{t.degree_program ?? '—'}</div>
                    <div className="text-slate-400">{t.primary_specialization ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      t.competency_level === 'high'
                        ? 'bg-green-100 text-green-700'
                        : t.competency_level === 'medium'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {t.competency_score ?? '—'}
                    </span>
                  </td>
                  {/* Position */}
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{t.position ?? '—'}</td>
                  {/* Training status */}
                  <td className="px-4 py-3">
                    {t.is_trained ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {t.training_count} module{t.training_count !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">
                        None
                      </span>
                    )}
                  </td>
                  {/* Data source (color-coded) */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {t.is_out_of_field && (
                        <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full">out-of-field</span>
                      )}
                      {(t.auto_tags ?? []).includes('missing-training-data') && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">no training</span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        t.source === 'self-registry'
                          ? 'bg-teal-50 text-teal-700'
                          : t.source === 'sf7'
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {t.source}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* --------------------------------------------------------------------- */}
          {/* Pagination                                                            */}
          {/* --------------------------------------------------------------------- */}
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.total)} of {data.total} records
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => load(page - 1)}
                disabled={!hasPrev}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-xs text-slate-500 flex items-center px-2">
                Page {page + 1} of {data.pages}
              </span>
              <button
                onClick={() => load(page + 1)}
                disabled={!hasNext}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  )
}