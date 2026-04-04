export const STAR_MODULES = [
  'Teaching Mathematics through Problem Solving',
  'Inquiry-based Approach for Teaching Science',
  'Interdisciplinary Contextualization',
  'Language Strategies for Teaching Science and Mathematics',
  'Design Thinking for K-3 Science and Mathematics',
  'Designing Assessment Activities for Blended Learning',
  'Instrumentation and Improvisation',
]

export const SUBJECTS = [
  'General Science', 'Biology', 'Chemistry',
  'Physics', 'Earth Science', 'Mathematics', 'Statistics',
]

export const REGIONS = [
  'BARMM', 'CAR', 'NCR',
  'Region I', 'Region II', 'Region III', 'Region IV-A', 'Region IV-B',
  'Region V', 'Region VI', 'Region VII', 'Region VIII', 'Region IX',
  'Region X', 'Region XI', 'Region XII', 'Region XIII',
]

export const GAP_COLORS = {
  low:      { bg: 'bg-green-100', text: 'text-green-800', hex: '#16a34a' },
  moderate: { bg: 'bg-amber-100', text: 'text-amber-800', hex: '#d97706' },
  high:     { bg: 'bg-red-100',   text: 'text-red-800',   hex: '#dc2626' },
}

export const pct    = (n, total) => total ? Math.round((n / total) * 100) : 0
export const fmtPct = (n) => `${n}%`