let backendOriginCache = null;
let backendOriginPromise = null;

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function isLocalDevHost(hostname) {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function buildCandidateOrigins() {
  const origin = window.location.origin;
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;

  const candidates = [];

  // Always try the exact current origin first.
  candidates.push(origin);

  // Only try alternate local origins when useful.
  // If you are already on port 3000, current origin should be enough.
  // If you are on 5500, try the backend on 3000 next.
  if (isLocalDevHost(hostname) && port === "5500") {
    if (hostname === "127.0.0.1") {
      candidates.push(`${protocol}//127.0.0.1:3000`);
      candidates.push(`${protocol}//localhost:3000`);
    } else if (hostname === "localhost") {
      candidates.push(`${protocol}//localhost:3000`);
      candidates.push(`${protocol}//127.0.0.1:3000`);
    }
  }

  return unique(candidates);
}

async function probeOrigin(origin) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);

  try {
    const res = await fetch(`${origin}/health`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal
    });

    if (!res.ok) {
      return false;
    }

    const data = await res.json().catch(function () {
      return null;
    });

    return !!(data && data.ok);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getBackendOrigin(forceRefresh = false) {
  if (!forceRefresh && backendOriginCache) {
    return backendOriginCache;
  }

  if (!forceRefresh && backendOriginPromise) {
    return backendOriginPromise;
  }

  backendOriginPromise = (async function () {
    const candidates = buildCandidateOrigins();

    for (const origin of candidates) {
      const ok = await probeOrigin(origin);
      if (ok) {
        backendOriginCache = origin;
        return origin;
      }
    }

    throw new Error("No working backend found. Start the Express server on the same origin, or on port 3000 if you are using port 5500 for the HTML page.");
  })();

  try {
    return await backendOriginPromise;
  } finally {
    backendOriginPromise = null;
  }
}

export async function apiFetch(path, options = {}, allowRediscover = true) {
  const origin = await getBackendOrigin();
  const url = `${origin}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    const res = await fetch(url, {
      credentials: "include",
      ...options
    });

    return { res, origin };
  } catch (err) {
    if (!allowRediscover) {
      throw err;
    }

    backendOriginCache = null;

    const refreshedOrigin = await getBackendOrigin(true);
    const refreshedUrl = `${refreshedOrigin}${path.startsWith("/") ? path : `/${path}`}`;

    const res = await fetch(refreshedUrl, {
      credentials: "include",
      ...options
    });

    return { res, origin: refreshedOrigin };
  }
}