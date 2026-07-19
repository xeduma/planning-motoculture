# DDVS Repair Queue — File d'Atelier

Tableau de bord de gestion des réparations pour DDVS Motoculture.  
Affiche les machines à réparer triées par urgence et délai, en vue Kanban ou Liste.

---

## Installation Debian 13

### 1. Prérequis système

```bash
apt install -y nodejs npm python3 make g++ build-essential nginx
# Node >= 18 requis
node -v
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Éditer .env avec tes valeurs
nano .env

npm install
node server.js
# → Écoute sur http://127.0.0.1:8410
```

Pour tourner en production avec systemd :
```bash
# Copier repair-queue.service dans /etc/systemd/system/
systemctl enable repair-queue
systemctl start repair-queue
```

### 3. Frontend

```bash
cd frontend
npm install
npm run build
# → Génère frontend/dist/

# Copier dans le dossier Nginx
cp -r dist/* /var/www/repair-queue/
```

### 4. Nginx

```bash
# Générer un certificat auto-signé (ou utiliser le tien)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/ddvs-repair.key \
  -out /etc/ssl/certs/ddvs-repair.crt

# Copier la config Nginx
cp nginx/repair-queue.conf /etc/nginx/sites-available/repair-queue
ln -s /etc/nginx/sites-available/repair-queue /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## Configuration `.env` backend

| Variable          | Description                                      | Défaut                    |
|-------------------|--------------------------------------------------|---------------------------|
| `PORT`            | Port backend                                     | `8410`                    |
| `JWT_SECRET`      | Secret de signature JWT                          | *(à changer)*             |
| `ADMIN_USERNAME`  | Identifiant de connexion                         | `admin`                   |
| `ADMIN_PASSWORD`  | Mot de passe dashboard                           | `admin123`                |
| `DDVS_API_URL`    | URL de l'API principale DDVS                     | `http://localhost:8402/api`|
| `DDVS_API_TOKEN`  | Token JWT de l'API DDVS (pour sync factures)     | *(vide)*                  |
| `DB_PATH`         | Chemin SQLite                                    | `./data/repair_queue.db`  |

---

## API Backend

### Auth
| Méthode | Route              | Description          |
|---------|--------------------|----------------------|
| POST    | `/api/auth/login`  | Connexion → JWT      |
| POST    | `/api/auth/verify` | Vérifier token       |

### Machines
| Méthode | Route                  | Description                        |
|---------|------------------------|------------------------------------|
| GET     | `/api/machines`        | Liste kanban ou flat (view=kanban) |
| GET     | `/api/machines/today`  | Top 10 machines prioritaires       |
| GET     | `/api/machines/:id`    | Détail + historique                |
| POST    | `/api/machines`        | Ajouter une machine                |
| PATCH   | `/api/machines/:id`    | Modifier statut / urgence / notes  |
| DELETE  | `/api/machines/:id`    | Marquer comme livré                |

### Sync & Stats
| Méthode | Route         | Description                             |
|---------|---------------|-----------------------------------------|
| GET     | `/api/health` | État du serveur et connexion API DDVS   |
| POST    | `/api/sync`   | Sync avec VosFactures (factures payées) |
| GET     | `/api/stats`  | Statistiques globales                   |

---

## Logique d'urgence

| Niveau | Couleur | Déclencheur                                    | Seuil délai critique |
|--------|---------|------------------------------------------------|----------------------|
| 1      | 🔴 Rouge  | Client professionnel                           | J+3                  |
| 2      | 🟠 Orange | Toute réparation standard                      | J+7                  |
| 3      | ⚫ Gris   | Diagnostic, remise en état occasion, entretien | J+14                 |

L'urgence est calculée automatiquement à l'ajout, mais peut être écrasée manuellement.

---

## Synchronisation avec VosFactures

La synchronisation (bouton ou `POST /api/sync`) :
1. Récupère les factures **payées du jour** via l'API DDVS (port 8402)
2. Cherche les machines avec un `invoice_number` correspondant
3. Les passe automatiquement en statut `done`

Pour activer la sync, configurer `DDVS_API_TOKEN` avec un token JWT valide de l'API principale.

---

## Arborescence

```
repair-queue/
├── backend/
│   ├── server.js       ← Point d'entrée Express
│   ├── db.js           ← Schéma SQLite
│   ├── auth.js         ← JWT + login
│   ├── urgency.js      ← Calcul priorité
│   ├── ddvs.js         ← Client API principale
│   ├── .env.example
│   ├── requirements.txt
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── views/
│   │   │   ├── LoginView.vue
│   │   │   ├── KanbanView.vue   ← Vue principale
│   │   │   └── ListeView.vue    ← Objectifs du jour
│   │   ├── components/
│   │   │   ├── MachineCard.vue  ← Carte avec barre délai
│   │   │   └── MachineForm.vue  ← Formulaire ajout/édition
│   │   ├── stores/
│   │   │   ├── machines.js
│   │   │   └── toast.js
│   │   └── assets/base.css
│   └── package.json
└── nginx/
    └── repair-queue.conf
```
