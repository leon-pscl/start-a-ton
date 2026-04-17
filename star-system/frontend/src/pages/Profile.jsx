/**
 * Profile Page Component
 *
 * User profile management page.
 * - Program Officers: Can view/edit name and role info
 * - Regional Coordinators: Can view/edit name and assigned region
 * - Teachers: Full profile editing (extends to teacher data)
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, logout } from '../lib/auth'
import { getTeacher, updateTeacher } from '../lib/api'
import { REGIONS, SUBJECTS, STAR_MODULES } from '../lib/constants'
import { PageHeader, Spinner } from '../components/shared'

export default function Profile() {
  const navigate = useNavigate()
  const user = getCurrentUser()
  const [teacherData, setTeacherData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Load teacher data if teacher role
  useEffect(() => {
    if (user?.role === 'teacher' && user?.id) {
      setLoading(true)
      getTeacher(user.id)
        .then(setTeacherData)
        .catch((e) => setError(`Failed to load profile: ${e.message}`))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [user])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleSave = async () => {
    if (user?.role !== 'teacher' || !teacherData) return

    setSaving(true)
    setError('')
    try {
      await updateTeacher(user.id, teacherData)
      setSuccess('Profile updated successfully')
      setEditing(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(`Failed to save: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="My Profile"
        subtitle={user?.role === 'teacher' ? 'Manage your personal information and growth data' : 'Account settings'}
        actions={
          <button onClick={handleLogout} className="btn-secondary text-xs">
            Sign out
          </button>
        }
      />

      {/* User info card */}
      <div className="card mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-star-100 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-star-700">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-slate-800">{user?.name || 'Unknown User'}</h2>
              <p className="text-sm text-slate-500 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
              {user?.role === 'regional_coordinator' && user?.region && (
                <p className="text-xs text-indigo-600 font-medium mt-1">Assigned: {user.region}</p>
              )}
            </div>
          </div>
          {user?.role === 'teacher' && (
            <button
              onClick={() => setEditing(!editing)}
              className="btn-primary text-xs"
            >
              {editing ? 'Cancel' : 'Edit profile'}
            </button>
          )}
        </div>

        {/* Account info */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">User ID</p>
            <p className="text-sm font-mono text-slate-700 truncate">{user?.id}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Authenticated</p>
            <p className="text-sm text-slate-700">
              {user?.authenticatedAt ? new Date(user.authenticatedAt).toLocaleString() : 'Unknown'}
            </p>
          </div>
        </div>
      </div>

      {/* Teacher-specific profile data */}
      {user?.role === 'teacher' && teacherData && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Professional Profile</h3>

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProfileField
              label="Full name"
              value={teacherData.full_name || ''}
              onChange={(v) => setTeacherData({ ...teacherData, full_name: v })}
              editable={editing}
            />
            <ProfileField
              label="Region"
              value={teacherData.region || ''}
              disabled
            />
            <ProfileField
              label="School name"
              value={teacherData.school_name || ''}
              onChange={(v) => setTeacherData({ ...teacherData, school_name: v })}
              editable={editing}
            />
            <ProfileField
              label="Division"
              value={teacherData.division || ''}
              onChange={(v) => setTeacherData({ ...teacherData, division: v })}
              editable={editing}
            />
            <ProfileField
              label="Position"
              value={teacherData.position || ''}
              onChange={(v) => setTeacherData({ ...teacherData, position: v })}
              editable={editing}
            />
            <ProfileField
              label="Years of experience"
              value={teacherData.years_experience || ''}
              type="number"
              onChange={(v) => setTeacherData({ ...teacherData, years_experience: v })}
              editable={editing}
            />
            <ProfileField
              label="Primary specialization"
              value={teacherData.primary_specialization || ''}
              onChange={(v) => setTeacherData({ ...teacherData, primary_specialization: v })}
              editable={editing}
            />
            <ProfileField
              label="Last training year"
              value={teacherData.last_training_year || ''}
              type="number"
              onChange={(v) => setTeacherData({ ...teacherData, last_training_year: v })}
              editable={editing}
            />
          </div>

          {/* Read-only sections */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Training History</h4>
            <div className="flex flex-wrap gap-2">
              {(teacherData.trainings_attended || []).length > 0 ? (
                teacherData.trainings_attended.map((m, i) => (
                  <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    {m}
                  </span>
                ))
              ) : (
                <p className="text-xs text-slate-400">No trainings recorded</p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Competency Scores</h4>
            <div className="grid grid-cols-3 gap-3">
              <ScoreCard label="Overall" value={teacherData.competency_score || 0} />
              <ScoreCard label="Math" value={teacherData.math_competency || 0} />
              <ScoreCard label="Science" value={teacherData.science_competency || 0} />
            </div>
          </div>

          {editing && (
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-xs">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Non-teacher info */}
      {user?.role !== 'teacher' && (
        <div className="card">
          <p className="text-sm text-slate-500">
            {user.role === 'program_officer'
              ? 'As a Program Officer, you have full access to all regional data and analytics. Use the dashboard to monitor system-wide interventions.'
              : 'As a Regional Coordinator, you have access to your assigned region\'s data. Use the regional analysis pages to monitor and plan interventions.'}
          </p>
        </div>
      )}
    </div>
  )
}

function ProfileField({ label, value, onChange, editable = false, type = 'text', disabled = false }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {editable && !disabled ? (
        <input
          type={type}
          className="input w-full"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <p className="text-sm text-slate-700 py-2">{value || 'Not specified'}</p>
      )}
    </div>
  )
}

function ScoreCard({ label, value }) {
  const level = value >= 75 ? 'Proficient' : value >= 50 ? 'Developing' : 'Needs Support'
  const color = value >= 75 ? 'text-green-600' : value >= 50 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
      <p className="text-[10px] text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500">{level}</p>
    </div>
  )
}
