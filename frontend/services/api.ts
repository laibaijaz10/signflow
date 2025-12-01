const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';

export const getToken = () => localStorage.getItem('api_token') || '';
export const setToken = (t: string) => localStorage.setItem('api_token', t);

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) (headers as any).Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || res.statusText);
  return data;
}

export const AuthAPI = {
  async register(payload: { name: string; email: string; password: string; role?: 'admin'|'agent'|'client' }) {
    return apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  },
  async login(payload: { email: string; password: string }) {
    return apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
  },
  async me() {
    return apiFetch('/auth/me');
  },
  async googleVerify(body: { idToken: string; docId: string }) {
    return apiFetch('/auth/google-verify', { method: 'POST', body: JSON.stringify(body) });
  }
};

export const DocumentsAPI = {
  async list(params?: { status?: string; agentId?: string; clientId?: string }) {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiFetch(`/documents${query}`);
  },
  async get(id: string) {
    return apiFetch(`/documents/${id}`);
  },
  async getPublic(id: string, token: string) {
    const query = `?${new URLSearchParams({ token }).toString()}`;
    return apiFetch(`/documents/${id}/public${query}`);
  },
  async create(payload: any) {
    return apiFetch('/documents', { method: 'POST', body: JSON.stringify(payload) });
  },
  async sign(id: string, payload: { dataUrl: string; token: string }) {
    return apiFetch(`/documents/${id}/sign`, { method: 'POST', body: JSON.stringify(payload) });
  },
  async resend(id: string) {
    return apiFetch(`/documents/${id}/resend`, { method: 'POST' });
  },
  async delete(id: string) {
    return apiFetch(`/documents/${id}`, { method: 'DELETE' });
  }
};
