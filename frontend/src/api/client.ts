const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

function json(body: unknown): RequestInit {
  return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export const api = {
  capture: (sampleId: string) =>
    request<{ filename: string; path: string }>('/capture', { method: 'POST', ...json({ sample_id: sampleId }) }),

  startRecording: (sampleId: string) =>
    request<{ filename: string }>('/record/start', { method: 'POST', ...json({ sample_id: sampleId }) }),

  stopRecording: () => request<{ ok: boolean }>('/record/stop', { method: 'POST' }),

  startInterval: (sampleId: string) =>
    request<{ ok: boolean }>('/interval/start', { method: 'POST', ...json({ sample_id: sampleId }) }),

  stopInterval: () => request<{ ok: boolean }>('/interval/stop', { method: 'POST' }),

  getStorage: () => request<unknown>('/storage'),
  getCounter: () => request<unknown>('/counter'),
  getFiles: () => request<unknown>('/files'),
  getFolder: (date: string) => request<unknown>(`/files/${date}`),
  getSettings: () => request<unknown>('/settings'),

  updateSettings: (settings: Partial<unknown>) =>
    request<unknown>('/settings', { method: 'PUT', ...json(settings) }),

  deleteFile: (date: string, filename: string) =>
    request<{ ok: boolean }>(`/files/${date}/${filename}`, { method: 'DELETE' }),

  fileUrl: (path: string) => `${BASE}/files/${path}`,
  // Vite's proxy buffers streaming responses, so bypass it directly for MJPEG
  streamUrl: () => import.meta.env.DEV
    ? `http://${window.location.hostname}:8000/api/stream`
    : `${BASE}/stream`,
  zipUrl: (date?: string) => date ? `${BASE}/files/${date}/download/zip` : `${BASE}/download/zip`,
  csvUrl: (date?: string) => date ? `${BASE}/files/${date}/export/csv` : `${BASE}/export/csv`,
}
