const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/v1';

const TOKEN_KEY = 'bos_admin_access_token';
const REFRESH_KEY = 'bos_admin_refresh_token';

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}
export function setTokens({ access_token: accessToken, refresh_token: refreshToken }) {
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}
export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let refreshingPromise = null;

async function tryRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshingPromise) {
    refreshingPromise = fetch(`${API_BASE_URL}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setTokens(data);
        return !!data;
      })
      .catch(() => false)
      .finally(() => {
        refreshingPromise = null;
      });
  }
  return refreshingPromise;
}

export async function apiFetch(path, { method = 'GET', body, auth = true, retry = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiFetch(path, { method, body, auth, retry: false });
  }

  if (res.status === 204) return null;

  let payload = null;
  try {
    payload = await res.json();
  } catch (err) {
    // resposta sem corpo JSON
  }

  if (!res.ok) {
    throw new ApiError(res.status, payload?.error, payload?.message || 'Erro inesperado');
  }
  return payload;
}

export const api = {
  get: (path, opts) => apiFetch(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => apiFetch(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => apiFetch(path, { ...opts, method: 'PUT', body }),
  delete: (path, opts) => apiFetch(path, { ...opts, method: 'DELETE' }),
};

// multipart/form-data — não usa apiFetch (que sempre serializa como JSON);
// Content-Type fica a cargo do navegador (inclui o boundary automaticamente).
export async function uploadFile(path, file) {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch (err) {
    // sem corpo JSON
  }

  if (!res.ok) {
    throw new ApiError(res.status, payload?.error, payload?.message || 'Erro ao enviar arquivo');
  }
  return payload;
}

export { ApiError };
