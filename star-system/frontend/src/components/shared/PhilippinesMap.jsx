import { useEffect, useRef, useState } from 'react'

/**fetched from https://github.com/faeldon/philippines-json-maps **/

const REGION_CODES = [
  '100000000', '200000000', '300000000', '400000000',
  '500000000', '600000000', '700000000', '800000000',
  '900000000', '1000000000', '1100000000', '1200000000',
  '1300000000', '1400000000', '1600000000', '1700000000',
  '1900000000',
]

const GEOJSON_URLS = {
  regions:   '/geojson/regions.json',
  provinces: (code) => `/geojson/provinces/provdists-region-${code}.0.001.json`,
  cities:    (code) => `/geojson/cities/municities-region-${code}.0.001.json`,
}

// Helper to fetch and merge multiple GeoJSON files into one FeatureCollection
async function fetchMerged(urlFn) {
  const results = await Promise.all(
    REGION_CODES.map(code =>
      fetch(urlFn(code))
        .then(r => r.json())
        .catch(() => null)  // skip if file missing
    )
  )
  return {
    type: 'FeatureCollection',
    features: results
      .filter(Boolean)
      .flatMap(fc => fc.features ?? []),
  }
}
const REGION_NAME_MAP = {
  'Region I (Ilocos Region)':                          'Region I',
  'Region II (Cagayan Valley)':                        'Region II',
  'Region III (Central Luzon)':                        'Region III',
  'Region IV-A (CALABARZON)':                          'Region IV-A',
  'Region V (Bicol Region)':                           'Region V',
  'Region VI (Western Visayas)':                       'Region VI',
  'Region VII (Central Visayas)':                      'Region VII',
  'Region VIII (Eastern Visayas)':                     'Region VIII',
  'Region IX (Zamboanga Peninsula)':                   'Region IX',
  'Region X (Northern Mindanao)':                      'Region X',
  'Region XI (Davao Region)':                          'Region XI',
  'Region XII (SOCCSKSARGEN)':                         'Region XII',
  'National Capital Region (NCR)':                     'NCR',
  'Cordillera Administrative Region (CAR)':            'CAR',
  'Region XIII (Caraga)':                              'Region XIII',
  'MIMAROPA Region':                                   'Region IV-B',
  'Bangsamoro Autonomous Region In Muslim Mindanao (BARMM)': 'BARMM',
}

const GAP_COLORS = {
  high:     { fill: '#fca5a5', border: '#dc2626', selected: '#dc2626' },
  moderate: { fill: '#fcd34d', border: '#d97706', selected: '#d97706' },
  low:      { fill: '#86efac', border: '#16a34a', selected: '#16a34a' },
  none:     { fill: '#e2e8f0', border: '#94a3b8', selected: '#64748b' },
}

const GREY = { fill: '#f1f5f9', border: '#cbd5e1' }

function getRegionName(props) {
  return props.adm1_en || ''
}

function styleRegion(feature, selected, gapByRegion) {
  const rawName   = getRegionName(feature.properties)
  const canonical = REGION_NAME_MAP[rawName] || rawName
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

export default function PhilippinesMap({ regions = [], onSelect, selected, compact = false }) {
  const mapRef     = useRef(null)
  const leafletRef = useRef(null)
  const layersRef  = useRef({ regions: null, provinces: null, cities: null })
  const gapRef     = useRef({})
  const [zoom, setZoom]       = useState(6)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState(null)

  // Keep gapRef in sync with regions prop
  useEffect(() => {
    const gapByRegion = {}
    regions.forEach(r => { gapByRegion[r.region] = r })
    gapRef.current = gapByRegion

    // Restyle region layer whenever gap data updates
    if (layersRef.current.regions) {
      layersRef.current.regions.setStyle(
        (feature) => styleRegion(feature, selected, gapRef.current)
      )
    }
  }, [regions, selected])

  useEffect(() => {
    if (leafletRef.current) return

    import('leaflet').then(L => {
      const map = L.map(mapRef.current, {
        center: [12.5, 122.5],
        zoom: compact ? 5 : 6,
        zoomControl: !compact,
        scrollWheelZoom: true,
        dragging: true,
        doubleClickZoom: true,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map)

      leafletRef.current = { map, L }
      map.on('zoomend', () => setZoom(map.getZoom()))

      Promise.all([
        fetch(GEOJSON_URLS.regions).then(r => r.json()),
        fetchMerged(GEOJSON_URLS.provinces),
        fetchMerged(GEOJSON_URLS.cities),
    ]).then(([regionsGeo, provincesGeo, citiesGeo]) => {

        // --- Region layer ---
        layersRef.current.regions = L.geoJSON(regionsGeo, {
          style: (feature) => styleRegion(feature, null, gapRef.current),
          onEachFeature: (feature, layer) => {
            const props     = feature.properties
            const rawName   = getRegionName(props)
            const canonical = REGION_NAME_MAP[rawName] || rawName

            // Uncomment to debug property names:
            // console.log('Region props:', props)

            layer.on({
              mouseover: (e) => {
                e.target.setStyle({ weight: 2.5, fillOpacity: 0.9 })
                const data = gapRef.current[canonical]
                setTooltip({
                  name:  canonical,
                  level: data?.gap_level ?? 'none',
                  score: data ? Math.round(data.gap_score * 100) : null,
                  total: data?.total_teachers ?? 0,
                  sub:   false,
                })
              },
              mouseout: (e) => {
                layersRef.current.regions?.resetStyle(e.target)
                setTooltip(null)
              },
              click: () => onSelect?.(canonical),
            })
          },
        }).addTo(map)

        // --- Province layer (shown at zoom 7-9) ---
        layersRef.current.provinces = L.geoJSON(provincesGeo, {
          style: {
            fillColor:   GREY.fill,
            fillOpacity: 0.5,
            color:       GREY.border,
            weight:      1,
          },
          onEachFeature: (feature, layer) => {
            const name = feature.properties.NAME_2 ||
                         feature.properties.name    ||
                         'Province'
            layer.on({
              mouseover: () => setTooltip({ name, sub: true }),
              mouseout:  () => setTooltip(null),
            })
          },
        })

        // --- City layer (shown at zoom 10+) ---
        layersRef.current.cities = L.geoJSON(citiesGeo, {
          style: {
            fillColor:   GREY.fill,
            fillOpacity: 0.4,
            color:       GREY.border,
            weight:      0.5,
          },
          onEachFeature: (feature, layer) => {
            const name = feature.properties.NAME_3 ||
                         feature.properties.name    ||
                         'City/Municipality'
            layer.on({
              mouseover: () => setTooltip({ name, sub: true }),
              mouseout:  () => setTooltip(null),
            })
          },
        })

        setLoading(false)

        // Force restyle after load — gap data may have arrived before GeoJSON
        setTimeout(() => {
          if (layersRef.current.regions && Object.keys(gapRef.current).length > 0) {
            layersRef.current.regions.setStyle(
              (feature) => styleRegion(feature, null, gapRef.current)
            )
          }
        }, 300)

      }).catch(err => {
        console.error('GeoJSON load failed:', err)
        setLoading(false)
      })
    })

    return () => {
      if (leafletRef.current?.map) {
        leafletRef.current.map.remove()
        leafletRef.current = null
      }
    }
  }, [])

  // Show/hide layers based on zoom level
  useEffect(() => {
    const { map } = leafletRef.current ?? {}
    const { regions: rL, provinces: pL, cities: cL } = layersRef.current
    if (!map || !rL || !pL || !cL) return

    if (zoom >= 10) {
      if (!map.hasLayer(cL)) map.addLayer(cL)
      if (!map.hasLayer(pL)) map.addLayer(pL)
      if (map.hasLayer(rL))  map.removeLayer(rL)
    } else if (zoom >= 7) {
      if (!map.hasLayer(pL)) map.addLayer(pL)
      if (map.hasLayer(cL))  map.removeLayer(cL)
      if (map.hasLayer(rL))  map.removeLayer(rL)
    } else {
      if (!map.hasLayer(rL)) map.addLayer(rL)
      if (map.hasLayer(pL))  map.removeLayer(pL)
      if (map.hasLayer(cL))  map.removeLayer(cL)
    }
  }, [zoom])

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

      {/* Hover tooltip */}
      {tooltip && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-xs flex items-center gap-2 whitespace-nowrap">
            <span className="font-medium text-slate-700">{tooltip.name}</span>
            {tooltip.sub ? (
              <span className="text-slate-400">No teacher data at this level yet</span>
            ) : tooltip.score !== null ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">Gap: {tooltip.score}%</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">{tooltip.total} teachers</span>
              </>
            ) : (
              <span className="text-slate-400">No data</span>
            )}
          </div>
        </div>
      )}

      {/* Zoom level indicator */}
      {!compact && (
        <div className="absolute bottom-3 left-3 z-20 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 shadow-sm">
          {zoom < 7  ? 'Viewing: Regions'
           : zoom < 10 ? 'Viewing: Provinces'
           : 'Viewing: Cities / municipalities'}
          <span className="text-slate-300 ml-1">· zoom {zoom}</span>
        </div>
      )}

      {/* Legend */}
      {!compact && (
        <div className="absolute bottom-3 right-3 z-20 bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-2">Gap level</p>
          {[
            { label: 'High (>=70%)',      color: '#fca5a5' },
            { label: 'Moderate (40-69%)', color: '#fcd34d' },
            { label: 'Low (<40%)',         color: '#86efac' },
            { label: 'No data',            color: '#e2e8f0' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5 mb-1 last:mb-0">
              <span
                className="w-3 h-3 rounded-sm border border-slate-200 inline-block shrink-0"
                style={{ background: color }}
              />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Map container */}
      <div
        ref={mapRef}
        className="w-full h-full rounded-xl overflow-hidden"
        style={{ zIndex: 0 }}
      />
    </div>
  )
}