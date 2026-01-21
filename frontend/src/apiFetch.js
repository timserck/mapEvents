import { API_URL } from "./config";

/**
 * apiFetch - wrapper around fetch with token and 401 handling
 * @param {string} path - API endpoint path
 * @param {object} options - fetch options (method, headers, body, etc.)
 * @param {function} onUnauthorized - optional callback to call on 401
 */
export async function apiFetch(path, options = {}, onUnauthorized) {
  const token = localStorage.getItem("token");

  console.log(options, 'options')

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    localStorage.clear();
    if (onUnauthorized) onUnauthorized();
    else window.location.href = "/mapEvents/";
    return null;
  }

  return res;
}

