require('dotenv').config();

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  return value;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: parseInt(process.env.PORT || '8410', 10),
  corsOrigin: (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),

  db: {
    path: process.env.DB_PATH || './data/ddvs.db',
  },

  vosfactures: {
    baseUrl: required('VOSFACTURES_API_BASE_URL', 'http://localhost:8402'),
    token: required('VOSFACTURES_API_TOKEN', ''),
    routes: {
      sync: required('VOSFACTURES_ROUTE_SYNC', '/sync'),
      invoices: required('VOSFACTURES_ROUTE_INVOICES', '/invoices'),
      health: required('VOSFACTURES_ROUTE_HEALTH', '/health'),
    },
    cacheDb: {
      host: process.env.VOSFACTURES_CACHE_DB_HOST || '',
      port: process.env.VOSFACTURES_CACHE_DB_PORT || '',
      name: process.env.VOSFACTURES_CACHE_DB_NAME || '',
      user: process.env.VOSFACTURES_CACHE_DB_USER || '',
      password: process.env.VOSFACTURES_CACHE_DB_PASSWORD || '',
    },
    httpTimeoutMs: parseInt(process.env.VOSFACTURES_HTTP_TIMEOUT_MS || '8000', 10),
  },

  syncCronSchedule: process.env.SYNC_CRON_SCHEDULE || '',
};

module.exports = config;
