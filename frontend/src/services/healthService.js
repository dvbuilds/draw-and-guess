import { api } from './api.js';

/**
 * Queries GET /api/health and returns the unwrapped backend health payload.
 */
export async function getHealthStatus() {
  const response = await api.get('/health');
  return response.data?.data ?? response.data;
}
