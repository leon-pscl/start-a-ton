/**
 * Import Page Component
 *
 * Provides a 3-phase import workflow:
 * 1. Upload - Select source type and file
 * 2. Verify - Review and edit each record (single-page form)
 * 3. Confirm - Final summary and submission
 *
 * The verification step mirrors the Registration page fields, allowing users to
 * fill in fields not present in the source file.
 */

import { useEffect, useRef, useState } from 'react'
import { previewFile, confirmImport, getImportLogs } from '../lib/api'
import { PageHeader, Spinner, Select, CheckboxGroup } from '../components/shared'
import { REGIONS, SUBJECTS, STAR_MODULES, PROVINCES, CITIES } from '../lib/constants'

// ---------------------------------------------------------------------------
// Source Type Configuration
// ---------------------------------------------------------------------------

const SOURCE_TYPES = [
  { value: 'sf7', label: 'SF7 / BEIS export', desc: 'DepEd School Form 7 CSV or Excel export' },
  { value: 'star-log', label: 'STAR training log', desc: 'DOST-SEI or TEI training attendance Excel' },
]

// ---------------------------------------------------------------------------
// Form Constants
// ---------------------------------------------------------------------------

const POSITIONS = ['Teacher I', 'Teacher II', 'Teacher III', 'Master Teacher I', 'Master Teacher II']
const QUALIFICATIONS = ['BSEd', 'MEd', 'PhD', 'Other']
const GRADE_LEVELS = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'College']
const DISTANCES = ['<1hr', '1-3hrs', '3hrs+']
const FORMATS = ['face-to-face', 'blended', 'online']

// ---------------------------------------------------------------------------
// Initial Record Template
// ---------------------------------------------------------------------------

const EMPTY_RECORD = {
  full_name: '', region: '', province: '', city: '',
  division: '', school_name: '', school_type: 'public',
  position: '', years_experience: '', highest_qualification: '',
  subject_specializations: [], subjects_currently_teaching: [], grade_levels_taught: [],
  trainings_attended: [],
  low_confidence_subjects: [], unapplied_modules: [],
  distance_to_training: '', preferred_format: '',
}

// ---------------------------------------------------------------------------
// Main Import Component
// ---------------------------------------------------------------------------

export default function ImportPage() {
  // Phase state: 'upload' | 'verify' | 'confirm' | 'done'
  const [phase, setPhase] = useState('upload')

  // Upload state
  const [sourceType, setSourceType] = useState('sf7')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  // Verification state
  const [records, setRecords] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [editedRecords, setEditedRecords] = useState([])

  // Confirmation state
  const [result, setResult] = useState(null)
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(true)

  // Load import history
  const loadLogs = () => {
    setLogsLoading(true)
    getImportLogs().then(setLogs).finally(() => setLogsLoading(false))
  }
  useEffect(() => { loadLogs() }, [])

  // ---------------------------------------------------------------------------
  // Upload Phase Handlers
  // ---------------------------------------------------------------------------

  const handlePreview = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const res = await previewFile(file, sourceType)
      if (!res.records || res.records.length === 0) {
        setError('No records found in file. Please check the file format.')
        return
      }
      setRecords(res.records)
      setEditedRecords(res.records.map(r => ({ ...EMPTY_RECORD, ...r })))
      setCurrentIndex(0)
      setPhase('verify')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Verification Phase Handlers
  // ---------------------------------------------------------------------------

  const currentRecord = editedRecords[currentIndex] || EMPTY_RECORD

  const setField = (key, val) => {
    setEditedRecords(prev => {
      const next = [...prev]
      next[currentIndex] = { ...next[currentIndex], [key]: val }
      return next
    })
  }

  const nextRecord = () => {
    if (currentIndex < records.length - 1) {
      setCurrentIndex(i => i + 1)
      window.scrollTo(0, 0)
    }
  }
  const prevRecord = () => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1)
      window.scrollTo(0, 0)
    }
  }

  const skipRecord = () => {
    setEditedRecords(prev => {
      const next = [...prev]
      next[currentIndex] = { ...next[currentIndex], _skipped: true }
      return next
    })
    if (currentIndex < records.length - 1) {
      setCurrentIndex(i => i + 1)
      window.scrollTo(0, 0)
    } else {
      setPhase('confirm')
    }
  }

  // ---------------------------------------------------------------------------
  // Confirmation Phase Handlers
  // ---------------------------------------------------------------------------

  const handleConfirm = async () => {
    setLoading(true)
    setError('')
    try {
      const toImport = editedRecords.filter(r => !r._skipped)
      const res = await confirmImport(sourceType, toImport)
      setResult(res)
      setPhase('done')
      loadLogs()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setPhase('upload')
    setFile(null)
    setRecords([])
    setEditedRecords([])
    setCurrentIndex(0)
    setResult(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Done phase
  if (phase === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-star-50 to-slate-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-bold text-slate-800 mb-1">Import complete</h2>
          <p className="text-sm text-slate-500 mb-5">
            Successfully imported {result?.rows_imported || 0} records.
            {result?.rows_flagged > 0 && ` ${result.rows_flagged} records were flagged.`}
          </p>
          <button onClick={reset} className="btn-primary w-full">
            Import another file
          </button>
        </div>
      </div>
    )
  }

  // Verify phase
  if (phase === 'verify') {
    const totalRecords = records.length
    const record = currentRecord
    const skippedCount = editedRecords.filter(r => r._skipped).length

    const provinceOptions = record.region ? (PROVINCES[record.region] || []) : []
    const cityOptions = record.province ? (CITIES[record.province] || []) : []

    return (
      <div className="min-h-screen bg-gradient-to-br from-star-50 to-slate-100">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <h1 className="text-sm font-medium text-slate-500">
                Verifying {sourceType === 'sf7' ? 'SF7' : 'Training Log'}
              </h1>
              <p className="text-xs text-slate-400">
                Record {currentIndex + 1} of {totalRecords} {skippedCount > 0 && `(${skippedCount} skipped)`}
              </p>
            </div>
            <button
              onClick={() => setPhase('confirm')}
              className="btn-secondary text-xs"
            >
              Skip to confirm
            </button>
          </div>
          {/* Progress bar */}
          <div className="max-w-2xl mx-auto px-4 pb-3">
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-star-500 transition-all"
                style={{ width: `${((currentIndex + 1) / totalRecords) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Form content */}
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            {/* Extracted data indicator */}
            {record.full_name && (
              <div className="mb-4 p-3 bg-star-50 rounded-lg border border-star-100">
                <p className="text-xs text-star-700">
                  <span className="font-medium">Extracted:</span> {record.full_name}
                  {record.position && ` • ${record.position}`}
                  {record.school_name && ` • ${record.school_name}`}
                </p>
              </div>
            )}

            {/* Personal Information Section */}
            <Section title="Personal Information">
              <Field label="Full name *" highlight={!record.full_name}>
                <input
                  className="input"
                  placeholder="e.g. Maria Santos"
                  value={record.full_name || ''}
                  onChange={e => setField('full_name', e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Region *" highlight={!record.region}>
                  <Select
                    value={record.region || ''}
                    onChange={v => { setField('region', v); setField('province', ''); setField('city', ''); }}
                    options={REGIONS}
                    placeholder="Select region"
                  />
                </Field>
                <Field label="Province">
                  <Select
                    value={record.province || ''}
                    onChange={v => { setField('province', v); setField('city', ''); }}
                    options={provinceOptions}
                    placeholder={record.region ? 'Select province' : 'Select region first'}
                    disabled={!record.region}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City / Municipality">
                  <Select
                    value={record.city || ''}
                    onChange={v => setField('city', v)}
                    options={cityOptions}
                    placeholder={record.province ? 'Select city' : 'Select province first'}
                    disabled={!record.province}
                  />
                </Field>
                <Field label="School type">
                  <Select
                    value={record.school_type || 'public'}
                    onChange={v => setField('school_type', v)}
                    options={[{ value: 'public', label: 'Public' }, { value: 'private', label: 'Private' }]}
                  />
                </Field>
              </div>
              <Field label="Division / SDO">
                <input
                  className="input"
                  placeholder="e.g. Division of Cebu City"
                  value={record.division || ''}
                  onChange={e => setField('division', e.target.value)}
                />
              </Field>
              <Field label="School name">
                <input
                  className="input"
                  placeholder="e.g. Cebu National High School"
                  value={record.school_name || ''}
                  onChange={e => setField('school_name', e.target.value)}
                />
              </Field>
            </Section>

            {/* Teaching Profile Section */}
            <Section title="Teaching Profile">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Position">
                  <Select
                    value={record.position || ''}
                    onChange={v => setField('position', v)}
                    options={POSITIONS}
                    placeholder="Select position"
                  />
                </Field>
                <Field label="Years experience">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    className="input"
                    placeholder="e.g. 8"
                    value={record.years_experience || ''}
                    onChange={e => setField('years_experience', e.target.value ? parseInt(e.target.value) : null)}
                  />
                </Field>
              </div>
              <Field label="Highest qualification">
                <Select
                  value={record.highest_qualification || ''}
                  onChange={v => setField('highest_qualification', v)}
                  options={QUALIFICATIONS}
                  placeholder="Select qualification"
                />
              </Field>
              <CheckboxGroup
                label="Subject specializations"
                options={SUBJECTS}
                selected={record.subject_specializations || []}
                onChange={v => setField('subject_specializations', v)}
              />
              <CheckboxGroup
                label="Subjects currently teaching"
                options={SUBJECTS}
                selected={record.subjects_currently_teaching || []}
                onChange={v => setField('subjects_currently_teaching', v)}
              />
              <CheckboxGroup
                label="Grade levels taught"
                options={GRADE_LEVELS}
                selected={record.grade_levels_taught || []}
                onChange={v => setField('grade_levels_taught', v)}
              />
            </Section>

            {/* Training History Section */}
            <Section title="Training History">
              {sourceType === 'star-log' && record.module_detected && (
                <div className="bg-star-50 border border-star-100 rounded-lg p-3 mb-3">
                  <p className="text-xs text-star-700">
                    <span className="font-medium">Detected module:</span> {record.module_detected}
                  </p>
                </div>
              )}
              <CheckboxGroup
                label="STAR modules attended"
                options={STAR_MODULES}
                selected={record.trainings_attended || []}
                onChange={v => setField('trainings_attended', v)}
              />
            </Section>

            {/* Needs Assessment Section */}
            <Section title="Needs Assessment">
              <p className="text-xs text-slate-500 mb-3">
                This helps DOST-SEI identify where to focus future training.
              </p>
              <CheckboxGroup
                label="Subjects they feel least confident teaching"
                options={SUBJECTS}
                selected={record.low_confidence_subjects || []}
                onChange={v => setField('low_confidence_subjects', v)}
              />
              <CheckboxGroup
                label="STAR modules NOT yet applied in classes"
                options={STAR_MODULES}
                selected={record.unapplied_modules || []}
                onChange={v => setField('unapplied_modules', v)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Travel time to training center">
                  <Select
                    value={record.distance_to_training || ''}
                    onChange={v => setField('distance_to_training', v)}
                    options={DISTANCES}
                    placeholder="Select travel time"
                  />
                </Field>
                <Field label="Preferred training format">
                  <Select
                    value={record.preferred_format || ''}
                    onChange={v => setField('preferred_format', v)}
                    options={FORMATS.map(f => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1) }))}
                    placeholder="Select format"
                  />
                </Field>
              </div>
            </Section>

            {/* Navigation */}
            <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
              <div className="flex gap-2">
                {currentIndex > 0 && (
                  <button onClick={prevRecord} className="btn-secondary">← Previous</button>
                )}
                {currentIndex === 0 && (
                  <button onClick={() => setPhase('upload')} className="btn-secondary">← Cancel</button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={skipRecord} className="btn-secondary text-amber-600">Skip</button>
                {currentIndex < totalRecords - 1 ? (
                  <button onClick={nextRecord} className="btn-primary">Next →</button>
                ) : (
                  <button onClick={() => setPhase('confirm')} className="btn-primary">Review</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Confirm phase
  if (phase === 'confirm') {
    const validRecords = editedRecords.filter(r => !r._skipped)
    const skippedCount = editedRecords.filter(r => r._skipped).length

    return (
      <div className="min-h-screen bg-gradient-to-br from-star-50 to-slate-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-lg w-full">
          <h2 className="text-xl font-display font-bold text-slate-800 mb-2">Confirm import</h2>
          <p className="text-sm text-slate-500 mb-5">
            Review the summary below and click "Import" to save to the database.
          </p>

          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-star-600">{validRecords.length}</p>
                <p className="text-xs text-slate-500">Records to import</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-400">{skippedCount}</p>
                <p className="text-xs text-slate-500">Skipped</p>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button onClick={() => setPhase('verify')} className="btn-secondary flex-1">
              ← Go back
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || validRecords.length === 0}
              className="btn-primary flex-1"
            >
              {loading ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Upload phase (default)
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Import data"
        subtitle="Upload SF7 exports or STAR training logs to the system"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Panel */}
        <div className="card flex flex-col gap-5">
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

          <button
            onClick={handlePreview}
            disabled={!file || loading}
            className="btn-primary w-full"
          >
            {loading ? 'Parsing...' : 'Preview file'}
          </button>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Import History */}
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section Component
// ---------------------------------------------------------------------------

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-100">
        {title}
      </h3>
      <div className="flex flex-col gap-3">
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field Component
// ---------------------------------------------------------------------------

function Field({ label, children, highlight }) {
  return (
    <div className="flex flex-col gap-1">
      <label className={`text-xs font-medium ${highlight ? 'text-amber-600' : 'text-slate-600'}`}>
        {label}
      </label>
      {children}
    </div>
  )
}