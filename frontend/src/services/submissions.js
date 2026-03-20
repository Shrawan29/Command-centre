import { apiRequest } from './api.js';

export function submitWeeklyData(payload) {
  return apiRequest('/api/submissions', { method: 'POST', body: payload });
}

export function getKPIProgress(kpiId) {
  return apiRequest(`/api/submissions/${kpiId}`);
}

export function sendKPIReport(kpiId) {
  return apiRequest(`/api/submissions/report/${kpiId}`);
}

export function getAdminSubmissions(filters = {}) {
  const params = new URLSearchParams();

  if (filters.week) params.set('week', filters.week);
  if (filters.vendorId) params.set('vendorId', filters.vendorId);
  if (filters.kpiId) params.set('kpiId', filters.kpiId);
  if (filters.verticalId) params.set('verticalId', filters.verticalId);

  const query = params.toString();
  return apiRequest(`/api/submissions/admin${query ? `?${query}` : ''}`);
}
