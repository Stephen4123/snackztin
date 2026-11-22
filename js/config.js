/**
 * SnackzTin Global Client Configuration
 * Supports local development and deployed production (Firebase + Render backend).
 */
const DEFAULT_REMOTE_BACKEND = 'https://snackztin.onrender.com';

function getBackendBaseUrl() {
  if (typeof window === 'undefined') return DEFAULT_REMOTE_BACKEND;

  const { hostname, port } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '';

  if (isLocal) {
    // If running on local server port 3001, use relative paths
    if (port === '3001') return '';
    return 'http://localhost:3001';
  }

  if (window.__SNACKZTIN_BACKEND__) return window.__SNACKZTIN_BACKEND__;
  return DEFAULT_REMOTE_BACKEND;
}

function apiUrl(endpoint) {
  const base = getBackendBaseUrl();
  if (!endpoint) return base;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${clean}`;
}

function formatMediaUrl(url, fallback = '') {
  if (!url || typeof url !== 'string' || !url.trim()) return fallback || '';
  const clean = url.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:')) return clean;
  const cleanPath = clean.startsWith('/') ? clean : `/${clean}`;
  const base = getBackendBaseUrl();
  return `${base}${cleanPath}`;
}
