/**
 * Main Application Component
 *
 * Sets up React Router and defines the application's route structure.
 * The app has two types of layouts:
 * 1. Public routes (Register) - No sidebar, centered form
 * 2. Protected routes - Sidebar + main content area
 *
 * Routes:
 * - /register: Self-registration portal for teachers
 * - /dashboard: System overview with summary statistics
 * - /regions: Interactive map with gap analysis
 * - /teachers: Teacher database browser
 * - /import: Bulk data upload interface
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/shared/Sidebar'
import Dashboard   from './pages/Dashboard'
import RegionsPage from './pages/Regions'
import TeachersPage from './pages/Teachers'
import ImportPage  from './pages/Import'
import Register    from './pages/Register'

// ---------------------------------------------------------------------------
// Layout Wrapper Component
// ---------------------------------------------------------------------------

/**
 * Layout wrapper for pages with sidebar navigation.
 * Provides consistent structure: sidebar on left, scrollable main content on right.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Page content to render
 */
function Layout({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      {/* Main content area - takes remaining width */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App Component - Route Configuration
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route - no sidebar */}
        <Route path="/register"  element={<Register />} />

        {/* Protected routes - with sidebar layout */}
        <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
        <Route path="/regions"   element={<Layout><RegionsPage /></Layout>} />
        <Route path="/teachers"  element={<Layout><TeachersPage /></Layout>} />
        <Route path="/import"    element={<Layout><ImportPage /></Layout>} />

        {/* Catch-all redirect to dashboard */}
        <Route path="*"          element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}