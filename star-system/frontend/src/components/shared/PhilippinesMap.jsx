import { useEffect, useRef, useState } from 'react'

const PROVINCE_CODES = [
  '100000000',  '200000000',  '300000000',  '400000000',  '500000000',
  '600000000',  '700000000',  '800000000',  '900000000',  '1000000000',
  '1100000000', '1200000000', '1300000000', '1400000000', '1600000000',
  '1700000000', '1900000000',
]

const CITY_CODES = [
  '1001300000', '1001800000', '1003500000', '1004200000', '1004300000',
  '102800000',  '102900000',  '103300000',  '105500000',
  '1102300000', '1102400000', '1102500000', '1108200000', '1108600000',
  '1204700000', '1206300000', '1206500000', '1208000000',
  '1303900000', '1307400000', '1307500000', '1307600000',
  '1400100000', '1401100000', '1402700000', '1403200000', '1404400000', '1408100000',
  '1600200000', '1600300000', '1606700000', '1606800000', '1608500000',
  '1704000000', '1705100000', '1705200000', '1705300000', '1705900000',
  '1900700000', '1903600000', '1906600000', '1907000000', '1908700000',
  '1908800000', '1909900000',
  '200900000',  '201500000',  '203100000',  '205000000',  '205700000',
  '300800000',  '301400000',  '304900000',  '305400000',  '306900000',
  '307100000',  '307700000',
  '401000000',  '402100000',  '403400000',  '405600000',  '405800000',
  '500500000',  '501600000',  '501700000',  '502000000',  '504100000',  '506200000',
  '600400000',  '600600000',  '601900000',  '603000000',  '604500000',  '607900000',
  '701200000',  '702200000',  '704600000',  '706100000',
  '802600000',  '803700000',  '804800000',  '806000000',  '806400000',  '807800000',
  '907200000',  '907300000',  '908300000',  '990100000',
]

const GEOJSON_URLS = {
  regions:   '/geojson/regions.json',
  provinces: (code) => `/geojson/provinces/provdists-region-${code}.0.001.json`,
  cities:    (code) => `/geojson/cities/municities-provdist-${code}.0.001.json`,
}

const REGION_NAME_MAP = {
  'Region I (Ilocos Region)':                                'Region I',
  'Region II (Cagayan Valley)':                              'Region II',
  'Region III (Central Luzon)':                              'Region III',
  'Region IV-A (CALABARZON)':                                'Region IV-A',
  'Region V (Bicol Region)':                                 'Region V',
  'Region VI (Western Visayas)':                             'Region VI',
  'Region VII (Central Visayas)':                            'Region VII',
  'Region VIII (Eastern Visayas)':                           'Region VIII',
  'Region IX (Zamboanga Peninsula)':                         'Region IX',
  'Region X (Northern Mindanao)':                            'Region X',
  'Region XI (Davao Region)':                                'Region XI',
  'Region XII (SOCCSKSARGEN)':                               'Region XII',
  'National Capital Region (NCR)':                           'NCR',
  'Cordillera Administrative Region (CAR)':                  'CAR',
  'Region XIII (Caraga)':                                    'Region XIII',
  'MIMAROPA Region':                                         'Region IV-B',
  'Bangsamoro Autonomous Region In Muslim Mindanao (BARMM)': 'BARMM',
}

const GAP_COLORS = {
  high:     { fill: '#fca5a5', border: '#dc2626', selected: '#dc2626' },
  moderate: { fill: '#fcd34d', border: '#d97706', selected: '#d97706' },
  low:      { fill: '#86efac', border: '#16a34a', selected: '#16a34a' },
  none:     { fill: '#e2e8f0', border: '#94a3b8', selected: '#64748b' },
}

async function fetchMergedCodes(urlFn, codes) {
  const results = await Promise.all(
    codes.map(code =>
      fetch(urlFn(code))
        .then(r => r.json())
        .catch(() => null)
    )
  )
  return {
    type: 'FeatureCollection',
    features: results
      .filter(Boolean)
      .flatMap(fc => fc.features ?? []),
  }
}

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

function styleSubRegion(name, gapLookup) {
  const data   = gapLookup[name]
  const level  = data?.gap_level ?? 'none'
  const colors = GAP_COLORS[level]
  return {
    fillColor:   colors.fill,
    fillOpacity: data ? 0.7 : 0.4,
    color:       colors.border,
    weight:      0.8,
  }
}

export default function PhilippinesMap({
  regions   = [],
  provinces = [],
  cities    = [],
  onSelect,
  selected,
  compact = false,
}) {
  const mapRef         = useRef(null)
  const leafletRef     = useRef(null)
  const layersRef      = useRef({ regions: null, provinces: null, cities: null })
  const gapRef         = useRef({})
  const gapProvinceRef = useRef({})
  const gapCityRef     = useRef({})
  const [zoom, setZoom]       = useState(6)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState(null)

  // Sync gap data refs whenever props change
  useEffect(() => {
    const byRegion = {}
    regions.forEach(r => { byRegion[r.region] = r })
    gapRef.current = byRegion

    const byProvince = {}
    provinces.forEach(p => { byProvince[p.province] = p })
    gapProvinceRef.current = byProvince

    const byCity = {}
    cities.forEach(c => { byCity[c.city] = c })
    gapCityRef.current = byCity

    if (layersRef.current.regions) {
      layersRef.current.regions.setStyle(
        (feature) => styleRegion(feature, selected, gapRef.current)
      )
    }
    if (layersRef.current.provinces) {
      layersRef.current.provinces.setStyle((feature) => {
        const name = feature.properties.adm2_en || feature.properties.NAME_2 || ''
        return styleSubRegion(name, gapProvinceRef.current)
      })
    }
    if (layersRef.current.cities) {
      layersRef.current.cities.setStyle((feature) => {
        const name = feature.properties.adm3_en || feature.properties.NAME_3 || ''
        return styleSubRegion(name, gapCityRef.current)
      })
    }
  }, [regions, provinces, cities, selected])

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
      
      // Handle responsive resizing (for mobile orientation change, etc)
      const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize()
      })
      resizeObserver.observe(mapRef.current)

      Promise.all([
        fetch(GEOJSON_URLS.regions).then(r => r.json()).catch(err => { console.error('Failed to load regions GeoJSON:', err); throw err }),
        fetchMergedCodes(GEOJSON_URLS.provinces, PROVINCE_CODES).catch(err => { console.error('Failed to load provinces GeoJSON:', err); return { type: 'FeatureCollection', features: [] } }),
        fetchMergedCodes(GEOJSON_URLS.cities, CITY_CODES).catch(err => { console.error('Failed to load cities GeoJSON:', err); return { type: 'FeatureCollection', features: [] } }),
      ]).then(([regionsGeo, provincesGeo, citiesGeo]) => {

        // --- Region layer ---
        layersRef.current.regions = L.geoJSON(regionsGeo, {
          style: (feature) => styleRegion(feature, null, gapRef.current),
          onEachFeature: (feature, layer) => {
            const rawName   = getRegionName(feature.properties)
            const canonical = REGION_NAME_MAP[rawName] || rawName
            layer.on({
              mouseover: (e) => {
                e.target.setStyle({ weight: 2.5, fillOpacity: 0.9 })
                const data = gapRef.current[canonical]
                setTooltip({
                  name:  canonical,
                  sub:   false,
                  score: data ? Math.round(data.gap_score * 100) : null,
                  total: data?.total_teachers ?? 0,
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

        // --- Province layer ---
        layersRef.current.provinces = L.geoJSON(provincesGeo, {
          style: (feature) => {
            const name = feature.properties.adm2_en || feature.properties.NAME_2 || ''
            return styleSubRegion(name, gapProvinceRef.current)
          },
          onEachFeature: (feature, layer) => {
            const name = feature.properties.adm2_en || feature.properties.NAME_2 || 'Province'
            layer.on({
              mouseover: () => {
                const data = gapProvinceRef.current[name]
                setTooltip({
                  name,
                  sub:   !data,
                  score: data ? Math.round(data.gap_score * 100) : null,
                  total: data?.total_teachers ?? 0,
                })
              },
              mouseout: () => setTooltip(null),
            })
          },
        }).addTo(map)

        // --- City layer ---
        layersRef.current.cities = L.geoJSON(citiesGeo, {
          style: (feature) => {
            const name = feature.properties.adm3_en || feature.properties.NAME_3 || ''
            return styleSubRegion(name, gapCityRef.current)
          },
          onEachFeature: (feature, layer) => {
            const name = feature.properties.adm3_en || feature.properties.NAME_3 || 'City/Municipality'
            layer.on({
              mouseover: () => {
                const data = gapCityRef.current[name]
                setTooltip({
                  name,
                  sub:   !data,
                  score: data ? Math.round(data.gap_score * 100) : null,
                  total: data?.total_teachers ?? 0,
                })
              },
              mouseout: () => setTooltip(null),
            })
          },
        }).addTo(map)

        setLoading(false)

        // Force restyle after load in case gap data arrived first
        setTimeout(() => {
          if (layersRef.current.regions && Object.keys(gapRef.current).length > 0) {
            layersRef.current.regions.setStyle(
              (feature) => styleRegion(feature, null, gapRef.current)
            )
          }
          // Initial zoom layer visibility
          const { map } = leafletRef.current ?? {}
          const currentZoom = map?.getZoom() ?? (compact ? 5 : 6)
          setZoom(currentZoom)
        }, 300)

      }).catch(err => {
        console.error('GeoJSON load failed:', err)
        setLoading(false)
      })
    }).catch(err => {
      console.error('Failed to import Leaflet:', err)
      setLoading(false)
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
    if (!leafletRef.current?.map) return
    
    const map = leafletRef.current.map
    const { regions: rL, provinces: pL, cities: cL } = layersRef.current

    // If any layer is null, exit (they may not be loaded yet)
    if (!rL || !pL || !cL) return

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
    <div className="relative w-full" style={{ height: compact ? '300px' : '580px' }}>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10 rounded-xl">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-star-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Loading map data...</p>
          </div>
        </div>
      )}

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

      {!compact && (
        <div className="absolute bottom-3 left-3 z-20 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 shadow-sm">
          {zoom < 7  ? 'Viewing: Regions'
           : zoom < 10 ? 'Viewing: Provinces'
           : 'Viewing: Cities / municipalities'}
          <span className="text-slate-300 ml-1">· zoom {zoom}</span>
        </div>
      )}

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

      <div
        ref={mapRef}
        className="w-full rounded-xl overflow-hidden"
        style={{ height: '100%', zIndex: 0 }}
      />
    </div>
  )
}
