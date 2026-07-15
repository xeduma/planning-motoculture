const config = require('../config');

function buildUrl(route) {
  const base = config.vosfactures.baseUrl.replace(/\/$/, '');
  const path = route.startsWith('/') ? route : `/${route}`;
  return `${base}${path}`;
}

async function callApi(route, { method = 'GET', body } = {}) {
  const url = buildUrl(route);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.vosfactures.httpTimeoutMs);

  const headers = { 'Content-Type': 'application/json' };
  if (config.vosfactures.token) {
    headers.Authorization = `Bearer ${config.vosfactures.token}`;
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      const err = new Error(`VosFactures API a répondu ${res.status} sur ${url}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function triggerSync() {
  return callApi(config.vosfactures.routes.sync, { method: 'POST' });
}

async function fetchInvoices() {
  return callApi(config.vosfactures.routes.invoices, { method: 'GET' });
}

async function fetchHealth() {
  return callApi(config.vosfactures.routes.health, { method: 'GET' });
}

module.exports = { triggerSync, fetchInvoices, fetchHealth, buildUrl };
