# DDVS Motoculture — Backend

Backend du dashboard de gestion des réparations, avec intégration à l'API VosFactures.

## Stack

- **Node.js + Express** (choisi pour rester cohérent avec le reste de ton infra Node.js/SQLite déjà en place)
- **better-sqlite3** : base locale simple, synchrone, aucun serveur à gérer — sert de file d'attente des machines et de cache des factures
- Écoute **uniquement en local** (`127.0.0.1:8410`), jamais sur `0.0.0.0` — Nginx fera le reverse-proxy en 443

> Note : tu avais demandé un `requirements.txt` (convention Python). Ici la stack est Node.js, donc l'équivalent est `package.json` (liste des dépendances + version). Dis-moi si tu préfères repartir sur un backend Python (FastAPI par ex.) — je peux le refaire avec un vrai `requirements.txt`.

## Installation

```bash
cd ddvs-backend
cp .env.example .env      # puis remplis les valeurs (token VosFactures, routes exactes...)
npm install
npm start                 # ou: npm run dev (auto-reload)
```

## Variables d'environnement (.env)

Toutes les variables sont documentées dans `.env.example`. Points clés :

- `VOSFACTURES_API_BASE_URL` : déjà rempli avec `http://localhost:8402`
- `VOSFACTURES_ROUTE_SYNC` / `_INVOICES` / `_HEALTH` : routes par défaut (`/sync`, `/invoices`, `/health`), à ajuster quand tu confirmeras
- `VOSFACTURES_API_TOKEN` : à remplir si l'API demande une authentification
- `VOSFACTURES_CACHE_DB_*` : prévu si jamais tu veux connecter directement la base de cache de VosFactures en plus de l'API HTTP (laisse vide pour l'instant, non utilisé actuellement)
- `SYNC_CRON_SCHEDULE` : vide par défaut = pas de sync automatique, uniquement le bouton manuel

## Routes exposées par CE backend (celui que le frontend Vue appellera)

### Machines / file d'attente
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/machines` | Liste triée par urgence puis date de dépôt |
| GET | `/api/machines?status=en_attente` | Filtrée par statut |
| GET | `/api/machines/:id` | Détail d'une machine |
| POST | `/api/machines` | Créer une entrée (urgence auto-calculée si non fournie) |
| PATCH | `/api/machines/:id` | Modifier les infos générales |
| PATCH | `/api/machines/:id/status` | Changer le statut manuellement (`en_attente`, `en_cours`, `termine`) |
| PATCH | `/api/machines/:id/urgency` | Changer le facteur d'urgence manuellement (1, 2 ou 3) |
| DELETE | `/api/machines/:id` | Supprimer |

### VosFactures
| Méthode | Route | Description |
|---|---|---|
| POST | `/api/sync` | Bouton "Synchroniser" → appelle `/sync` puis `/invoices` de VosFactures, met à jour le cache et les statuts |
| GET | `/api/sync/last` | Dernier résultat de synchro connu |
| GET | `/api/invoices` | Factures en cache local |
| GET | `/api/health` | Statut de l'API VosFactures + infos dernière synchro |

## Logique métier implémentée

**Facteur d'urgence automatique** (`src/services/urgency.service.js`) :
- `1 (urgent, rouge)` : réparation pour un client professionnel
- `2 (moyen, orange)` : toute autre réparation
- `3 (faible, gris)` : diagnostic de panne, ou machine d'occasion

Modifiable à la main via `PATCH /api/machines/:id/urgency` (pose un flag `urgency_manual_override` pour tracer que ce n'est plus la valeur auto).

**Tri d'affichage** : `ORDER BY urgency_level ASC, deposit_date ASC` — l'urgence prime toujours, la date ne départage qu'à urgence égale (conforme à ton exemple tracteur-tondeuse vs diagnostic).

**Statut & délais** :
- Nouvelle machine → `en_attente`
- Modifiable manuellement en `en_cours` / `termine`
- Passage automatique en `termine` lors de la synchro si la facture liée (`invoice_id`) est marquée payée côté VosFactures — sauf si un statut manuel a déjà été posé (`status_manual_override`)

## Ce qui reste à confirmer de ton côté

1. Le format exact des routes VosFactures (`/sync`, `/invoices`, `/health`) et leur méthode HTTP réelle
2. Le format JSON réellement renvoyé par `/invoices` (le mapping dans `sync.service.js` est tolérant mais à ajuster une fois la vraie réponse connue)
3. Si un token est nécessaire pour appeler l'API
4. Si la "base de données en cache" est une base séparée à interroger directement, ou juste le cache interne de l'API VosFactures (dans ce cas rien à faire ici, l'API HTTP suffit)

## Prochaine étape

Une fois ce backend validé, je peux enchaîner sur le frontend Vue 3 (vue liste triée par urgence avec badges colorés, ou vue Kanban par statut — mon conseil : liste simple triée par urgence pour la vue "priorité du jour", éventuellement un Kanban en option secondaire par statut).
