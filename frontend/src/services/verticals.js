import { apiRequest } from './api.js';

export function getVerticals() {
  return apiRequest('/api/verticals');
}

export function getVerticalById(id) {
  return apiRequest(`/api/verticals/${id}`);
}

export function getVerticalDashboard(verticalId) {
  return apiRequest(`/api/dashboard/vertical/${verticalId}`);
}

export function createVertical(payload) {
  return apiRequest('/api/verticals', { method: 'POST', body: payload });
}

export function updateVertical(id, payload) {
  return apiRequest(`/api/verticals/${id}`, { method: 'PUT', body: payload });
}

export function deleteVertical(id) {
  return apiRequest(`/api/verticals/${id}`, { method: 'DELETE' });
}
