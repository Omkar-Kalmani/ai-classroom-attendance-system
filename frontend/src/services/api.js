import axios from 'axios';

// ─────────────────────────────────────────────────────────────
//  API Service
//  All HTTP calls to the Node.js backend go through here.
//  Base URL: http://localhost:5000/api
// ─────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
});

// ── Attach JWT token to every request automatically ────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Handle 401 (token expired) globally ───────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────────────────────────
//  Auth APIs
// ─────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data)  => api.post('/auth/register', data),
  login:    (data)  => api.post('/auth/login', data),
  getMe:    ()      => api.get('/auth/me'),
};

// ─────────────────────────────────────────────────────────────
//  Student Register APIs
// ─────────────────────────────────────────────────────────────
export const studentsAPI = {
  getAll: () => api.get('/students'),

  register: (formData) => api.post('/students/register', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  }),

  delete:          (id) => api.delete(`/students/${id}`),
  getEncodingStatus: (id) => api.get(`/students/${id}/status`),
};

// ─────────────────────────────────────────────────────────────
//  Sessions APIs
// ─────────────────────────────────────────────────────────────
export const sessionsAPI = {
  getAll: () => api.get('/sessions'),
  getOne: (id) => api.get(`/sessions/${id}`),
  getStatus: (id) => api.get(`/sessions/${id}/status`),

  create: (formData) => api.post('/sessions', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000, // 2 min for large video uploads
  }),

  process: (id) => api.post(`/sessions/${id}/process`),
  delete:  (id) => api.delete(`/sessions/${id}`),
};

// ─────────────────────────────────────────────────────────────
//  Results APIs
// ─────────────────────────────────────────────────────────────
export const resultsAPI = {
  getResults:   (sessionId)             => api.get(`/sessions/${sessionId}/results`),
  getStudent:   (sessionId, studentId)  => api.get(`/sessions/${sessionId}/results/${studentId}`),
  getAnalytics: (sessionId)             => api.get(`/sessions/${sessionId}/analytics`),
};

// ─────────────────────────────────────────────────────────────
//  Reports APIs
// ─────────────────────────────────────────────────────────────
export const reportsAPI = {
  downloadPDF: (sessionId) => api.get(`/sessions/${sessionId}/report/pdf`, { responseType: 'blob' }),
  downloadCSV: (sessionId) => api.get(`/sessions/${sessionId}/report/csv`, { responseType: 'blob' }),
};

// ─────────────────────────────────────────────────────────────
//  Dashboard API
// ─────────────────────────────────────────────────────────────
export const dashboardAPI = {
  getSummary: () => api.get('/dashboard/summary'),
};

export default api;
