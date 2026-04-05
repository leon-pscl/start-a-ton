/**
 * Import Page Component
 *
 * Provides an interface for bulk data imports from external sources.
 * Supports two file types:
 * 1. SF7/BEIS exports: DepEd School Form 7 teacher data
 * 2. STAR training logs: Training attendance from partner universities
 *
 * Features:
 * - File upload with drag-and-drop UI
 * - Import result summary (parsed, imported, flagged rows)
 * - Import history log
 * - Column mapping guide for expected formats
 *
 * Files are processed by the backend importer which:
 * - Fuzzy-matches column names to expected fields
 * - Normalizes region/subject names
 * - Deduplicates teachers by name+region
 */

import { useEffect, useRef, useState } from 'react'
import { uploadFile, getImportLogs } from '../lib/api'
import { PageHeader, Spinner } from '../components/shared'

// ---------------------------------------------------------------------------
// Source Type Configuration
// ---------------------------------------------------------------------------

/**
 * Supported import source types with descriptions.
 */
const SOURCE_TYPES = [
  { value: 'sf7', label: 'SF7 / BEIS export', desc: 'DepEd School Form 7 CSV or Excel export' },
  { value: 'star-log', label: 'STAR training log', desc: 'DOST-SEI or TEI training attendance Excel' },
]

// ---------------------------------------------------------------------------
// Main Import Component
// ---------------------------------------------------------------------------

export default function ImportPage() {
  // State
  const [sourceType, setSourceType] = useState('sf7')  // Selected source type
  const [file, setFile] = useState(null)               // Selected file
  const [result, setResult] = useState(null)           // Import result
  const [error, setError] = useState('')               // Error message
  const [loading, setLoading] = useState(false)        // Upload in progress
  const [logs, setLogs] = useState([])                 // Import history
  const [logsLoading, setLogsLoading] = useState(true)  // Loading history
  const fileRef = useRef()                              // File input ref

  /**
   * Load import history from API.
   */
  const loadLogs = () => {
    setLogsLoading(true)
    getImportLogs().then(setLogs).finally(() => setLogsLoading(false))
  }

  // Load history on mount
  useEffect(() => { loadLogs() }, [])

  /**
   * Handle file upload.
   */
  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await uploadFile(file, sourceType)
      setResult(res)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''  // Clear file input
      loadLogs()  // Refresh history
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Import data"
        subtitle="Upload SF7 exports or STAR training logs to the system"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ----------------------------------------------------------------------- */}
        {/* Upload Panel                                                            */}
        {/* ----------------------------------------------------------------------- */}
        <div className="card flex flex-col gap-5">
          {/* Source type selector */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Source type
            </p>
            <div className="flex flex-col gap-2">
              {SOURCE_TYPES.map(s => (
                <label key={s.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    sourceType === s.value
                      ? 'border-star-400 bg-star-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="sourceType"
                    value={s.value}
                    checked={sourceType === s.value}
                    onChange={() => setSourceType(s.value)}
                    className="mt-0.5 accent-star-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{s.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* File selector */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              File
            </p>
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                file ? 'border-star-300 bg-star-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={e => setFile(e.target.files[0] ?? null)}
              />
              {file ? (
                <div>
                  <p className="text-sm font-medium text-star-700">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {(file.size / 1024).toFixed(1)} KB · Click to change
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-500">Click to select a file</p>
                  <p className="text-xs text-slate-400 mt-1">.csv, .xlsx, .xls accepted</p>
                </div>
              )}
            </div>
          </div>

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="btn-primary w-full"
          >
            {loading ? 'Importing...' : 'Import file'}
          </button>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Success result */}
          {result && (
            <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-sm">
              <p className="font-medium text-green-800 mb-2">Import complete</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Parsed', val: result.rows_parsed },
                  { label: 'Imported', val: result.rows_imported },
                  { label: 'Flagged', val: result.rows_flagged },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-white rounded-lg py-2 border border-green-100">
                    <p className="text-lg font-bold text-slate-800">{val}</p>
                    <p className="text-xs text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* Import History                                                          */}
        {/* ----------------------------------------------------------------------- */}
        <div className="card">
          <p className="text-sm font-semibold text-slate-700 mb-4">Import history</p>
          {logsLoading ? <Spinner /> : logs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No imports yet</p>
          ) : (
            <div className="flex flex-col gap-3">
              {logs.slice(0, 12).map(log => (
                <div key={log.id} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-slate-700 truncate max-w-48">{log.filename}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {log.source_type} · {log.rows_imported} imported
                      {log.rows_flagged > 0 && (
                        <span className="text-amber-500"> · {log.rows_flagged} flagged</span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0 ml-2">
                    {log.source_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------------- */}
      {/* Column Mapping Guide                                                    */}
      {/* ----------------------------------------------------------------------- */}
      <div className="card mt-6">
        <p className="text-sm font-semibold text-slate-700 mb-3">Expected column names</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* SF7 columns */}
          <div>
            <p className="font-medium text-slate-600 mb-2">SF7 / BEIS export</p>
            <table className="w-full">
              <thead>
                <tr className="text-slate-400">
                  <th className="text-left pb-1">Accepted column names</th>
                  <th className="text-left pb-1">Maps to</th>
                </tr>
              </thead>
              <tbody className="text-slate-500">
                {[
                  ['Teacher Name, Name, Full Name', 'Full name'],
                  ['Region, Region Name', 'Region'],
                  ['Division, SDO', 'Division'],
                  ['School, School Name', 'School'],
                  ['Subject, Subject Area, Specialization', 'Specialization'],
                  ['Position, Designation', 'Position'],
                  ['INSET, TPD, Training', 'Training attended (yes/no)'],
                ].map(([raw, mapped]) => (
                  <tr key={raw} className="border-t border-slate-50">
                    <td className="py-1 font-mono text-slate-400 pr-4">{raw}</td>
                    <td className="py-1">{mapped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Training log columns */}
          <div>
            <p className="font-medium text-slate-600 mb-2">STAR training log</p>
            <table className="w-full">
              <thead>
                <tr className="text-slate-400">
                  <th className="text-left pb-1">Accepted column names</th>
                  <th className="text-left pb-1">Maps to</th>
                </tr>
              </thead>
              <tbody className="text-slate-500">
                {[
                  ['Participant Name, Name, Attendee', 'Full name'],
                  ['Region, Region Name', 'Region'],
                  ['Module, Module Name, Training', 'STAR module'],
                  ['University, Partner University, TEI', 'Partner university'],
                  ['Year, Date, SY, School Year', 'Year / school year'],
                  ['Division, SDO', 'Division'],
                  ['School, School Name', 'School'],
                ].map(([raw, mapped]) => (
                  <tr key={raw} className="border-t border-slate-50">
                    <td className="py-1 font-mono text-slate-400 pr-4">{raw}</td>
                    <td className="py-1">{mapped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}