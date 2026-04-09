/**
 * Mobile Navigation Component
 *
 * Hamburger menu for mobile devices.
 * Opens/closes the navigation drawer on small screens.
 */

import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import clsx from 'clsx'

/**
 * Navigation items for the mobile menu.
 */
const NAV = [
  { to: '/dashboard', label: 'Overview',       icon: GridIcon },
  { to: '/regions',   label: 'Regional gaps',  icon: MapIcon },
  { to: '/divisions', label: 'Division offices', icon: OfficeIcon },
  { to: '/schools',   label: 'School priorities', icon: SchoolIcon },
  { to: '/school-teacher-management', label: 'School teacher management', icon: ClipboardUsersIcon },
  { to: '/regional-insights', label: 'Regional insights', icon: ChartIcon },
  { to: '/interventions', label: 'Interventions', icon: BoltIcon },
  { to: '/teachers',  label: 'Teachers',       icon: UsersIcon },
  { to: '/import',    label: 'Import data',    icon: UploadIcon },
  { to: '/register',  label: 'Teacher portal', icon: PersonIcon },
]

/**
 * Mobile navigation component with hamburger menu.
 * Returns null on desktop (lg breakpoint and above).
 * Shows hamburger button and offscreen nav drawer on mobile/tablet.
 */
export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)

  const handleNavClick = () => {
    setIsOpen(false) // Close menu when a nav link is clicked
  }

  return (
    <>
      {/* Hamburger button - only visible on mobile/tablet */}
      <div className="sm:hidden bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-star-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <p className="text-sm font-display font-bold text-slate-800">STAR-IDS</p>
        </div>
        
        {/* Hamburger icon button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          {isOpen ? (
            /* Close X icon */
            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            /* Hamburger menu icon */
            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile navigation drawer */}
      <nav
        className={clsx(
          'fixed top-0 left-0 h-screen w-56 bg-white border-r border-slate-100 z-50 flex flex-col overflow-y-auto',
          'transform transition-transform duration-300 sm:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo and branding */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
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
        <div className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={handleNavClick}
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

        {/* Footer with version info */}
        <div className="px-5 py-4 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            STAR Integrated Data System<br />
            DOST-SEI · MVP v1.0
          </p>
        </div>
      </nav>
    </>
  )
}

// ---------------------------------------------------------------------------
// Icon Components (duplicated from Sidebar)
// ---------------------------------------------------------------------------

function GridIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}

function MapIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  )
}

function UsersIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function UploadIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

function PersonIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  )
}

function SchoolIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M3 10l9-5 9 5M5 10v8m14-8v8M4 18h16M9 10v8m6-8v8" />
    </svg>
  )
}

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

function BoltIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  )
}

function OfficeIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M4 21h16M6 21V7l6-3 6 3v14M9 10h.01M9 13h.01M9 16h.01M15 10h.01M15 13h.01M15 16h.01" />
    </svg>
  )
}

function ClipboardUsersIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 3h6a1 1 0 011 1v1h2a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h2V4a1 1 0 011-1zM9 5h6M8 13a2 2 0 114 0 2 2 0 01-4 0zm7-1a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-8 6a4 4 0 018 0m2.5 0a3 3 0 00-2-2.83" />
    </svg>
  )
}
