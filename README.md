# 🎬 Sylver Screen Cinema - Site Web Complet

Site web professionnel pour le cinéma **Sylver Screen** situé au Douala Grand Mall, Cameroun.

Design inspiré du **Grand Rex Paris** avec palette noir et blanc élégante.

## ✨ Fonctionnalités

### 🎫 Pour les clients
- **Réservation en ligne** avec sélection visuelle des places
- **Annulation gratuite** jusqu'à 25 minutes avant la séance
- **Notation des films** (système 5 étoiles)
- **Notifications par email** pour les nouveautés et programme hebdomadaire
- **Vérification téléphonique** par WhatsApp ou SMS lors de l'inscription
- **Newsletter** pour rester informé

### 👨‍💼 Pour les administrateurs
- **Panneau d'administration complet**
- **Gestion des films** (ajout, modification, suppression)
- **Gestion des séances** avec salles, horaires et prix
- **Suivi des réservations** en temps réel
- **Gestion des utilisateurs**
- **Statistiques** (utilisateurs, réservations, revenus)

### 🗄️ Base de données
- **SQLite** pour stockage local
- Tables : utilisateurs, films, séances, réservations, notes, codes de vérification
- **Authentification JWT** sécurisée
- **Mots de passe chiffrés** avec bcrypt

## 📋 Installation

### Prérequis
- Node.js (v14 ou supérieur)
- npm

### Étapes d'installation

1. **Installer les dépendances**
```bash
npm install
```

2. **Démarrer le serveur**
```bash
npm start
```

Le serveur démarre sur `http://localhost:3000`

3. **Accéder au site**
- Site public : `http://localhost:3000/index.html`
- Panel admin : `http://localhost:3000/admin.html`

## 🔐 Compte Administrateur

**Email:** admin@sylver-screen.com  
**Mot de passe:** admin123

## 📁 Structure du projet

```
sylver-screen-cinema/
├── server.js              # Serveur Node.js avec API REST
├── index.html             # Page d'accueil publique
├── admin.html             # Panel d'administration
├── app.js                 # JavaScript frontend public
├── admin.js               # JavaScript frontend admin
├── package.json           # Dépendances Node.js
├── sylver_screen.db       # Base de données SQLite (créée automatiquement)
└── README.md              # Ce fichier
```

## 🎨 Design

Le site est inspiré du **Grand Rex Paris** avec :
- Palette de couleurs **noir et blanc** élégante
- Typographie **Playfair Display** (titres) et **Montserrat** (corps)
- Mise en emphase des **films à l'affiche**
- Design **minimaliste et sophistiqué**
- **Animations fluides** et micro-interactions

## 🚀 API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `POST /api/auth/send-verification` - Envoyer code de vérification
- `POST /api/auth/verify-phone` - Vérifier le téléphone

### Films
- `GET /api/movies` - Liste des films
- `GET /api/movies/:id` - Détails d'un film
- `POST /api/movies` - Ajouter un film (admin)
- `PUT /api/movies/:id` - Modifier un film (admin)
- `DELETE /api/movies/:id` - Supprimer un film (admin)

### Séances
- `GET /api/movies/:id/showtimes` - Séances d'un film
- `POST /api/showtimes` - Ajouter une séance (admin)
- `PUT /api/showtimes/:id` - Modifier une séance (admin)
- `DELETE /api/showtimes/:id` - Supprimer une séance (admin)

### Réservations
- `POST /api/bookings` - Créer une réservation
- `GET /api/bookings` - Mes réservations
- `PUT /api/bookings/:id/cancel` - Annuler une réservation

### Notations
- `POST /api/ratings` - Noter un film

### Newsletter
- `POST /api/newsletter/subscribe` - S'abonner

### Admin
- `GET /api/admin/users` - Liste des utilisateurs
- `GET /api/admin/bookings` - Toutes les réservations
- `GET /api/admin/stats` - Statistiques

## 📧 Configuration Email

Pour activer l'envoi d'emails, configurer dans `server.js` :

```javascript
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'votre-email@gmail.com',
        pass: 'votre-mot-de-passe-app'
    }
});
```

## 📱 Configuration SMS/WhatsApp

Pour activer l'envoi de SMS et WhatsApp, intégrer une API comme :
- **Twilio** pour SMS
- **WhatsApp Business API** pour WhatsApp

## 🎯 Fonctionnalités à venir

- [ ] Paiement en ligne (Mobile Money, Carte bancaire)
- [ ] Programme de fidélité
- [ ] Ventes de snacks en ligne
- [ ] Application mobile
- [ ] Intégration réseaux sociaux
- [ ] Multi-langue (Français/Anglais)

## 🏢 Informations Sylver Screen

**Adresse:** Douala Grand Mall, Route de l'Aéroport, Douala  
**Téléphone:** +237 XXX XXX XXX  
**Email:** contact@sylver-screen.com  
**Horaires:** Lundi - Dimanche, 10h00 - 23h00

### Salles
- **Salle 1 :** 150 places, Son Dolby, Projection 2K
- **Salle 2 :** 150 places, Son Dolby, Projection 2K

### Tarifs
- **Tarif normal :** 3000 FCFA
- **Tarif réduit :** 2000 FCFA (étudiants, -18 ans)

### Événements spéciaux
- **Jeudi Ciné Camer :** Films camerounais tous les jeudis

## 📄 Licence

© 2025 Sylver Screen Cinema. Tous droits réservés.

## 🇨🇲 100% Camerounais

Fièrement développé pour promouvoir le cinéma au Cameroun ! 🎬🇨🇲
