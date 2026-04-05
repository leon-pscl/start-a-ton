/**
 * PhilippinesMap Interactive Map Component
 *
 * An interactive Leaflet-based map of the Philippines that displays
 * regional gap scores through color-coded overlays.
 *
 * Features:
 * - 3-level zoom hierarchy:
 *   - Zoom 5-6: Regions (colored by gap score)
 *   - Zoom 7-9: Provinces (grey boundary lines)
 *   - Zoom 10+: Cities/municipalities (grey boundary lines)
 * - Hover tooltips showing region details
 * - Click to select a region and trigger callback
 * - Color coding based on gap level (high/moderate/low)
 *
 * GeoJSON data is loaded from the faeldon/philippines-json-maps repository.
 */

import { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// GeoJSON Data Sources
// ---------------------------------------------------------------------------

/**
 * URLs for Philippine administrative boundary GeoJSON files.
 * Using low-resolution versions for better performance.
 */
const GEOJSON_URLS = {
  regions:   'https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/geojson/regions/low/regions-10m.0.001.json',
  provinces: 'https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/geojson/provinces/low/provinces-10m.0.001.json',
  cities:    'https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/geojson/municities/low/municities-10m.0.001.json',
}

// ---------------------------------------------------------------------------
// Region Name Mapping
// ---------------------------------------------------------------------------

/**
 * Maps GeoJSON region names to canonical system names.
 * The GeoJSON uses full names (e.g., "National Capital Region")
 * while the system uses abbreviations (e.g., "NCR").
 */
const REGION_NAME_MAP = {
  'National Capital Region': 'NCR',
  'Cordillera Administrative Region': 'CAR',
  'Ilocos Region': 'Region I',
  'Cagayan Valley': 'Region II',
  'Central Luzon': 'Region III',
  'CALABARZON': 'Region IV-A',
  'MIMAROPA': 'Region IV-B',
  'Bicol Region': 'Region V',
  'Western Visayas': 'Region VI',
  'Central Visayas': 'Region VII',
  'Eastern Visayas': 'Region VIII',
  'Zamboanga Peninsula': 'Region IX',
  'Northern Mindanao': 'Region X',
  'Davao Region': 'Region XI',
  'SOCCSKSARGEN': 'Region XII',
  'Caraga': 'Region XIII',
  'Bangsamoro': 'BARMM',
}

// ---------------------------------------------------------------------------
// Gap Level Colors
// ---------------------------------------------------------------------------

/**
 * Color scheme for gap levels.
 * - High (>=70%): Red tones - priority areas
 * - Moderate (40-69%): Amber tones - needs attention
 * - Low (<40%): Green tones - well-served
 * - None: Grey - no data
 */
const GAP_COLORS = {
  high:     { fill: '#fca5a5', border: '#dc2626', selected: '#dc2626' },
  moderate: { fill: '#fcd34d', border: '#d97706', selected: '#d97706' },
  low:      { fill: '#86efac', border: '#16a34a', selected: '#16a34a' },
  none:     { fill: '#e2e8f0', border: '#94a3b8', selected: '#64748b' },
}

// Grey styling for province/city layers (not data-driven)
const GREY = { fill: '#f1f5f9', border: '#cbd5e1' }

// ---------------------------------------------------------------------------
// Styling Helper Functions
// ---------------------------------------------------------------------------

/**
 * Generate Leaflet style object for a region feature.
 *
 * @param {object} feature - GeoJSON feature
 * @param {string|null} selected - Currently selected region name
 * @param {object} gapByRegion - Map of region names to gap data
 * @returns {object} Leaflet style object
 */
function styleRegion(feature, selected, gapByRegion) {
  // Extract region name from feature properties
  const rawName   = feature.properties.REGION || feature.properties.name || ''
  // Convert to canonical name
  const canonical = REGION_NAME_MAP[rawName] || rawName
  // Get gap data for this region
  const data      = gapByRegion[canonical]
  const level     = data?.gap_level ?? 'none'
  const colors    = GAP_COLORS[level]
  const isSel     = selected === canonical

  return {
    fillColor:   isSel ? colors.selected : colors.fill,
    fillOpacity: isSel ? 0.9 : 0.7,
    color:       isSel ? colors.selected : colors.border,
    weight:      isSel ? 2.5 : 1,
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * Interactive Philippines map component.
 *
 * @param {object} props
 * @param {Array} props.regions - Gap analysis data from API
 * @param {function} [props.onSelect] - Callback when region is clicked
 * @param {string|null} [props.selected] - Currently selected region
 * @param {boolean} [props.compact] - If true, renders in compact mode (smaller)
 */
export default function PhilippinesMap({ regions = [], onSelect, selected, compact = false }) {
  // Refs for Leaflet objects
  const mapRef     = useRef(null)        // DOM element for map
  const leafletRef = useRef(null)        // Leaflet map instance
  const layersRef  = useRef({ regions: null, provinces: null, cities: null })
  const gapRef     = useRef({})           // Gap data by region name

  // Component state
  const [zoom, setZoom]       = useState(6)      // Current zoom level
  const [loading, setLoading] = useState(true)   // GeoJSON loading state
  const [tooltip, setTooltip] = useState(null)    // Hover tooltip content

  // ---------------------------------------------------------------------------
  // Update gap data ref when regions prop changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const gapByRegion = {}
    regions.forEach(r => { gapByRegion[r.region] = r })
    gapRef.current = gapByRegion
  }, [regions])

  // ---------------------------------------------------------------------------
  // Initialize Leaflet map (runs once)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (leafletRef.current) return  // Already initialized

    // Dynamically import Leaflet (reduces bundle size)
    import('leaflet').then(L => {
      // Create map centered on Philippines
      const map = L.map(mapRef.current, {
        center: [12.5, 122.5],          // Center of Philippines
        zoom: compact ? 5 : 6,          // Initial zoom level
        zoomControl: !compact,          // Hide zoom control in compact mode
        scrollWheelZoom: true,          // Enable scroll zoom
        dragging: true,                 // Enable drag panning
        doubleClickZoom: true,          // Enable double-click zoom
        attributionControl: false,       // Hide attribution
      })

      // Add base tile layer (CartoDB Positron - clean, light style)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map)

      // Store references
      leafletRef.current = { map, L }

      // Track zoom level for layer switching
      map.on('zoomend', () => setZoom(map.getZoom()))

      // Load all three GeoJSON layers in parallel
      Promise.all([
        fetch(GEOJSON_URLS.regions).then(r => r.json()),
        fetch(GEOJSON_URLS.provinces).then(r => r.json()),
        fetch(GEOJSON_URLS.cities).then(r => r.json()),
      ]).then(([regionsGeo, provincesGeo, citiesGeo]) => {

        // ---------------------------------------------------------------
        // Create Region layer (interactive, colored by gap score)
        // ---------------------------------------------------------------
        layersRef.current.regions = L.geoJSON(regionsGeo, {
          style: (feature) => styleRegion(feature, null, gapRef.current),
          onEachFeature: (feature, layer) => {
            const rawName   = feature.properties.REGION || feature.properties.name || ''
            const canonical = REGION_NAME_MAP[rawName] || rawName

            // Add interactivity
            layer.on({
              // Hover: highlight and show tooltip
              mouseover: (e) => {
                e.target.setStyle({ weight: 2.5, fillOpacity: 0.9 })
                const data = gapRef.current[canonical]
                setTooltip({
                  name:  canonical,
                  level: data?.gap_level ?? 'none',
                  score: data ? Math.round(data.gap_score * 100) : null,
                  total: data?.total_teachers ?? 0,
                  sub:   false,   // Not a sub-region
                })
              },
              // Unhover: reset style
              mouseout: (e) => {
                layersRef.current.regions?.resetStyle(e.target)
                setTooltip(null)
              },
              // Click: select region
              click: () => onSelect?.(canonical),
            })
          },
        }).addTo(map)

        // ---------------------------------------------------------------
        // Create Province layer (grey boundaries only)
        // ---------------------------------------------------------------
        layersRef.current.provinces = L.geoJSON(provincesGeo, {
          style: { fillColor: GREY.fill, fillOpacity: 0.5, color: GREY.border, weight: 1 },
          onEachFeature: (feature, layer) => {
            const name = feature.properties.NAME_2 || feature.properties.name || 'Province'
            layer.on({
              mouseover: () => setTooltip({ name, sub: true }),
              mouseout:  () => setTooltip(null),
            })
          },
        })

        // ---------------------------------------------------------------
        // Create City/Municipality layer (grey boundaries only)
        // ---------------------------------------------------------------
        layersRef.current.cities = L.geoJSON(citiesGeo, {
          style: { fillColor: GREY.fill, fillOpacity: 0.4, color: GREY.border, weight: 0.5 },
          onEachFeature: (feature, layer) => {
            const name = feature.properties.NAME_3 || feature.properties.name || 'City/Municipality'
            layer.on({
              mouseover: () => setTooltip({ name, sub: true }),
              mouseout:  () => setTooltip(null),
            })
          },
        })

        setLoading(false)
      }).catch(err => {
        console.error('GeoJSON load failed:', err)
        setLoading(false)
      })
    })

    // Cleanup: remove map on unmount
    return () => {
      if (leafletRef.current?.map) {
        leafletRef.current.map.remove()
        leafletRef.current = null
      }
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Update region styling when gap data or selection changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const layer = layersRef.current.regions
    if (!layer) return
    layer.setStyle((feature) => styleRegion(feature, selected, gapRef.current))
  }, [regions, selected])

  // ---------------------------------------------------------------------------
  // Switch visible layers based on zoom level
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const { map } = leafletRef.current ?? {}
    const { regions: rL, provinces: pL, cities: cL } = layersRef.current
    if (!map || !rL || !pL || !cL) return

    // Zoom 10+: Show cities (most detailed)
    if (zoom >= 10) {
      if (!map.hasLayer(cL)) map.addLayer(cL)
      if (!map.hasLayer(pL)) map.addLayer(pL)
      if (map.hasLayer(rL))  map.removeLayer(rL)
    }
    // Zoom 7-9: Show provinces
    else if (zoom >= 7) {
      if (!map.hasLayer(pL)) map.addLayer(pL)
      if (map.hasLayer(cL))  map.removeLayer(cL)
      if (map.hasLayer(rL))  map.removeLayer(rL)
    }
    // Zoom 5-6: Show regions (default view)
    else {
      if (!map.hasLayer(rL)) map.addLayer(rL)
      if (map.hasLayer(pL))  map.removeLayer(pL)
      if (map.hasLayer(cL))  map.removeLayer(cL)
    }
  }, [zoom])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="relative w-full" style={{ height: compact ? 300 : 580 }}>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10 rounded-xl">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-star-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Loading map data...</p>
          </div>
        </div>
      )}

      {/* Hover tooltip - shows region name and stats */}
      {tooltip && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-xs flex items-center gap-2 whitespace-nowrap">
            <span className="font-medium text-slate-700">{tooltip.name}</span>
            {tooltip.sub ? (
              // Province/city tooltip - no data available
              <span className="text-slate-400">No teacher data at this level yet</span>
            ) : tooltip.score !== null ? (
              // Region tooltip - show gap score and teacher count
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">Gap: {tooltip.score}%</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">{tooltip.total} teachers</span>
              </>
            ) : (
              // No data for this region
              <span className="text-slate-400">No data</span>
            )}
          </div>
        </div>
      )}

      {/* Zoom level indicator (hidden in compact mode) */}
      {!compact && (
        <div className="absolute bottom-3 left-3 z-20 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 shadow-sm">
          {zoom < 7 ? 'Viewing: Regions'
            : zoom < 10 ? 'Viewing: Provinces'
            : 'Viewing: Cities / municipalities'}
          <span className="text-slate-300 ml-1">· zoom {zoom}</span>
        </div>
      )}

      {/* Legend (hidden in compact mode) */}
      {!compact && (
        <div className="absolute bottom-3 right-3 z-20 bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-2">Gap level</p>
          {[
            { label: 'High (>=70%)',       color: '#fca5a5' },
            { label: 'Moderate (40-69%)', color: '#fcd34d' },
            { label: 'Low (<40%)',         color: '#86efac' },
            { label: 'No data',            color: '#e2e8f0' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5 mb-1 last:mb-0">
              <span className="w-3 h-3 rounded-sm border border-slate-200 inline-block shrink-0"
                style={{ background: color }} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Map container - Leaflet renders here */}
      <div ref={mapRef} className="w-full h-full rounded-xl overflow-hidden" style={{ zIndex: 0 }} />
    </div>
  )
}