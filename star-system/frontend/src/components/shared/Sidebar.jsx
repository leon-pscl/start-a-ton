/**
 * Sidebar Navigation Component
 *
 * Main navigation sidebar for the STAR system.
 * Provides links to all major sections of the application:
 * - Dashboard (overview)
 * - Regions (gap analysis map)
 * - Teachers (teacher database)
 * - Import (data upload)
 * - Register (self-registration portal)
 *
 * Uses React Router's NavLink for active state styling.
 */

import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { getCurrentUser, logout, isAdmin } from '../../lib/auth'

// ---------------------------------------------------------------------------
// Navigation Configuration
// ---------------------------------------------------------------------------

/**
 * Navigation items for the sidebar with optional category grouping.
 * Each item has:
 * - to: Route path
 * - label: Display text
 * - icon: SVG icon component
 * - category: Optional category for grouping (collapsible)
 */
const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: GridIcon },
  {
    category: 'Regional Analysis',
    items: [
      { to: '/regions', label: 'Regional gaps', icon: MapIcon },
      { to: '/regional-insights', label: 'Regional insights', icon: ChartIcon },
    ]
  },
  {
    category: 'School Analysis',
    items: [
      { to: '/schools', label: 'School priorities', icon: SchoolIcon },
      { to: '/school-teacher-management', label: 'School teacher management', icon: ClipboardUsersIcon },
    ]
  },
  { to: '/divisions', label: 'Division offices', icon: OfficeIcon },
  { to: '/interventions', label: 'Planning & Simulation', icon: BoltIcon },
  { to: '/teachers', label: 'Teachers', icon: UsersIcon },
  { to: '/import', label: 'Import data', icon: UploadIcon },
  { to: '/register', label: 'Teacher portal', icon: PersonIcon },
]

// ---------------------------------------------------------------------------
// Sidebar Component
// ---------------------------------------------------------------------------

export default function Sidebar() {
  const navigate = useNavigate()
  const user = getCurrentUser()
  const [expandedCategories, setExpandedCategories] = useState({
    'Regional Analysis': true,
    'School Analysis': true,
  })

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  // Filter nav items based on user role
  const filterItems = (items) => {
    if (!user) return items
    if (!isAdmin()) {
      // Teachers only see dashboard, teachers, and profile
      return items.filter(item => {
        if (item.category) {
          return false // Teachers don't see categories
        }
        return ['/dashboard', '/teachers', '/profile'].includes(item.to)
      })
    }
    return items
  }

  const filteredNav = filterItems(NAV)

  return (
    <aside className="w-56 min-h-screen bg-white border-r border-slate-100 flex flex-col hidden sm:flex">
      {/* Logo and branding */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          {/* STAR logo */}
          <div className="w-7 h-7 bg-star-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <div>
            <p className="text-sm font-display font-bold text-slate-800 leading-none">STAR-IDS</p>
            <p className="text-[10px] text-slate-400 mt-0.5">DOST-SEI</p>
          </div>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {filteredNav.map((item, index) => {
          // Category with collapsible subitems
          if (item.category) {
            const isExpanded = expandedCategories[item.category] ?? true
            return (
              <div key={item.category} className="mb-2">
                <button
                  onClick={() => toggleCategory(item.category)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide hover:bg-slate-50 rounded-lg transition-colors"
                >
                  {item.category}
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="ml-2 mt-1 space-y-0.5">
                    {item.items.map(({ to, label, icon: Icon }) => (
                      <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) => clsx(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                          isActive
                            ? 'bg-star-50 text-star-700 font-medium'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          // Regular nav item (no category)
          const { to, label, icon: Icon } = item
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-star-50 text-star-700 font-medium'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          )
        })}
      </nav>

      {/* User profile section */}
      {user && (
        <div className="px-3 py-3 border-t border-slate-100">
          <NavLink
            to="/profile"
            className={({ isActive }) => clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-1',
              isActive
                ? 'bg-star-50 text-star-700 font-medium'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            )}
          >
            <div className="w-6 h-6 bg-star-100 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-star-700">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 capitalize">{user.role?.replace(/_/g, ' ')}</p>
            </div>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
            </svg>
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-400 hover:text-red-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      )}

      {/* Footer with version info */}
      <div className="px-5 py-4 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 leading-relaxed">
          STAR Integrated Data System<br />
          DOST-SEI · MVP v1.0
        </p>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Icon Components
// ---------------------------------------------------------------------------

/** Grid icon - used for Dashboard/Overview */
function GridIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}

/** Map icon - used for Regions */
function MapIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  )
}

/** Users icon - used for Teachers */
function UsersIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

/** Upload icon - used for Import */
function UploadIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

/** Person icon - used for Registration portal */
function PersonIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  )
}

/** School icon - used for school priorities */
function SchoolIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M3 10l9-5 9 5M5 10v8m14-8v8M4 18h16M9 10v8m6-8v8" />
    </svg>
  )
}

/** Chart icon - used for regional insights */
function ChartIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M4 19h16M7 15l3-3 3 2 4-5" />
      <circle cx="7" cy="15" r="1" />
      <circle cx="10" cy="12" r="1" />
      <circle cx="13" cy="14" r="1" />
      <circle cx="17" cy="9" r="1" />
    </svg>
  )
}

/** Bolt icon - used for intervention planning */
function BoltIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  )
}

/** Office icon - used for School Division Office view */
function OfficeIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M4 21h16M6 21V7l6-3 6 3v14M9 10h.01M9 13h.01M9 16h.01M15 10h.01M15 13h.01M15 16h.01" />
    </svg>
  )
}

/** Clipboard users icon - used for school teacher management */
function ClipboardUsersIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 3h6a1 1 0 011 1v1h2a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h2V4a1 1 0 011-1zM9 5h6M8 13a2 2 0 114 0 2 2 0 01-4 0zm7-1a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-8 6a4 4 0 018 0m2.5 0a3 3 0 00-2-2.83" />
    </svg>
  )
}