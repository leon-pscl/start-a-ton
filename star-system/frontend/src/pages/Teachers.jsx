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
import { getTeachers } from '../lib/api'
import { REGIONS, SUBJECTS } from '../lib/constants'
import { Spinner, EmptyState, PageHeader, Select } from '../components/shared'

// Number of records per page
const PAGE_SIZE = 50

// ---------------------------------------------------------------------------
// Main Teachers Component
// ---------------------------------------------------------------------------

export default function TeachersPage() {
  // State for API data and filters
  const [data, setData] = useState({ total: 0, pages: 0, results: [] })
  const [loading, setLoading] = useState(true)

  // Filter state
  const [region, setRegion] = useState('')     // Selected region filter
  const [subject, setSubject] = useState('')   // Selected subject filter
  const [trained, setTrained] = useState('')   // Training status filter (yes/no)
  const [search, setSearch] = useState('')     // Text search filter
  const [page, setPage] = useState(0)         // Current page number

  /**
   * Fetch teachers from API with current filters.
   * Called when filters change or pagination is used.
   */
  const load = (pageIndex = 0) => {
    setLoading(true)
    const params = { limit: PAGE_SIZE, offset: pageIndex * PAGE_SIZE }
    if (region) params.region = region
    if (subject) params.subject = subject
    if (trained !== '') params.trained = trained === 'yes'
    getTeachers(params)
      .then(res => { setData(res); setPage(pageIndex) })
      .finally(() => setLoading(false))
  }

  // Reload data when filters change
  useEffect(() => { load(0) }, [region, subject, trained])

  // Get teachers for display (apply local text search)
  const teachers = data.results ?? []

  // Filter by search text (name or school)
  const visible = search
    ? teachers.filter(t =>
        t.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (t.school_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : teachers

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
                  {/* Name */}
                  <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{t.full_name}</td>
                  {/* Region */}
                  <td className="px-4 py-3 text-slate-500 text-xs">{t.region}</td>
                  {/* School (truncated) */}
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-36 truncate">{t.school_name ?? '—'}</td>
                  {/* Subject specializations (as tags) */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(t.subject_specializations ?? []).slice(0, 2).map(s => (
                        <span key={s} className="text-xs bg-star-50 text-star-700 px-2 py-0.5 rounded">{s}</span>
                      ))}
                      {/* Show count if more than 2 subjects */}
                      {(t.subject_specializations ?? []).length > 2 && (
                        <span className="text-xs text-slate-400">
                          +{t.subject_specializations.length - 2}
                        </span>
                      )}
                    </div>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      t.source === 'self-registry'
                        ? 'bg-teal-50 text-teal-700'      // Self-registered (high confidence)
                        : t.source === 'sf7'
                        ? 'bg-purple-50 text-purple-700'   // SF7 import
                        : 'bg-slate-100 text-slate-500'    // Other source
                    }`}>
                      {t.source}
                    </span>
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
      )}
    </div>
  )
}