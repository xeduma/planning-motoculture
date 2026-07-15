/**
 * Calcule le facteur d'urgence automatique d'une machine.
 *
 * Règles métier :
 *  1 - urgent  (rouge)  -> réparation pour un client professionnel
 *  2 - moyen   (orange) -> toute autre réparation
 *  3 - faible  (gris)   -> diagnostic de panne, ou machine d'occasion à remettre en état
 *
 * Le tri d'affichage se fait ensuite par (urgency_level ASC, deposit_date ASC) :
 * l'urgence prime toujours sur la date, la date ne départage qu'à urgence égale.
 */
function calculateAutoUrgency({ clientType, repairType, isOccasion }) {
  const occasion = !!isOccasion;
  const repair = repairType === 'reparation';
  const pro = clientType === 'professionnel';

  if (repair && pro) return 1;
  if (repairType === 'diagnostic' || occasion) return 3;
  return 2;
}

const URGENCY_META = {
  1: { label: 'Urgent', color: 'red' },
  2: { label: 'Moyen', color: 'orange' },
  3: { label: 'Faible', color: 'gray' },
};

module.exports = { calculateAutoUrgency, URGENCY_META };
