/**
 * Authentication Module
 *
 * Simple role-based authentication using localStorage.
 * Supports two roles:
 * - admin: Full access to all regions and data (Program Officers & Regional Coordinators)
 * - teacher: Personal dashboard and profile editing only
 */

const STORAGE_KEY = 'star_auth_user'

/**
 * Get current user from localStorage.
 * @returns {{name: string, role: string, region?: string, id?: string} | null}
 */
export function getCurrentUser() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

/**
 * Authenticate a user and store in localStorage.
 * @param {{name: string, role: string, region?: string}} user
 * @returns {void}
 */
export function login(user) {
  const authUser = {
    ...user,
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    authenticatedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser))
}

/**
 * Logout and clear session.
 * @returns {void}
 */
export function logout() {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Check if user has a specific role.
 * @param {string} role - Role to check
 * @returns {boolean}
 */
export function hasRole(role) {
  const user = getCurrentUser()
  return user?.role === role
}

/**
 * Check if user is authenticated.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return getCurrentUser() !== null
}

/**
 * Check if user is admin role (Program Officer or Regional Coordinator).
 * @returns {boolean}
 */
export function isAdmin() {
  const user = getCurrentUser()
  return user?.role === 'admin'
}

/**
 * Get user's assigned region (optional filter for Regional Coordinators).
 * @returns {string | undefined}
 */
export function getUserRegion() {
  const user = getCurrentUser()
  return user?.region
}

/**
 * Check if user can access a page based on role.
 * @param {string} path - Current route path
 * @param {string} role - User's role
 * @returns {boolean}
 */
export function canAccessPage(path, role) {
  // Teachers have limited access
  if (role === 'teacher') {
    return ['/dashboard', '/profile', '/teachers'].includes(path) ||
           path.startsWith('/teachers?') ||
           path.includes('teacher_id')
  }
  // Admins (Program Officers & Regional Coordinators) have full access
  return true
}
