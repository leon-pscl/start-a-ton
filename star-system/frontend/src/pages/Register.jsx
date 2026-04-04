import { useState } from 'react'
import { registerTeacher } from '../lib/api'
import { REGIONS, SUBJECTS, STAR_MODULES } from '../lib/constants'
import { CheckboxGroup, Select } from '../components/shared'

const STEPS = ['Personal info', 'Teaching profile', 'Training history', 'Needs assessment']

const POSITIONS = ['Teacher I', 'Teacher II', 'Teacher III', 'Master Teacher I', 'Master Teacher II']
const QUALIFICATIONS = ['BSEd', 'MEd', 'PhD', 'Other']
const GRADE_LEVELS = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'College']
const DISTANCES = ['<1hr', '1-3hrs', '3hrs+']
const FORMATS = ['face-to-face', 'blended', 'online']

const INITIAL = {
  full_name: '', region: '', division: '', school_name: '', school_type: 'public',
  position: '', years_experience: '', highest_qualification: '',
  subject_specializations: [], grade_levels_taught: [],
  trainings_attended: [],
  low_confidence_subjects: [], unapplied_modules: [],
  distance_to_training: '', preferred_format: '',
}

export default function Register() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL)
  const [submitted, setSubmitted] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const next = () => { setError(''); setStep(s => Math.min(s + 1, STEPS.length - 1)) }
  const back = () => { setError(''); setStep(s => Math.max(s - 1, 0)) }

  const canNext = () => {
    if (step === 0) return form.full_name.trim() && form.region
    return true
  }

  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      const payload = {
        ...form,
        years_experience: form.years_experience ? parseInt(form.years_experience) : null,
      }
      const result = await registerTeacher(payload)
      setSubmitted(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-star-50 to-slate-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-bold text-slate-800 mb-1">Registration complete</h2>
          <p className="text-sm text-slate-500 mb-5">
            Thank you, {submitted.full_name}. Your profile has been recorded.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs text-slate-400 mb-1">Your reference ID</p>
            <p className="text-xs font-mono text-slate-700 break-all">{submitted.id}</p>
          </div>
          <button
            onClick={() => { setSubmitted(null); setForm(INITIAL); setStep(0) }}
            className="btn-secondary w-full text-sm"
          >
            Register another teacher
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-star-50 to-slate-100 flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 mb-4">
            <span className="w-2 h-2 bg-star-500 rounded-full" />
            <span className="text-xs font-medium text-slate-600">DOST-SEI · STAR Program</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-slate-800">Teacher registration</h1>
          <p className="text-sm text-slate-500 mt-1">Science Teacher Academy for the Regions</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-6 px-2">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center">
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  i < step  ? 'bg-star-600 border-star-600 text-white'
                  : i === step ? 'border-star-600 text-star-600 bg-white'
                  : 'border-slate-200 text-slate-300 bg-white'
                }`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${
                  i <= step ? 'text-star-700' : 'text-slate-300'
                }`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-6 mx-2 transition-colors ${i < step ? 'bg-star-400' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-5">{STEPS[step]}</h2>

          {step === 0 && <Step1 form={form} set={set} />}
          {step === 1 && <Step2 form={form} set={set} />}
          {step === 2 && <Step3 form={form} set={set} />}
          {step === 3 && <Step4 form={form} set={set} />}

          {error && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
            {step > 0
              ? <button onClick={back} className="btn-secondary">← Back</button>
              : <div />
            }
            {step < STEPS.length - 1
              ? <button onClick={next} disabled={!canNext()} className="btn-primary">
                  Next →
                </button>
              : <button onClick={submit} disabled={loading} className="btn-primary">
                  {loading ? 'Submitting…' : 'Submit registration'}
                </button>
            }
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5 leading-relaxed">
          Your data is collected for STAR program planning only.<br />
          It will not be shared outside DOST-SEI without your consent.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — Personal info
// ---------------------------------------------------------------------------
function Step1({ form, set }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Full name *">
        <input
          className="input"
          placeholder="e.g. Maria Santos"
          value={form.full_name}
          onChange={e => set('full_name', e.target.value)}
        />
      </Field>
      <Field label="Region *">
        <Select
          value={form.region}
          onChange={v => set('region', v)}
          options={REGIONS}
          placeholder="Select your region"
        />
      </Field>
      <Field label="Division / Schools Division Office">
        <input
          className="input"
          placeholder="e.g. Division of Cebu City"
          value={form.division}
          onChange={e => set('division', e.target.value)}
        />
      </Field>
      <Field label="School name">
        <input
          className="input"
          placeholder="e.g. Cebu National High School"
          value={form.school_name}
          onChange={e => set('school_name', e.target.value)}
        />
      </Field>
      <Field label="School type">
        <Select
          value={form.school_type}
          onChange={v => set('school_type', v)}
          options={[{ value: 'public', label: 'Public' }, { value: 'private', label: 'Private' }]}
        />
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Teaching profile
// ---------------------------------------------------------------------------
function Step2({ form, set }) {
  return (
    <div className="flex flex-col gap-5">
      <Field label="Position / designation">
        <Select
          value={form.position}
          onChange={v => set('position', v)}
          options={POSITIONS}
          placeholder="Select position"
        />
      </Field>
      <Field label="Years of teaching experience">
        <input
          type="number"
          min="0"
          max="50"
          className="input"
          placeholder="e.g. 8"
          value={form.years_experience}
          onChange={e => set('years_experience', e.target.value)}
        />
      </Field>
      <Field label="Highest educational qualification">
        <Select
          value={form.highest_qualification}
          onChange={v => set('highest_qualification', v)}
          options={QUALIFICATIONS}
          placeholder="Select qualification"
        />
      </Field>
      <CheckboxGroup
        label="Subject specializations (select all that apply)"
        options={SUBJECTS}
        selected={form.subject_specializations}
        onChange={v => set('subject_specializations', v)}
      />
      <CheckboxGroup
        label="Grade levels currently teaching"
        options={GRADE_LEVELS}
        selected={form.grade_levels_taught}
        onChange={v => set('grade_levels_taught', v)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Training history
// ---------------------------------------------------------------------------
function Step3({ form, set }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg px-3 py-2">
        Select all STAR modules you have attended, whether as a participant or as a trainer.
      </p>
      <CheckboxGroup
        label="STAR modules attended"
        options={STAR_MODULES}
        selected={form.trainings_attended}
        onChange={v => set('trainings_attended', v)}
      />
      {form.trainings_attended.length === 0 && (
        <p className="text-xs text-slate-400 italic">
          No modules selected — you will be counted as untrained in this system.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4 — Needs assessment
// ---------------------------------------------------------------------------
function Step4({ form, set }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-slate-500 leading-relaxed bg-star-50 rounded-lg px-3 py-2 border border-star-100">
        This helps DOST-SEI identify where to focus future training. Your answers are confidential.
      </p>
      <CheckboxGroup
        label="Which subjects do you feel least confident teaching?"
        options={SUBJECTS}
        selected={form.low_confidence_subjects}
        onChange={v => set('low_confidence_subjects', v)}
      />
      <CheckboxGroup
        label="Which STAR modules have you NOT yet applied in your classes?"
        options={STAR_MODULES}
        selected={form.unapplied_modules}
        onChange={v => set('unapplied_modules', v)}
      />
      <Field label="Approximate travel time to the nearest STAR training center">
        <Select
          value={form.distance_to_training}
          onChange={v => set('distance_to_training', v)}
          options={DISTANCES}
          placeholder="Select travel time"
        />
      </Field>
      <Field label="Preferred training format">
        <Select
          value={form.preferred_format}
          onChange={v => set('preferred_format', v)}
          options={FORMATS.map(f => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1) }))}
          placeholder="Select format"
        />
      </Field>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  )
}
