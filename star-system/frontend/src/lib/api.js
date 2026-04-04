const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.detail ?? `Request failed: ${res.status}`)
    err.status = res.status
    err.data   = body
    throw err
  }
  return res.json()
}

export const getSummary      = () => request('/analytics/summary')
export const getRegions      = () => request('/analytics/regions')
export const getRegionDetail = (region) => request(`/analytics/regions/${encodeURIComponent(region)}`)

export const getTeachers = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  ).toString()
  return request(`/teachers${qs ? `?${qs}` : ''}`)
}
export const getTeacher      = (id) => request(`/teachers/${id}`)
export const registerTeacher = (payload) =>
  request('/teachers', { method: 'POST', body: JSON.stringify(payload) })

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

export const getImportLogs = () => request('/import/logs')

export const exportCSV = (region = '') => {
  const qs = region ? `?region=${encodeURIComponent(region)}` : ''
  window.open(`${BASE}/analytics/export/csv${qs}`, '_blank')
}