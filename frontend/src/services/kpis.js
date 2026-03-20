import { apiRequest } from './api.js';

export function getKPIs() {
  return apiRequest('/api/kpis');
}

export function getMyKPIs() {
  return apiRequest('/api/kpis/my');
}

export function createKPI(payload) {
  return apiRequest('/api/kpis', { method: 'POST', body: payload });
}

export function updateKPI(id, payload) {
  return apiRequest(`/api/kpis/${id}`, { method: 'PUT', body: payload });
}

export function deleteKPI(id) {
  return apiRequest(`/api/kpis/${id}`, { method: 'DELETE' });
}
