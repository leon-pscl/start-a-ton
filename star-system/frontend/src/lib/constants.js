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
// Provinces by Region
// ---------------------------------------------------------------------------

export const PROVINCES = {
  'NCR': ['Metro Manila'],
  'Region I': ['Ilocos Norte', 'Ilocos Sur', 'La Union', 'Pangasinan'],
  'Region II': ['Batanes', 'Cagayan', 'Isabela', 'Nueva Vizcaya', 'Quirino'],
  'Region III': ['Aurora', 'Bataan', 'Bulacan', 'Nueva Ecija', 'Pampanga', 'Tarlac', 'Zambales'],
  'Region IV-A': ['Batangas', 'Cavite', 'Laguna', 'Quezon', 'Rizal'],
  'Region IV-B': ['Marinduque', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Romblon'],
  'Region V': ['Albay', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Masbate', 'Sorsogon'],
  'Region VI': ['Aklan', 'Antique', 'Capiz', 'Guimaras', 'Iloilo', 'Negros Occidental'],
  'Region VII': ['Bohol', 'Cebu', 'Negros Oriental', 'Siquijor'],
  'Region VIII': ['Biliran', 'Eastern Samar', 'Leyte', 'Northern Samar', 'Samar', 'Southern Leyte'],
  'Region IX': ['Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'],
  'Region X': ['Bukidnon', 'Camiguin', 'Lanao del Norte', 'Misamis Occidental', 'Misamis Oriental'],
  'Region XI': ['Compostela Valley', 'Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental'],
  'Region XII': ['Cotabato', 'Sarangani', 'South Cotabato', 'Sultan Kudarat'],
  'Region XIII': ['Agusan del Norte', 'Agusan del Sur', 'Dinagat Islands', 'Surigao del Norte', 'Surigao del Sur'],
  'CAR': ['Abra', 'Apayao', 'Benguet', 'Ifugao', 'Kalinga', 'Mountain Province'],
  'BARMM': ['Basilan', 'Lanao del Sur', 'Maguindanao del Norte', 'Maguindanao del Sur', 'Sulu', 'Tawi-Tawi'],
}

// ---------------------------------------------------------------------------
// Cities/Municipalities by Province
// ---------------------------------------------------------------------------

export const CITIES = {
  // NCR
  'Metro Manila': ['Caloocan City', 'Las Piñas City', 'Makati City', 'Malabon City', 'Mandaluyong City', 'Manila City', 'Marikina City', 'Muntinlupa City', 'Navotas City', 'Pasay City', 'Pasig City', 'Pateros', 'Quezon City', 'San Juan City', 'Taguig City', 'Valenzuela City'],
  // Region I
  'Ilocos Norte': ['Batac City', 'Laoag City'],
  'Ilocos Sur': ['Candon City', 'Vigan City'],
  'La Union': ['San Fernando City'],
  'Pangasinan': ['Dagupan City', 'San Fabian', 'Umingan'],
  // Region II
  'Batanes': ['Basco'],
  'Cagayan': ['Tuguegarao City'],
  'Isabela': ['Cauayan City', 'Ilagan City', 'Santiago City'],
  'Nueva Vizcaya': ['Bayombong'],
  'Quirino': ['Cabarroguis'],
  // Region III
  'Aurora': ['Baler'],
  'Bataan': ['Balanga City', 'Dinalupihan'],
  'Bulacan': ['Malolos City', 'San Jose del Monte City'],
  'Nueva Ecija': ['Cabanatuan City', 'Gapan City', 'Palayan City', 'San Jose City'],
  'Pampanga': ['Angeles City', 'Apalit', 'San Fernando City'],
  'Tarlac': ['Tarlac City'],
  'Zambales': ['Olongapo City', 'Subic'],
  // Region IV-A
  'Batangas': ['Batangas City', 'Lipa City', 'Tanauan City'],
  'Cavite': ['Bacoor City', 'Cavite City', 'Dasmariñas City', 'Imus City', 'Tagaytay City', 'Trece Martires City'],
  'Laguna': ['Biñan City', 'Cabuyao City', 'Calamba City', 'Los Baños', 'San Pablo City', 'Santa Rosa City'],
  'Quezon': ['Lucena City'],
  'Rizal': ['Antipolo City', 'Binangonan', 'Cainta', 'Taytay'],
  // Region IV-B
  'Marinduque': ['Boac'],
  'Occidental Mindoro': ['Mamburao'],
  'Oriental Mindoro': ['Calapan City'],
  'Palawan': ['Puerto Princesa City'],
  'Romblon': ['Romblon'],
  // Region V
  'Albay': ['Legazpi City', 'Tabaco City'],
  'Camarines Norte': ['Daet'],
  'Camarines Sur': ['Iriga City', 'Naga City', 'Pili'],
  'Catanduanes': ['Virac'],
  'Masbate': ['Masbate City'],
  'Sorsogon': ['Sorsogon City'],
  // Region VI
  'Aklan': ['Kalibo'],
  'Antique': ['San José de Buenavista'],
  'Capiz': ['Roxas City'],
  'Guimaras': ['Jordan'],
  'Iloilo': ['Iloilo City', 'Passi City'],
  'Negros Occidental': ['Bacolod City', 'Bago City', 'Cadiz City', 'Escalante City', 'Himamaylan City', 'Kabankalan City', 'La Carlota City', 'La Paz', 'Sagay City', 'San Carlos City', 'Silay City', 'Sipalay City', 'Talisay City', 'Victorias City'],
  // Region VII
  'Bohol': ['Tagbilaran City'],
  'Cebu': ['Cebu City', 'Danao City', 'Lapu-Lapu City', 'Mandaue City', 'Toledo City'],
  'Negros Oriental': ['Bais City', 'Bayawan City', 'Canlaon City', 'Dumaguete City', 'Guihulngan City', 'Tanjay City'],
  'Siquijor': ['Siquijor'],
  // Region VIII
  'Biliran': ['Naval'],
  'Eastern Samar': ['Borongan City'],
  'Leyte': ['Baybay City', 'Ormoc City', 'Tacloban City'],
  'Northern Samar': ['Catarman'],
  'Samar': ['Catbalogan City'],
  'Southern Leyte': ['Maasin City'],
  // Region IX
  'Zamboanga del Norte': ['Dipolog City', 'Koronadal City', 'Pagadian City'],
  'Zamboanga del Sur': ['Zamboanga City'],
  'Zamboanga Sibugay': ['Ipil'],
  // Region X
  'Bukidnon': ['Malaybalay City', 'Valencia City'],
  'Camiguin': ['Mambajao'],
  'Lanao del Norte': ['Iligan City'],
  'Misamis Occidental': ['Oroquieta City', 'Ozamis City', 'Tangub City'],
  'Misamis Oriental': ['Cagayan de Oro City', 'El Salvador City', 'Gingoog City'],
  // Region XI
  'Compostela Valley': ['Compostela', 'Nabunturan'],
  'Davao de Oro': ['Compostela', 'Nabunturan'],
  'Davao del Norte': ['Panabo City', 'Samal City', 'Tagum City'],
  'Davao del Sur': ['Davao City', 'Digos City'],
  'Davao Occidental': ['Malita'],
  'Davao Oriental': ['Mati City'],
  // Region XII
  'Cotabato': ['Kidapawan City'],
  'Sarangani': ['Alabel'],
  'South Cotabato': ['General Santos City', 'Koronadal City', 'Polomolok', 'Santo Niño'],
  'Sultan Kudarat': ['Isulan', 'Tacurong City'],
  // Region XIII
  'Agusan del Norte': ['Butuan City', 'Cabadbaran City'],
  'Agusan del Sur': ['Bayugan City', 'Prosperidad'],
  'Dinagat Islands': ['San José'],
  'Surigao del Norte': ['Surigao City'],
  'Surigao del Sur': ['Bislig City', 'Tandag City'],
  // CAR
  'Abra': ['Bangued'],
  'Apayao': ['Calamayor'],
  'Benguet': ['Baguio City', 'La Trinidad'],
  'Ifugao': ['Lagawe'],
  'Kalinga': ['Tabuk City'],
  'Mountain Province': ['Bontoc'],
  // BARMM
  'Basilan': ['Isabela City'],
  'Lanao del Sur': ['Marawi City'],
  'Maguindanao del Norte': ['Cotabato City'],
  'Maguindanao del Sur': ['Shariff Aguak'],
  'Sulu': ['Jolo'],
  'Tawi-Tawi': ['Bongao'],
}

// ---------------------------------------------------------------------------
// Divisions (Schools Divisions) by Region
// ---------------------------------------------------------------------------

export const DIVISIONS = {
  'NCR': ['NCR, City of Manila, First District', 'NCR, Second District', 'NCR, Third District', 'NCR, Fourth District'],
  'Region I': ['Ilocos Norte Division', 'Ilocos Sur Division', 'La Union Division', 'Pangasinan I Division', 'Pangasinan II Division', 'Pangasinan III Division'],
  'Region II': ['Batanes Division', 'Cagayan Division', 'Isabela I Division', 'Isabela II Division', 'Nueva Vizcaya Division', 'Quirino Division'],
  'Region III': ['Aurora Division', 'Bataan Division', 'Bulacan Division', 'Nueva Ecija I Division', 'Nueva Ecija II Division', 'Pampanga Division', 'Tarlac Division', 'Zambales I Division', 'Zambales II Division'],
  'Region IV-A': ['Batangas Division', 'Cavite Division', 'Laguna Division', 'Quezon Division', 'Rizal Division'],
  'Region IV-B': ['Marinduque Division', 'Occidental Mindoro Division', 'Oriental Mindoro Division', 'Palawan Division', 'Romblon Division'],
  'Region V': ['Albay Division', 'Camarines Norte Division', 'Camarines Sur I Division', 'Camarines Sur II Division', 'Catanduanes Division', 'Masbate Division', 'Sorsogon Division'],
  'Region VI': ['Aklan Division', 'Antique Division', 'Capiz Division', 'Guimaras Division', 'Iloilo Division', 'Iloilo City Division', 'Negros Occidental Division'],
  'Region VII': ['Bohol Division', 'Cebu Province Division', 'Cebu City Division', 'Negros Oriental Division', 'Siquijor Division'],
  'Region VIII': ['Biliran Division', 'Eastern Samar Division', 'Leyte Division', 'Northern Samar Division', 'Samar Division', 'Southern Leyte Division'],
  'Region IX': ['Zamboanga del Norte Division', 'Zamboanga del Sur I Division', 'Zamboanga del Sur II Division', 'Zamboanga Sibugay Division'],
  'Region X': ['Bukidnon I Division', 'Bukidnon II Division', 'Camiguin Division', 'Lanao del Norte Division', 'Misamis Occidental I Division', 'Misamis Occidental II Division', 'Misamis Oriental I Division', 'Misamis Oriental II Division'],
  'Region XI': ['Compostela Valley Division', 'Davao de Oro Division', 'Davao del Norte Division', 'Davao del Sur Division', 'Davao Oriental Division', 'Davao Occidental Division'],
  'Region XII': ['Cotabato Division', 'Sarangani Division', 'South Cotabato Division', 'Sultan Kudarat Division'],
  'Region XIII': ['Agusan del Norte Division', 'Agusan del Sur Division', 'Dinagat Islands Division', 'Surigao del Norte Division', 'Surigao del Sur Division'],
  'CAR': ['Abra Division', 'Apayao Division', 'Benguet Division', 'Ifugao Division', 'Kalinga Division', 'Mountain Province Division'],
  'BARMM': ['Basilan Division', 'Lanao del Sur Division', 'Maguindanao del Norte Division', 'Maguindanao del Sur Division', 'Sulu Division', 'Tawi-Tawi Division'],
}

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