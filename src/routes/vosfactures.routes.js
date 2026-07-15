const express = require('express');
const db = require('../db');
const syncService = require('../services/sync.service');
const vosfactures = require('../services/vosfactures.client');

const router = express.Router();

// POST /api/sync -> déclenche la synchro complète (bouton "Synchroniser")
router.post('/sync', async (req, res) => {
  try {
    const result = await syncService.runSync();
    res.json(result);
  } catch (error) {
    res.status(502).json({
      error: 'Échec de la synchronisation avec VosFactures',
      details: error.message,
    });
  }
});

// GET /api/sync/last -> dernier résultat de synchronisation connu
router.get('/sync/last', (req, res) => {
  const last = syncService.getLastSync();
  res.json(last ?? null);
});

// GET /api/invoices -> factures en cache local (rempli par la sync)
router.get('/invoices', (req, res) => {
  const rows = db.prepare(`SELECT * FROM invoices_cache ORDER BY fetched_at DESC`).all();
  res.json(rows.map((r) => ({
    id: r.id,
    number: r.number,
    clientName: r.client_name,
    amount: r.amount,
    paid: !!r.paid,
    fetchedAt: r.fetched_at,
  })));
});

// GET /api/health -> statut de l'API VosFactures (appelé après synchronisation)
router.get('/health', async (req, res) => {
  try {
    const health = await vosfactures.fetchHealth();
    const lastSync = syncService.getLastSync();
    res.json({
      vosfacturesApi: { reachable: true, ...(typeof health === 'object' ? health : { raw: health }) },
      lastSync,
    });
  } catch (error) {
    const lastSync = syncService.getLastSync();
    res.status(503).json({
      vosfacturesApi: { reachable: false, error: error.message },
      lastSync,
    });
  }
});

module.exports = router;
