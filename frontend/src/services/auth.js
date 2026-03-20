import { apiRequest } from './api.js';

export function loginWithPassword({ email, password }) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    userId: null,
  });
}
