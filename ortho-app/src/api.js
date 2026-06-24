const DEV_BACKEND = "http://127.0.0.1:8000";

export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV ? DEV_BACKEND : window.location.origin);

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  return response;
}
