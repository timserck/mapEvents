import { API_URL } from "../config";

/**
 * apiFetch - wrapper around fetch with token and 401 handling
 * @param {string} path - API endpoint path
 * @param {object} options - fetch options (method, headers, body, etc.)
 * @param {function} onUnauthorized - optional callback to call on 401
 */
export async function apiFetch(path, options = {}, onUnauthorized) {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Clear token and role
    localStorage.removeItem("token");
    localStorage.removeItem("role");

    // Call optional logout callback from React context
    if (typeof onUnauthorized === "function") {
      onUnauthorized();
    } else {
      // Fallback: redirect
      window.location.href = "/";
    }

    return null;
  }

  return res;
}
