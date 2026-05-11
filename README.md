# 🎬 Sylver Screen Cinema — Site Web Complet

Site web professionnel pour le cinéma **Sylver Screen** situé au Douala Grand Mall, Cameroun.

Design inspiré du **Grand Rex Paris** avec palette noir et blanc élégante.

---

## ✨ Fonctionnalités

### 🎫 Pour les clients
- **Réservation en ligne** avec sélection visuelle des places
- **Annulation gratuite** jusqu'à 25 minutes avant la séance
- **Notation des films** (format X.X sur 5)
- **Notifications par email** — confirmation de réservation, nouveautés
- **Vérification téléphonique** par SMS lors de l'inscription
- **Newsletter** pour rester informé
- **Mot de passe oublié** avec lien de réinitialisation par email (expire en 1h)
- **Design responsive** — mobile, tablette, desktop

### 👨‍💼 Pour les administrateurs
- **Panneau d'administration complet**
- **Gestion des films** — titre, genre, durée, affiche (URL), bande-annonce (YouTube), note, dates
- **Gestion des séances** — salles, horaires, prix
- **Suivi des réservations** en temps réel
- **Gestion des utilisateurs**
- **Statistiques** — utilisateurs actifs, réservations, revenus
- **Gestion des tarifs** — prix adulte, enfant, popcorn mis à jour en temps réel
- **Newsletter** — liste des abonnés

### 🗄️ Base de données (PostgreSQL)
- Tables : `users`, `movies`, `showtimes`, `bookings`, `ratings`, `settings`, `newsletter`, `password_resets`, `verification_codes`
- **Authentification JWT** sécurisée
- **Mots de passe chiffrés** avec bcrypt

---

## 🚀 Déploiement sur Render

### Prérequis
- Compte [Render](https://render.com)
- Base de données PostgreSQL (fournie par Render ou Supabase)

### Étapes

**1. Créer une base de données PostgreSQL sur Render**
- Dashboard → New → PostgreSQL
- Copier l'**Internal Database URL**

**2. Créer un Web Service**
- New → Web Service → connecter votre repo GitHub
- **Runtime :** Node
- **Build Command :** `npm install`
- **Start Command :** `node server.js`

**3. Variables d'environnement** (dans Render → Environment)

| Variable | Valeur | Requis |
|---|---|---|
| `DATABASE_URL` | URL PostgreSQL interne | ✅ |
| `JWT_SECRET` | Clé secrète longue (ex: `openssl rand -hex 32`) | ✅ |
| `EMAIL_USER` | Adresse Gmail pour les emails | ✅ |
| `EMAIL_PASS` | Mot de passe d'application Gmail | ✅ |
| `SITE_URL` | URL publique du service (ex: `https://sylver-screen.onrender.com`) | ✅ |
| `NODE_ENV` | `production` | Recommandé |

> **Gmail — Mot de passe d'application :** Activer la [validation en 2 étapes](https://myaccount.google.com/signinoptions/twostepverification) puis aller dans [Mots de passe d'application](https://myaccount.google.com/apppasswords), choisir "Autre" et copier le mot de passe généré.

**4. Peupler la base de données (une seule fois)**
```bash
DATABASE_URL=... node seed.js
```

La base de données se crée et se migre automatiquement au démarrage (`initDatabase()` + `ensureSettingsTable()`).

---

## 💻 Développement local

### Prérequis
- Node.js v18+
- npm

### Installation
```bash
npm install
```

### Démarrage local sans PostgreSQL
```bash
node server-local.js
```
Utilise `db_data.json` comme base de données. Aucune configuration requise.

### Démarrage avec PostgreSQL
```bash
# Créer un fichier .env
DATABASE_URL=postgresql://user:pass@localhost:5432/sylver_screen
JWT_SECRET=votre_secret_tres_long
EMAIL_USER=votre@gmail.com
EMAIL_PASS=votre_app_password_16_chars
SITE_URL=http://localhost:3000

node server.js
```

---

## 🔐 Compte Administrateur (par défaut)

```
Email    : admin@sylver-screen.com
Password : admin123
```

> ⚠️ Changer le mot de passe en production.

---

## 📁 Structure du projet

```
sylver-screen-cinema/
├── server.js              # Serveur Node.js + API REST (PostgreSQL)
├── server-local.js        # Serveur local (JSON, sans DB externe)
├── seed.js                # Seeder — données initiales (films, séances)
├── db_data.json           # Données pour server-local.js
├── index.html             # Page d'accueil publique
├── film.html              # Page film + réservation
├── admin.html             # Panneau d'administration
├── reset-password.html    # Page de réinitialisation de mot de passe
├── app.js                 # JavaScript frontend public
├── admin.js               # JavaScript frontend admin
├── film.js                # JavaScript page film
├── style.css              # Styles globaux (dark/light, responsive)
├── package.json           # Dépendances Node.js
└── README.md              # Ce fichier
```

---

## 🌐 API Endpoints

### Authentification
| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/forgot-password` | Demande réinitialisation mot de passe |
| GET | `/api/auth/verify-reset-token?token=...` | Vérifier validité token reset |
| POST | `/api/auth/reset-password` | Changer le mot de passe via token |
| POST | `/api/auth/send-verification` | Envoyer code vérification SMS |
| POST | `/api/auth/verify-phone` | Vérifier numéro de téléphone |

### Films
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/movies` | Liste des films actifs |
| GET | `/api/movies/:id` | Détails d'un film |
| POST | `/api/movies` | Ajouter un film (admin) |
| PUT | `/api/movies/:id` | Modifier un film (admin) |
| DELETE | `/api/movies/:id` | Archiver un film (admin) |

### Séances
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/movies/:id/showtimes` | Séances d'un film |
| GET | `/api/showtimes/:id/seats` | Places occupées |
| POST | `/api/showtimes` | Ajouter une séance (admin) |
| PUT | `/api/showtimes/:id` | Modifier une séance (admin) |
| DELETE | `/api/showtimes/:id` | Supprimer une séance (admin) |

### Réservations
| Méthode | Route | Description |
|---|---|---|
| POST | `/api/bookings` | Créer une réservation |
| GET | `/api/bookings` | Mes réservations (auth) |
| PUT | `/api/bookings/:id/cancel` | Annuler une réservation |

### Paramètres & Administration
| Méthode | Route | Description |
|---|---|---|
| POST | `/api/ratings` | Noter un film (auth) |
| GET | `/api/settings/prices` | Lire les prix des billets |
| PUT | `/api/admin/prices` | Mettre à jour les prix (admin) |
| GET | `/api/admin/users` | Liste des utilisateurs |
| GET | `/api/admin/bookings` | Toutes les réservations |
| GET | `/api/admin/stats` | Statistiques globales |
| GET | `/api/admin/newsletter` | Abonnés newsletter |

---

## 📧 Configuration Email (Gmail)

Le système envoie des emails pour :
- **Bienvenue** à l'inscription
- **Confirmation de réservation** avec détails
- **Réinitialisation de mot de passe** (lien valable 1 heure)

### Obtenir un mot de passe d'application Gmail
1. Activer la [validation en 2 étapes](https://myaccount.google.com/signinoptions/twostepverification)
2. Aller dans [Mots de passe d'application](https://myaccount.google.com/apppasswords)
3. Choisir **Autre (nom personnalisé)** → Taper "Sylver Screen"
4. Copier le mot de passe de 16 caractères
5. Définir comme `EMAIL_PASS` dans les variables d'environnement

---

## 🎨 Design

- Palette **noir et blanc** + mode clair/sombre
- Typographie **Playfair Display** (titres) + **Inter** (corps)
- Carousel films infini avec autoplay et swipe mobile
- Page film style cinéma premium — affiche gauche, infos droite
- Modals bottom sheet sur mobile
- 10 places par ligne dans la sélection des sièges (toutes tailles)

---

## 🎯 Roadmap

- [ ] Paiement Mobile Money (Orange Money, MTN)
- [ ] Programme de fidélité
- [ ] Application mobile (PWA)
- [ ] Multi-langue FR / EN

---

## 🏢 Infos Sylver Screen Cinema

**Adresse :** Douala Grand Mall, Route de l'Aéroport, Douala  
**Horaires :** Lun – Dim, 10h00 – 23h00  

### Tarifs par défaut (modifiables dans l'admin)
- Adulte : 3 000 FCFA · Enfant : 2 000 FCFA · Popcorn : 4 000 FCFA

---

© 2026 Sylver Screen Cinema. Tous droits réservés. 🇨🇲