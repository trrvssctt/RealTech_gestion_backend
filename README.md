# RealTech Holding - Backend API

Backend complet pour l'application de gestion de boutique informatique RealTech Holding, développé avec Node.js, Express, TypeScript et PostgreSQL.

## 🚀 Fonctionnalités

### Authentification & Utilisateurs
- ✅ Authentification JWT avec refresh tokens
- ✅ Hachage sécurisé des mots de passe (bcrypt)
- ✅ Gestion des rôles (Admin, Manager, Employé)
- ✅ CRUD complet des utilisateurs
- ✅ Profil utilisateur et changement de mot de passe

### Gestion Clients
- ✅ CRUD complet des clients
- ✅ Association optionnelle aux commandes
- ✅ Soft delete et réactivation

### Gestion Produits
- ✅ CRUD complet des produits
- ✅ Suivi du stock en temps réel
- ✅ Soft delete et restauration
- ✅ Filtrage avancé (prix, stock, statut)

### Gestion Services
- ✅ CRUD complet des services
- ✅ Soft delete et restauration
- ✅ Association aux commandes

### Gestion Tâches
- ✅ Assignation aux employés
- ✅ Suivi de date et fréquence
- ✅ Niveaux d'importance
- ✅ Statuts de progression
- ✅ Restrictions par rôle

### Gestion Commandes
- ✅ CRUD complet des commandes
- ✅ Support produits ET services
- ✅ Génération automatique de factures PNG
- ✅ Gestion des statuts
- ✅ Mise à jour automatique des stocks

### Reporting & Dashboard
- ✅ Statistiques complètes (utilisateurs, produits, commandes, ventes)
- ✅ Graphiques de ventes mensuelles
- ✅ Top produits par ventes
- ✅ Activité récente
- ✅ Indicateurs de performance

### Sécurité
- ✅ Rate limiting
- ✅ Helmet.js pour la sécurité HTTP
- ✅ CORS configuré
- ✅ Validation stricte avec Zod
- ✅ Gestion d'erreurs centralisée
- ✅ Logging avec Winston

## 🏗️ Architecture

```
src/
├── config/          # Configuration (DB, JWT, env)
├── controllers/     # Logique métier
├── middlewares/     # Auth, validation, sécurité
├── routes/          # Endpoints API
├── services/        # Services (PDF, email)
├── utils/           # Utilitaires
├── validators/      # Schemas de validation Zod
├── scripts/         # Scripts (seed, migration)
└── app.ts          # Point d'entrée Express
```

## 📋 Prérequis

- Node.js 18+
- PostgreSQL 14+
- npm ou yarn

## 🛠️ Installation

1. **Cloner le dépôt**
```bash
git clone <repository-url>
cd realtech-backend
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration environnement**
```bash
cp .env.example .env
```

4. **Configurer la base de données**
Modifier les variables dans `.env` :
```env
DATABASE_URL="postgresql://username:password@localhost:5432/realtech_db"
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"
```

5. **Initialiser la base de données**
```bash
npm run db:push
npm run db:generate
```

6. **Peupler avec des données de test (optionnel)**
```bash
npm run db:seed
```

## 🚀 Démarrage

### Mode Développement
```bash
npm run dev
```

### Mode Production
```bash
npm run build
npm start
```

L'API sera accessible sur `http://localhost:3000`

## 🔐 Authentification

### Connexion
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@realtech.com",
  "password": "Admin123!"
}
```

### Utiliser le token
```bash
GET /api/users
Authorization: Bearer <your-access-token>
```

## 📊 Endpoints Principaux

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/refresh` - Renouveler token
- `GET /api/auth/profile` - Profil utilisateur
- `PUT /api/auth/password` - Changer mot de passe
- `POST /api/auth/logout` - Déconnexion

### Utilisateurs
- `GET /api/users` - Liste utilisateurs
- `POST /api/users` - Créer utilisateur
- `PUT /api/users/:id` - Modifier utilisateur
- `DELETE /api/users/:id` - Désactiver utilisateur

### Clients
- `GET /api/clients` - Liste clients
- `POST /api/clients` - Créer client
- `PUT /api/clients/:id` - Modifier client
- `DELETE /api/clients/:id` - Désactiver client

### Produits
- `GET /api/products` - Liste produits
- `POST /api/products` - Créer produit
- `PUT /api/products/:id` - Modifier produit
- `PUT /api/products/:id/stock` - Modifier stock
- `DELETE /api/products/:id` - Supprimer produit

### Services
- `GET /api/services` - Liste services
- `POST /api/services` - Créer service
- `PUT /api/services/:id` - Modifier service
- `DELETE /api/services/:id` - Supprimer service

### Tâches
- `GET /api/tasks` - Liste tâches
- `GET /api/tasks/my` - Mes tâches
- `POST /api/tasks` - Créer tâche
- `PUT /api/tasks/:id` - Modifier tâche
- `DELETE /api/tasks/:id` - Supprimer tâche

### Commandes
- `GET /api/commandes` - Liste commandes
- `POST /api/commandes` - Créer commande
- `PUT /api/commandes/:id` - Modifier commande
- `POST /api/commandes/:id/invoice` - Générer facture
- `DELETE /api/commandes/:id` - Supprimer commande

### Dashboard
- `GET /api/dashboard/stats` - Statistiques générales
- `GET /api/dashboard/sales-chart` - Graphique des ventes
- `GET /api/dashboard/top-products` - Top produits
- `GET /api/dashboard/recent-activity` - Activité récente

## 👥 Utilisateurs de Test

Après le seed, ces utilisateurs sont disponibles :

```
👑 Admin
Email: admin@realtech.com
Password: Admin123!

👨‍💼 Manager
Email: manager@realtech.com
Password: Manager123!

👨‍💻 Employee
Email: employee@realtech.com
Password: Employee123!
```

## 🔒 Permissions par Rôle

### Admin
- Accès complet à toutes les fonctionnalités
- Gestion des utilisateurs
- Suppression des données

### Manager
- Gestion produits et services
- Consultation des statistiques
- Gestion des tâches

### Employé
- Consultation des données
- Modification de ses propres tâches
- Création de commandes

## 📁 Génération de Fichiers

Les factures et reçus sont générés automatiquement en PNG dans :
- `uploads/Factures/YYYY-MM-DD-numeroFacture/`
- `uploads/Reçus/YYYY-MM-DD-numeroRecu/`

## 🐛 Débogage

Les logs sont disponibles dans le dossier `logs/` :
- `error.log` - Erreurs uniquement
- `combined.log` - Tous les logs

## 🧪 Tests

### Test des endpoints avec curl

```bash
# Health check
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@realtech.com","password":"Admin123!"}'

# Get users (avec token)
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🔄 Scripts Disponibles

```bash
npm run dev          # Démarrage développement avec hot reload
npm run build        # Compilation TypeScript
npm start           # Démarrage production
npm run db:generate # Générer client Prisma
npm run db:push     # Synchroniser schéma DB
npm run db:migrate  # Créer migration
npm run db:seed     # Peupler avec données de test
```

## 🛡️ Sécurité

- Hachage bcrypt (12 rounds)
- JWT avec expiration courte (15min) 
- Refresh tokens avec expiration longue (7j)
- Rate limiting (100 req/15min)
- Validation stricte des entrées
- CORS configuré
- Headers de sécurité Helmet

## 📝 Variables d'Environnement

```env
# Base de données
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Serveur
PORT=3000
NODE_ENV=development

# Sécurité
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Fichiers
UPLOAD_PATH=./uploads
INVOICES_PATH=./uploads/Factures
RECEIPTS_PATH=./uploads/Reçus
```

## 🚀 Déploiement

1. **Build de production**
```bash
npm run build
```

2. **Variables d'environnement production**
Configurer les variables avec des valeurs sécurisées

3. **Migration base de données**
```bash
npm run db:migrate
```

4. **Démarrage**
```bash
npm start
```

## 📞 Support

Pour toute question ou problème :
- Créer une issue sur le dépôt
- Contacter l'équipe RealTech Holding

---

**RealTech Holding** - Solution complète de gestion pour boutique informatique 💻✨