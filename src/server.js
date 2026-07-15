const app = require('./app');
const config = require('./config');
const cron = require('node-cron');
const syncService = require('./services/sync.service');

// IMPORTANT : on n'écoute jamais sur 0.0.0.0, uniquement en local.
// Nginx (443) fera le reverse-proxy vers ce port en interne.
app.listen(config.port, config.host, () => {
  console.log(`DDVS Motoculture backend démarré sur http://${config.host}:${config.port}`);
});

if (config.syncCronSchedule) {
  if (cron.validate(config.syncCronSchedule)) {
    console.log(`Synchronisation automatique planifiée : ${config.syncCronSchedule}`);
    cron.schedule(config.syncCronSchedule, async () => {
      try {
        console.log('Lancement de la synchronisation planifiée...');
        await syncService.runSync();
        console.log('Synchronisation planifiée terminée.');
      } catch (error) {
        console.error('Échec de la synchronisation planifiée :', error.message);
      }
    });
  } else {
    console.warn(`SYNC_CRON_SCHEDULE invalide, ignoré : "${config.syncCronSchedule}"`);
  }
}
