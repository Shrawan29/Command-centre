import { apiRequest } from './api.js';

export function getUsers() {
  return apiRequest('/api/users');
}

export function createUser(payload) {
  return apiRequest('/api/users', { method: 'POST', body: payload });
}

export function updateUser(id, payload) {
  return apiRequest(`/api/users/${id}`, { method: 'PUT', body: payload });
}

export function deleteUser(id) {
  return apiRequest(`/api/users/${id}`, { method: 'DELETE' });
}
