const express = require('express');
const db = require('../db');
const { calculateAutoUrgency, URGENCY_META } = require('../services/urgency.service');

const router = express.Router();

function serializeMachine(row) {
  return {
    id: row.id,
    clientName: row.client_name,
    clientType: row.client_type,
    machineType: row.machine_type,
    machineLabel: row.machine_label,
    repairType: row.repair_type,
    isOccasion: !!row.is_occasion,
    description: row.description,
    depositDate: row.deposit_date,
    status: row.status,
    statusManualOverride: !!row.status_manual_override,
    urgencyLevel: row.urgency_level,
    urgencyManualOverride: !!row.urgency_manual_override,
    urgencyMeta: URGENCY_META[row.urgency_level],
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    invoicePaid: !!row.invoice_paid,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/machines?status=en_attente
router.get('/', (req, res) => {
  const { status } = req.query;
  let rows;
  if (status) {
    rows = db.prepare(`
      SELECT * FROM machines WHERE status = ?
      ORDER BY urgency_level ASC, deposit_date ASC
    `).all(status);
  } else {
    rows = db.prepare(`
      SELECT * FROM machines
      ORDER BY urgency_level ASC, deposit_date ASC
    `).all();
  }
  res.json(rows.map(serializeMachine));
});

// GET /api/machines/:id
router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM machines WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Machine introuvable' });
  res.json(serializeMachine(row));
});

// POST /api/machines - créer une nouvelle entrée dans la file d'attente
router.post('/', (req, res) => {
  const {
    clientName,
    clientType = 'particulier',
    machineType,
    machineLabel,
    repairType = 'reparation',
    isOccasion = false,
    description,
    depositDate,
    invoiceId,
    invoiceNumber,
    urgencyLevel, // optionnel : si fourni, considéré comme un override manuel
  } = req.body;

  if (!clientName || !machineType || !depositDate) {
    return res.status(400).json({
      error: 'Champs requis manquants : clientName, machineType, depositDate',
    });
  }

  const autoUrgency = calculateAutoUrgency({ clientType, repairType, isOccasion });
  const finalUrgency = urgencyLevel ?? autoUrgency;
  const manualOverride = urgencyLevel != null && urgencyLevel !== autoUrgency;

  const info = db.prepare(`
    INSERT INTO machines (
      client_name, client_type, machine_type, machine_label, repair_type,
      is_occasion, description, deposit_date, urgency_level, urgency_manual_override,
      invoice_id, invoice_number
    ) VALUES (
      @clientName, @clientType, @machineType, @machineLabel, @repairType,
      @isOccasion, @description, @depositDate, @urgencyLevel, @manualOverride,
      @invoiceId, @invoiceNumber
    )
  `).run({
    clientName,
    clientType,
    machineType,
    machineLabel: machineLabel ?? null,
    repairType,
    isOccasion: isOccasion ? 1 : 0,
    description: description ?? null,
    depositDate,
    urgencyLevel: finalUrgency,
    manualOverride: manualOverride ? 1 : 0,
    invoiceId: invoiceId ?? null,
    invoiceNumber: invoiceNumber ?? null,
  });

  const row = db.prepare(`SELECT * FROM machines WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json(serializeMachine(row));
});

// PATCH /api/machines/:id - mise à jour générique (statut, description, infos facture...)
router.patch('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM machines WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Machine introuvable' });

  const allowed = [
    'client_name', 'client_type', 'machine_type', 'machine_label',
    'repair_type', 'is_occasion', 'description', 'deposit_date',
    'invoice_id', 'invoice_number',
  ];
  const fieldsMap = {
    clientName: 'client_name', clientType: 'client_type', machineType: 'machine_type',
    machineLabel: 'machine_label', repairType: 'repair_type', isOccasion: 'is_occasion',
    description: 'description', depositDate: 'deposit_date',
    invoiceId: 'invoice_id', invoiceNumber: 'invoice_number',
  };

  const updates = {};
  for (const [key, column] of Object.entries(fieldsMap)) {
    if (req.body[key] !== undefined && allowed.includes(column)) {
      updates[column] = key === 'isOccasion' ? (req.body[key] ? 1 : 0) : req.body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Aucun champ valide à mettre à jour' });
  }

  const setClause = Object.keys(updates).map((col) => `${col} = @${col}`).join(', ');
  db.prepare(`UPDATE machines SET ${setClause}, updated_at = datetime('now') WHERE id = @id`)
    .run({ ...updates, id: req.params.id });

  const updated = db.prepare(`SELECT * FROM machines WHERE id = ?`).get(req.params.id);
  res.json(serializeMachine(updated));
});

// PATCH /api/machines/:id/status - changer le statut manuellement (ex: terminé)
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['en_attente', 'en_cours', 'termine'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status doit être l'un de : ${validStatuses.join(', ')}` });
  }

  const row = db.prepare(`SELECT * FROM machines WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Machine introuvable' });

  db.prepare(`
    UPDATE machines
    SET status = @status, status_manual_override = 1, updated_at = datetime('now')
    WHERE id = @id
  `).run({ status, id: req.params.id });

  const updated = db.prepare(`SELECT * FROM machines WHERE id = ?`).get(req.params.id);
  res.json(serializeMachine(updated));
});

// PATCH /api/machines/:id/urgency - modifier le facteur d'urgence à la main
router.patch('/:id/urgency', (req, res) => {
  const { urgencyLevel } = req.body;
  if (![1, 2, 3].includes(urgencyLevel)) {
    return res.status(400).json({ error: 'urgencyLevel doit être 1, 2 ou 3' });
  }

  const row = db.prepare(`SELECT * FROM machines WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Machine introuvable' });

  db.prepare(`
    UPDATE machines
    SET urgency_level = @urgencyLevel, urgency_manual_override = 1, updated_at = datetime('now')
    WHERE id = @id
  `).run({ urgencyLevel, id: req.params.id });

  const updated = db.prepare(`SELECT * FROM machines WHERE id = ?`).get(req.params.id);
  res.json(serializeMachine(updated));
});

// DELETE /api/machines/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare(`DELETE FROM machines WHERE id = ?`).run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Machine introuvable' });
  res.status(204).send();
});

module.exports = router;
