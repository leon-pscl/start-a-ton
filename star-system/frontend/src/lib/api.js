/**
 * API Client Module
 *
 * Central module for all backend API calls. Provides a clean interface
 * for frontend components to interact with the FastAPI backend.
 *
 * All endpoints return JSON responses and throw errors with meaningful
 * messages for the UI to display.
 */

// API base URL - proxies to FastAPI backend through Vite dev server
const BASE = '/api'

/**
 * Generic request helper for API calls.
 *
 * Handles:
 * - JSON content type headers
 * - Error response parsing
 * - Consistent error throwing with details
 *
 * @param {string} path - API endpoint path (without /api prefix)
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<any>} - Parsed JSON response
 * @throws {Error} - With message from backend detail or status code
 */
async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  // Handle error responses
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.detail ?? `Request failed: ${res.status}`)
    err.status = res.status
    err.data   = body
    throw err
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Analytics Endpoints
// ---------------------------------------------------------------------------

/**
 * Get system-wide summary statistics.
 * Used by Dashboard for the summary cards.
 */
export const getSummary      = () => request('/analytics/summary')

/**
 * Get gap analysis for all regions.
 * Returns regions sorted by gap score (highest first).
 */
export const getRegions      = () => request('/analytics/regions')

/**
 * Get detailed analysis for a single region.
 * Includes subject breakdown and module uptake.
 *
 * @param {string} region - Region name (e.g., "NCR", "Region I")
 */
export const getRegionDetail = (region) => request(`/analytics/regions/${encodeURIComponent(region)}`)

// ---------------------------------------------------------------------------
// Teacher Endpoints
// ---------------------------------------------------------------------------

/**
 * List teachers with optional filtering and pagination.
 *
 * @param {object} params - Query parameters:
 *   - region: string - Filter by region
 *   - subject: string - Filter by subject specialization
 *   - trained: boolean - Filter by training status
 *   - limit: number - Results per page (max 1000)
 *   - offset: number - Pagination offset
 */
export const getTeachers = (params = {}) => {
  // Build query string, filtering out empty/null values
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  ).toString()
  return request(`/teachers${qs ? `?${qs}` : ''}`)
}

/**
 * Get a single teacher by ID.
 *
 * @param {string} id - Teacher UUID
 */
export const getTeacher      = (id) => request(`/teachers/${id}`)

/**
 * Register a new teacher from the self-registration portal.
 *
 * @param {object} payload - Teacher data from the registration form
 * @returns {Promise<{id: string, full_name: string, region: string}>}
 */
export const registerTeacher = (payload) =>
  request('/teachers', { method: 'POST', body: JSON.stringify(payload) })

// ---------------------------------------------------------------------------
// Import Endpoints
// ---------------------------------------------------------------------------

/**
 * Upload a file for bulk import (SF7 or training log).
 *
 * Uses FormData for multipart file upload.
 *
 * @param {File} file - The file to upload
 * @param {string} sourceType - Either "sf7" or "star-log"
 * @returns {Promise<{filename: string, rows_parsed: number, rows_imported: number, rows_flagged: number}>}
 */
export const uploadFile = (file, sourceType) => {
  const form = new FormData()
  form.append('file', file)
  form.append('source_type', sourceType)
  return fetch(`${BASE}/import/upload`, { method: 'POST', body: form })
    .then(async res => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? `Upload failed: ${res.status}`)
      }
      return res.json()
    })
}

/**
 * Preview a file without importing (parses and returns extracted records).
 *
 * Uses FormData for multipart file upload.
 *
 * @param {File} file - The file to preview
 * @param {string} sourceType - Either "sf7" or "star-log"
 * @returns {Promise<{source_type: string, filename: string, total_records: number, columns_found: object, records: Array}>}
 */
export const previewFile = (file, sourceType) => {
  const form = new FormData()
  form.append('file', file)
  form.append('source_type', sourceType)
  return fetch(`${BASE}/import/preview`, { method: 'POST', body: form })
    .then(async res => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? `Preview failed: ${res.status}`)
      }
      return res.json()
    })
}

/**
 * Confirm import after user reviews/edits records.
 *
 * @param {string} sourceType - Either "sf7" or "star-log"
 * @param {Array} records - Array of teacher/training records (potentially modified)
 * @returns {Promise<{source_type: string, rows_imported: number, rows_flagged: number}>}
 */
export const confirmImport = (sourceType, records) => {
  const form = new FormData()
  form.append('source_type', sourceType)
  form.append('records', JSON.stringify(records))
  return fetch(`${BASE}/import/confirm`, { method: 'POST', body: form })
    .then(async res => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? `Confirm failed: ${res.status}`)
      }
      return res.json()
    })
}

/**
 * Get import history for audit trail.
 *
 * @returns {Promise<Array>} - List of ImportLog records
 */
export const getImportLogs = () => request('/import/logs')

// ---------------------------------------------------------------------------
// Export Endpoints
// ---------------------------------------------------------------------------

/**
 * Export teacher data as CSV file download.
 *
 * Opens the download in a new browser tab.
 *
 * @param {string} region - Optional region filter (exports all if not provided)
 */
export const exportCSV = (region = '') => {
  const qs = region ? `?region=${encodeURIComponent(region)}` : ''
  window.open(`${BASE}/analytics/export/csv${qs}`, '_blank')
}

export const getProvinces = () => request('/analytics/provinces')
export const getCities    = () => request('/analytics/cities')
export const getSubjectShortage = () => request('/analytics/subject-shortage')