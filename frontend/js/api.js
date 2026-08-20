const API_BASE = window.SOCIETY_HUB_API_BASE || 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('sh_token');
}

function setSession(token, user) {
  localStorage.setItem('sh_token', token);
  localStorage.setItem('sh_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('sh_token');
  localStorage.removeItem('sh_user');
}

function getUser() {
  const raw = localStorage.getItem('sh_user');
  return raw ? JSON.parse(raw) : null;
}

/**
 * Core request helper. Throws an Error with a human-readable `.message`
 * on any non-2xx response so callers can surface it directly in a toast.
 */
async function request(path, { method = 'GET', body, isFormData = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });
  } catch (networkErr) {
    // Network dropped mid-request (offline, server down, CORS, etc).
    throw new Error('Network error - could not reach the server. Please check your connection and try again.');
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message = (data && data.error && data.error.message) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return data;
}

const api = {
  // auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  me: () => request('/auth/me'),

  // complaints
  createComplaint: (formData) => request('/complaints', { method: 'POST', body: formData, isFormData: true }),
  myComplaints: (params = {}) => request(`/complaints/mine?${new URLSearchParams(params)}`),
  allComplaints: (params = {}) => request(`/complaints?${new URLSearchParams(params)}`),
  complaintDetail: (id) => request(`/complaints/${id}`),
  updateStatus: (id, status, note) => request(`/complaints/${id}/status`, { method: 'PATCH', body: { status, note } }),
  updatePriority: (id, priority) => request(`/complaints/${id}/priority`, { method: 'PATCH', body: { priority } }),
  metrics: () => request('/complaints/metrics'),

  // notices
  listNotices: () => request('/notices'),
  createNotice: (payload) => request('/notices', { method: 'POST', body: payload }),

  // admin settings
  getOverdueThreshold: () => request('/admin/settings/overdue-threshold'),
  setOverdueThreshold: (days) => request('/admin/settings/overdue-threshold', { method: 'PUT', body: { days } }),
};

window.ShAPI = { api, getToken, setSession, clearSession, getUser, API_BASE };
