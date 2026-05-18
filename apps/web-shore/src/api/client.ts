const BASE = '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('access_token');
}

// Vessel selection is persisted in localStorage by VesselContext and read here
// so tenant-wide roles (TENANT_ADMIN, PURCHASE_MANAGER) can operate on a specific vessel.
const VESSEL_STORAGE_KEY = 'fleetops_selected_vessel';
function getSelectedVesselId(): string | null {
  return localStorage.getItem(VESSEL_STORAGE_KEY);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const vesselId = getSelectedVesselId();
  const hasBody = body !== undefined;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(vesselId ? { 'X-Vessel-Id': vesselId } : {}),
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) {
    localStorage.removeItem('access_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { message?: string | string[]; error?: string };
      if (json.message) {
        message = Array.isArray(json.message) ? json.message.join(', ') : json.message;
      } else if (json.error) {
        message = json.error;
      }
    } catch {
      // not JSON — use raw text
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),

  postForm: async <T>(path: string, form: FormData): Promise<T> => {
    const token = getToken();
    const vesselId = getSelectedVesselId();
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(vesselId ? { 'X-Vessel-Id': vesselId } : {}),
      },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  },
};
