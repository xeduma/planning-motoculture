const db = require('../db');
const vosfactures = require('./vosfactures.client');

/**
 * Normalise une facture reçue de l'API VosFactures.
 * La forme exacte de la réponse sera confirmée plus tard ; ce mapping
 * est volontairement tolérant (plusieurs noms de champs possibles).
 */
function normalizeInvoice(raw) {
  const id = String(raw.id ?? raw.invoice_id ?? raw.number ?? '');
  const number = raw.number ?? raw.invoice_number ?? null;
  const clientName = raw.client_name ?? raw.client?.name ?? raw.buyer_name ?? null;
  const amount = Number(raw.amount ?? raw.total ?? raw.price_gross ?? 0);
  const paid = Boolean(
    raw.paid === true ||
    raw.status === 'paid' ||
    raw.payment_state === 'paid' ||
    raw.paid_amount >= amount
  );
  return { id, number, clientName, amount, paid, raw };
}

async function runSync() {
  const logStmt = db.prepare(`
    INSERT INTO sync_log (started_at, success) VALUES (datetime('now'), 0)
  `);
  const logInfo = logStmt.run();
  const syncLogId = logInfo.lastInsertRowid;

  try {
    // 1. Déclenche la synchronisation côté API VosFactures
    await vosfactures.triggerSync();

    // 2. Récupère la liste des factures à jour
    const invoicesResponse = await vosfactures.fetchInvoices();
    const rawInvoices = Array.isArray(invoicesResponse)
      ? invoicesResponse
      : invoicesResponse?.invoices ?? invoicesResponse?.data ?? [];

    const upsertInvoice = db.prepare(`
      INSERT INTO invoices_cache (id, number, client_name, amount, paid, raw_json, fetched_at)
      VALUES (@id, @number, @clientName, @amount, @paid, @rawJson, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        number = excluded.number,
        client_name = excluded.client_name,
        amount = excluded.amount,
        paid = excluded.paid,
        raw_json = excluded.raw_json,
        fetched_at = excluded.fetched_at
    `);

    const updateMachineFromInvoice = db.prepare(`
      UPDATE machines
      SET invoice_paid = @paid,
          status = CASE
            WHEN @paid = 1 AND status_manual_override = 0 THEN 'termine'
            ELSE status
          END,
          updated_at = datetime('now')
      WHERE invoice_id = @invoiceId
    `);

    let invoicesSynced = 0;
    let machinesUpdated = 0;

    const tx = db.transaction((invoices) => {
      for (const rawInvoice of invoices) {
        const inv = normalizeInvoice(rawInvoice);
        if (!inv.id) continue;

        upsertInvoice.run({
          id: inv.id,
          number: inv.number,
          clientName: inv.clientName,
          amount: inv.amount,
          paid: inv.paid ? 1 : 0,
          rawJson: JSON.stringify(inv.raw),
        });
        invoicesSynced += 1;

        const result = updateMachineFromInvoice.run({
          paid: inv.paid ? 1 : 0,
          invoiceId: inv.id,
        });
        machinesUpdated += result.changes;
      }
    });

    tx(rawInvoices);

    // 3. Vérifie l'état de santé de l'API après synchronisation
    const health = await vosfactures.fetchHealth();

    db.prepare(`
      UPDATE sync_log
      SET finished_at = datetime('now'),
          success = 1,
          invoices_synced = @invoicesSynced,
          machines_updated = @machinesUpdated
      WHERE id = @id
    `).run({ id: syncLogId, invoicesSynced, machinesUpdated });

    return {
      success: true,
      invoicesSynced,
      machinesUpdated,
      health,
    };
  } catch (error) {
    db.prepare(`
      UPDATE sync_log
      SET finished_at = datetime('now'), success = 0, error_message = @error
      WHERE id = @id
    `).run({ id: syncLogId, error: error.message });

    throw error;
  }
}

function getLastSync() {
  return db.prepare(`SELECT * FROM sync_log ORDER BY id DESC LIMIT 1`).get();
}

module.exports = { runSync, getLastSync };
