const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');

const machinesRoutes = require('./routes/machines.routes');
const vosfacturesRoutes = require('./routes/vosfactures.routes');

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: config.corsOrigin.length > 0 ? config.corsOrigin : false,
  credentials: true,
}));

// Petit log simple des requêtes
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

app.get('/api/ping', (req, res) => {
  res.json({ ok: true, service: 'ddvs-motoculture-backend', env: config.env });
});

app.use('/api/machines', machinesRoutes);
app.use('/api', vosfacturesRoutes); // expose /api/sync, /api/sync/last, /api/invoices, /api/health

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// Gestion d'erreurs centralisée
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erreur interne' });
});

module.exports = app;
