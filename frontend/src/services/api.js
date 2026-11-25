import axios from 'axios';
import { env } from '../config/env.js';

export function normalizeApiError(err) {
  const apiError = err?.response?.data?.error;
  if (apiError) {
    return {
      code: apiError.code || 'API_ERROR',
      message: apiError.message || 'Request failed',
      status: err.response.status,
    };
  }

  if (err?.request) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the backend server',
      status: 0,
    };
  }

  return {
    code: 'CLIENT_ERROR',
    message: err?.message || 'An unexpected error occurred',
    status: 0,
  };
}

export const api = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeApiError(error))
);
