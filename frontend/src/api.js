const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function req(path, options = {}) {
  const r = await fetch(API + path, options);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || 'API request failed');
  return d;
}

export const api = {
  health: () => req('/api/health'),
  extract: (fd) => req('/api/extract', { method: 'POST', body: fd }),
  chat: (fd) => req('/api/chat', { method: 'POST', body: fd }),
  analyze: (p) =>
    req('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    }),
  save: (p) =>
    req('/api/investigations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    }),
  list: () => req('/api/investigations'),
  get: (id) => req('/api/investigations/' + id),
};
