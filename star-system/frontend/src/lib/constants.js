/**
 * Application Constants
 *
 * Centralized configuration for the STAR system frontend.
 * Contains controlled vocabularies, styling constants, and helper functions.
 */

// ---------------------------------------------------------------------------
// STAR Modules - The 7 Capacity-Building Programs
// ---------------------------------------------------------------------------

/**
 * List of all STAR training modules offered by DOST-SEI.
 * Used in registration forms, training records, and analytics.
 */
export const STAR_MODULES = [
  'Teaching Mathematics through Problem Solving',
  'Inquiry-based Approach for Teaching Science',
  'Interdisciplinary Contextualization',
  'Language Strategies for Teaching Science and Mathematics',
  'Design Thinking for K-3 Science and Mathematics',
  'Designing Assessment Activities for Blended Learning',
  'Instrumentation and Improvisation',
]

// ---------------------------------------------------------------------------
// Subjects - Teaching Specializations
// ---------------------------------------------------------------------------

/**
 * Subject areas taught by STAR teachers.
 * Used in filters, forms, and analytics.
 */
export const SUBJECTS = [
  'General Science', 'Biology', 'Chemistry',
  'Physics', 'Earth Science', 'Mathematics', 'Statistics',
]

// ---------------------------------------------------------------------------
// Regions - Philippine Administrative Regions
// ---------------------------------------------------------------------------

/**
 * Canonical list of all 17 Philippine regions.
 * Includes NCR, CAR, and Regions I-XIII plus BARMM.
 * Used in dropdowns, filters, and map interactions.
 */
export const REGIONS = [
  'BARMM', 'CAR', 'NCR',
  'Region I', 'Region II', 'Region III', 'Region IV-A', 'Region IV-B',
  'Region V', 'Region VI', 'Region VII', 'Region VIII', 'Region IX',
  'Region X', 'Region XI', 'Region XII', 'Region XIII',
]

// ---------------------------------------------------------------------------
// Gap Level Styling
// ---------------------------------------------------------------------------

/**
 * Color configurations for gap score levels.
 * Used by GapBadge and GapBar components for consistent styling.
 */
export const GAP_COLORS = {
  low:      { bg: 'bg-green-100', text: 'text-green-800', hex: '#16a34a' },
  moderate: { bg: 'bg-amber-100', text: 'text-amber-800', hex: '#d97706' },
  high:     { bg: 'bg-red-100',   text: 'text-red-800',   hex: '#dc2626' },
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/**
 * Calculate percentage of a value relative to a total.
 *
 * @param {number} n - The numerator
 * @param {number} total - The denominator
 * @returns {number} - Percentage (0-100), or 0 if total is 0
 */
export const pct    = (n, total) => total ? Math.round((n / total) * 100) : 0

/**
 * Format a number as a percentage string.
 *
 * @param {number} n - The percentage value
 * @returns {string} - Formatted string (e.g., "75%")
 */
export const fmtPct = (n) => `${n}%`