// Refuse requests that change something (POST, PUT, PATCH, DELETE) when a
// browser says they come from another site. Together with the SameSite=Lax
// session cookie this blocks cross-site request forgery: another site can
// no longer make a logged-in visitor's browser join, leave or cancel games.
//
// Browsers send Sec-Fetch-Site on every request; older ones send Origin on
// POSTs. Requests with neither (curl, the tests, server-to-server) are not
// from a web page, so they are let through: they carry no visitor's cookie.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SAME_SITE_VALUES = new Set(['same-origin', 'none']); // 'none' = typed into the address bar

export function sameOriginOnly(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite) {
    return SAME_SITE_VALUES.has(fetchSite) ? next() : refuse(res);
  }

  const origin = req.get('origin');
  if (!origin) return next();
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return refuse(res);
  }
  return originHost === req.get('host') ? next() : refuse(res);
}

function refuse(res) {
  res.status(403).json({ error: 'This request came from another website, so it was refused.' });
}
