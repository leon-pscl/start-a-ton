/**
 * Login Page Component
 *
 * Simple role-based login for STAR system.
 * Users select their role and enter their name to access the system.
 *
 * Roles:
 * - Program Officer: Full system access, all regions
 * - Regional Coordinator: Single region access
 * - Teacher: Personal dashboard and profile only
 */

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { login } from '../lib/auth'

const ROLES = [
  { value: 'admin', label: 'Program Officer / Regional Coordinator', description: 'Full access to all regional data and analytics' },
  { value: 'teacher', label: 'Teacher', description: 'View personal growth and update profile' },
]

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = location.state?.from?.pathname || '/dashboard'

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter your name')
      return
    }

    if (!role) {
      setError('Please select your role')
      return
    }

    setLoading(true)

    // Simulate brief auth delay
    setTimeout(() => {
      login({
        name: name.trim(),
        role,
      })
      navigate(from, { replace: true })
    }, 500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-star-50 to-slate-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full">
        {/* Logo and header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-star-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">S</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-slate-800">STAR Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Science Teacher Academy for the Regions</p>
          <p className="text-xs text-slate-400 mt-2">DOST-SEI · Integrated Data System</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name field */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Full name
            </label>
            <input
              type="text"
              className="input w-full"
              placeholder="e.g. Maria Santos"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Role selection */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Your role
            </label>
            <div className="space-y-2">
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    role === r.value
                      ? 'border-star-500 bg-star-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={(e) => setRole(e.target.value)}
                    className="mt-0.5 text-star-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{r.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{r.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>


          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-sm py-2.5"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Footer links */}
        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            New teacher?{' '}
            <a href="/register" className="text-star-600 hover:underline">
              Register your profile
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
