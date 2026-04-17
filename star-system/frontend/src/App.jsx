/**
 * Main Application Component
 *
 * Sets up React Router and defines the application's route structure.
 * The app has two types of layouts:
 * 1. Public routes (Register, Login) - No sidebar, centered form
 * 2. Protected routes - Sidebar + main content area
 *
 * Routes:
 * - /login: Authentication gate (required for all protected routes)
 * - /register: Self-registration portal for teachers
 * - /dashboard: System overview with summary statistics
 * - /regions: Interactive map with gap analysis
 * - /teachers: Teacher database browser
 * - /import: Bulk data upload interface
 * - /profile: User profile management
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { isAuthenticated, canAccessPage, getCurrentUser } from './lib/auth'
import Sidebar from './components/shared/Sidebar'
import MobileNav from './components/shared/MobileNav'
import ChatWidget from './components/shared/ChatWidget'
import Dashboard   from './pages/Dashboard'
import RegionsPage from './pages/Regions'
import TeachersPage from './pages/Teachers'
import ImportPage  from './pages/Import'
import Register    from './pages/Register'
import Login       from './pages/Login'
import Profile     from './pages/Profile'
import SchoolsPage from './pages/Schools'
import DivisionsPage from './pages/Divisions'
import InterventionsPage from './pages/Interventions'
import RegionalInsightsPage from './pages/RegionalInsights'
import SchoolTeacherManagementPage from './pages/SchoolTeacherManagement'

// ---------------------------------------------------------------------------
// Protected Route Component
// ---------------------------------------------------------------------------

/**
 * Protected route wrapper that redirects to login if not authenticated.
 * Also handles role-based access control.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Page content to render
 */
function ProtectedRoute({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = getCurrentUser()

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login', { state: { from: location }, replace: true })
      return
    }

    // Check role-based access
    const path = location.pathname
    if (user && !canAccessPage(path, user.role)) {
      navigate('/dashboard', { replace: true })
    }
  }, [location, navigate, user])

  if (!isAuthenticated()) {
    return null // Redirecting
  }

  return children
}

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
        {/* Public routes - no sidebar, no auth required */}
        <Route path="/login"     element={<Login />} />
        <Route path="/register"  element={<Register />} />

        {/* Protected routes - with sidebar layout */}
        <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/regions"   element={<ProtectedRoute><Layout><RegionsPage /></Layout></ProtectedRoute>} />
        <Route path="/schools"   element={<ProtectedRoute><Layout><SchoolsPage /></Layout></ProtectedRoute>} />
        <Route path="/school-teacher-management" element={<ProtectedRoute><Layout><SchoolTeacherManagementPage /></Layout></ProtectedRoute>} />
        <Route path="/divisions" element={<ProtectedRoute><Layout><DivisionsPage /></Layout></ProtectedRoute>} />
        <Route path="/interventions" element={<ProtectedRoute><Layout><InterventionsPage /></Layout></ProtectedRoute>} />
        <Route path="/regional-insights" element={<ProtectedRoute><Layout><RegionalInsightsPage /></Layout></ProtectedRoute>} />
        <Route path="/teachers"  element={<ProtectedRoute><Layout><TeachersPage /></Layout></ProtectedRoute>} />
        <Route path="/import"    element={<ProtectedRoute><Layout><ImportPage /></Layout></ProtectedRoute>} />
        <Route path="/profile"   element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />

        {/* Catch-all redirect to dashboard */}
        <Route path="*"          element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}