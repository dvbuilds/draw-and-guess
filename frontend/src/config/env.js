const stripTrailingSlash = (url) => url.replace(/\/+$/, '');

export const env = {
  API_BASE_URL: stripTrailingSlash(
    import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5000/api'
  ),
  SOCKET_URL: stripTrailingSlash(
    import.meta.env?.VITE_SOCKET_URL || 'http://localhost:5000'
  ),
};
