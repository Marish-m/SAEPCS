import axios from 'axios';

// When running under Vite dev server, /api is proxied to http://127.0.0.1:5000/api
// This eliminates cross-origin CORS, host mismatch (localhost vs 127.0.0.1), and IPv6 timeouts
const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Attach JWT Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('saepcs_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Transient Error Retry & 401 handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Retry once for transient 503 (database connecting) or temporary network failure
    if (
      config &&
      !config._retry &&
      (!error.response || error.response.status === 503) &&
      config.url !== '/health'
    ) {
      config._retry = true;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return apiClient(config);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
