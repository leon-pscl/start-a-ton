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
import MobileNav from './components/shared/MobileNav'
import ChatWidget from './components/shared/ChatWidget'
import Dashboard   from './pages/Dashboard'
import RegionsPage from './pages/Regions'
import TeachersPage from './pages/Teachers'
import ImportPage  from './pages/Import'
import Register    from './pages/Register'
import SchoolsPage from './pages/Schools'
import DivisionsPage from './pages/Divisions'
import InterventionsPage from './pages/Interventions'
import RegionalInsightsPage from './pages/RegionalInsights'
import SchoolTeacherManagementPage from './pages/SchoolTeacherManagement'

// ---------------------------------------------------------------------------
// Layout Wrapper Component
// ---------------------------------------------------------------------------

/**
 * Layout wrapper for pages with sidebar navigation.
 * Desktop: sidebar on left, main content on right
 * Mobile: hamburger menu at top, full-width stacked content
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Page content to render
 */
function Layout({ children }) {
  return (
    <div className="flex flex-col min-h-screen sm:flex-row">
      {/* Mobile navigation - only visible on small screens */}
      <MobileNav />

      {/* Desktop sidebar - only visible on sm and larger screens */}
      <Sidebar />

      {/* Main content area - responsive width and scrolling */}
      <main className="flex-1 overflow-auto w-full">{children}</main>

      {/* AI Chat Widget */}
      <ChatWidget />
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
        <Route path="/schools"   element={<Layout><SchoolsPage /></Layout>} />
        <Route path="/school-teacher-management" element={<Layout><SchoolTeacherManagementPage /></Layout>} />
        <Route path="/divisions" element={<Layout><DivisionsPage /></Layout>} />
        <Route path="/interventions" element={<Layout><InterventionsPage /></Layout>} />
        <Route path="/regional-insights" element={<Layout><RegionalInsightsPage /></Layout>} />
        <Route path="/teachers"  element={<Layout><TeachersPage /></Layout>} />
        <Route path="/import"    element={<Layout><ImportPage /></Layout>} />

        {/* Catch-all redirect to dashboard */}
        <Route path="*"          element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}