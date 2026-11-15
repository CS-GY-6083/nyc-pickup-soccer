// One helper for every call to the Express API.
//
//   const { games } = await api('/public/games', { params: { borough: 'Bronx' } });
//   await api('/player/games/12/join', { method: 'POST' });
//   await api('/auth/login', { method: 'POST', body: { email, password } });
//
// On an error response it throws an ApiError whose message is the
// server's readable text (e.g. "This game is full."), ready to show.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, params } = {}) {
  let url = `/api${path}`;
  if (params) {
    const filled = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (filled.length) url += `?${new URLSearchParams(filled)}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network failure: the API server is down or unreachable.
    throw new ApiError(0, 'Cannot reach the server. Please try again in a moment.');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // empty or non-JSON body
  }

  if (!response.ok) {
    // Session expired or logged out in another tab: tell AuthContext,
    // which clears the user so the page redirects to the login form.
    if (response.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw new ApiError(response.status, data?.error ?? `Request failed (${response.status}).`);
  }
  // Every API endpoint answers with JSON; anything else (e.g. an HTML
  // page because the API server is not running behind Vite) is an error.
  if (data === null) throw new ApiError(response.status, 'Unexpected response from the server.');
  return data;
}
