// server.js - Backend Sylver Screen Cinema
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sylver-screen-secret-key-2025';

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(__dirname));

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err);
    } else {
        console.log('✅ Connected to PostgreSQL database');
        initDatabase();
    }
});

// Initialize database tables
async function initDatabase() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT false,
            email_notifications BOOLEAN DEFAULT true,
            phone_verified BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS movies (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            genre TEXT NOT NULL,
            duration INTEGER NOT NULL,
            description TEXT,
            poster_url TEXT,
            trailer_url TEXT,
            rating REAL DEFAULT 0,
            votes_count INTEGER DEFAULT 0,
            release_date DATE,
            end_date DATE,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS showtimes (
            id SERIAL PRIMARY KEY,
            movie_id INTEGER NOT NULL REFERENCES movies(id),
            date DATE NOT NULL,
            time TIME NOT NULL,
            room TEXT NOT NULL,
            price REAL DEFAULT 3000,
            total_seats INTEGER DEFAULT 60,
            available_seats INTEGER DEFAULT 60
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            showtime_id INTEGER NOT NULL REFERENCES showtimes(id),
            seats TEXT NOT NULL,
            total_price REAL NOT NULL,
            ticket_type TEXT,
            status TEXT DEFAULT 'confirmed',
            booking_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS ratings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            movie_id INTEGER NOT NULL REFERENCES movies(id),
            rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, movie_id)
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS verification_codes (
            id SERIAL PRIMARY KEY,
            phone TEXT NOT NULL,
            code TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS password_resets (
            id SERIAL PRIMARY KEY,
            email TEXT NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS newsletter (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await pool.query(`INSERT INTO settings (key, value) VALUES ('price_adulte', '3000') ON CONFLICT (key) DO NOTHING`);
        await pool.query(`INSERT INTO settings (key, value) VALUES ('price_enfant', '2000') ON CONFLICT (key) DO NOTHING`);
        await pool.query(`INSERT INTO settings (key, value) VALUES ('price_popcorn', '4000') ON CONFLICT (key) DO NOTHING`);

        const adminPassword = await bcrypt.hash('admin123', 10);
        await pool.query(`INSERT INTO users (name, email, phone, password, is_admin, phone_verified)
            VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO NOTHING`,
            ['Admin', 'admin@sylver-screen.com', '+237000000000', adminPassword, true, true]
        );

        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'noreply@sylver-screen.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// Helper functions
async function sendEmail(to, subject, html) {
    try {
        const info = await transporter.sendMail({
            from: `"Sylver Screen Cinema" <${process.env.EMAIL_USER || 'noreply@sylver-screen.com'}>`,
            to: to,
            subject: subject,
            html: html
        });
        console.log('✅ Email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Email error:', error);
        return false;
    }
}

// Auth middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

function isAdmin(req, res, next) {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
    next();
}

// ========== AUTH ROUTES ==========

app.post('/api/auth/register', async (req, res) => {
    console.log('📍 POST /api/auth/register - Request received');
    const { name, email, phone, password, emailNotifications } = req.body;
    console.log(`   Registration attempt: ${email}`);
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (name, email, phone, password, email_notifications, phone_verified) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [name, email, phone, hashedPassword, emailNotifications, true]
        );
        const userId = result.rows[0].id;
        const token = jwt.sign({ id: userId, email, is_admin: false }, JWT_SECRET);

        console.log(`✅ User registered successfully: ${email}`);

        // Envoyer email en arrière-plan (non-bloquant)
        if (emailNotifications) {
            const welcomeHTML = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #000;">Bienvenue chez Sylver Screen Cinema ! 🎬</h1>
                    <p>Bonjour <strong>${name}</strong>,</p>
                    <p>Merci de vous être inscrit(e). Vous pouvez maintenant réserver vos places en ligne !</p>
                    <p>À bientôt au cinéma !</p>
                    <hr style="margin: 30px 0;">
                    <p style="color: #999; font-size: 12px;">Sylver Screen Cinema - Douala Grand Mall</p>
                </div>
            `;
            // Ne pas attendre l'email - envoyer en arrière-plan
            sendEmail(email, 'Bienvenue chez Sylver Screen Cinema ! 🎬', welcomeHTML)
                .then(() => console.log(`📧 Welcome email sent to ${email}`))
                .catch(err => console.error(`📧 Email error for ${email}:`, err.message));
        }

        // Répondre immédiatement sans attendre l'email
        res.json({ token, user: { id: userId, name, email, phone, is_admin: false } });
    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(400).json({ error: 'Cet utilisateur existe déjà' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    console.log('📍 POST /api/auth/login - Request received');
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            console.log(`❌ User not found: ${email}`);
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log(`❌ Invalid password for: ${email}`);
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin }, JWT_SECRET);
        console.log(`✅ Login successful: ${email}`);
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, is_admin: user.is_admin } });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/auth/send-verification', async (req, res) => {
    const { phone } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
        await pool.query(
            'INSERT INTO verification_codes (phone, code, expires_at) VALUES ($1, $2, $3)',
            [phone, code, expiresAt]
        );

        const message = `Votre code de vérification Sylver Screen Cinema est: ${code}\n\nValide pendant 10 minutes.`;
        await sendSMS(phone, message);

        console.log(`📱 Code de vérification pour ${phone}: ${code}`);
        res.json({ success: true, message: 'Code envoyé avec succès' });
    } catch (error) {
        console.error('Erreur envoi code:', error);
        res.status(500).json({ error: 'Échec d\'envoi du code' });
    }
});

app.post('/api/auth/verify-phone', async (req, res) => {
    const { phone, code } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM verification_codes WHERE phone = $1 AND code = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [phone, code]
        );
        if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired code' });

        await pool.query('UPDATE users SET phone_verified = true WHERE phone = $1', [phone]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Verification failed' });
    }
});

// ========== MOVIES ROUTES ==========

// Debug endpoint
app.get('/api/debug', async (req, res) => {
    try {
        const moviesCount = await pool.query('SELECT COUNT(*) FROM movies');
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        const showtimesCount = await pool.query('SELECT COUNT(*) FROM showtimes');

        res.json({
            status: 'OK',
            database: 'Connected',
            movies: parseInt(moviesCount.rows[0].count),
            users: parseInt(usersCount.rows[0].count),
            showtimes: parseInt(showtimesCount.rows[0].count)
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            error: error.message
        });
    }
});

app.get('/api/movies', async (req, res) => {
    console.log('📍 GET /api/movies - Request received');
    try {
        const result = await pool.query('SELECT * FROM movies WHERE is_active = true ORDER BY created_at DESC');
        console.log(`✅ Found ${result.rows.length} movies`);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching movies:', error);
        res.status(500).json({ error: 'Failed to fetch movies' });
    }
});

app.get('/api/movies/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM movies WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Movie not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch movie' });
    }
});

app.post('/api/movies', authenticateToken, isAdmin, async (req, res) => {
    const { title, genre, duration, description, poster_url, trailer_url, release_date, end_date, rating } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO movies (title, genre, duration, description, poster_url, trailer_url, rating, release_date, end_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
            [title, genre, duration, description, poster_url, trailer_url, rating || 0, release_date, end_date]
        );
        res.json({ id: result.rows[0].id, message: 'Movie created successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create movie' });
    }
});

app.put('/api/movies/:id', authenticateToken, isAdmin, async (req, res) => {
    const { title, genre, duration, description, poster_url, trailer_url, rating, release_date, end_date, is_active } = req.body;
    try {
        await pool.query(
            'UPDATE movies SET title=$1, genre=$2, duration=$3, description=$4, poster_url=$5, trailer_url=$6, rating=$7, release_date=$8, end_date=$9, is_active=$10 WHERE id=$11',
            [title, genre, duration, description, poster_url, trailer_url, rating || 0, release_date, end_date, is_active, req.params.id]
        );
        res.json({ message: 'Movie updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update movie' });
    }
});

app.delete('/api/movies/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await pool.query('UPDATE movies SET is_active = false WHERE id = $1', [req.params.id]);
        res.json({ message: 'Movie deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete movie' });
    }
});

// ========== SHOWTIMES ROUTES ==========

app.get('/api/movies/:id/showtimes', async (req, res) => {
    try {
        const showAll = req.query.all === 'true'; // Pour l'admin
        const query = showAll
            ? 'SELECT * FROM showtimes WHERE movie_id = $1 ORDER BY date DESC, time'
            : `SELECT * FROM showtimes 
               WHERE movie_id = $1 
               AND (date::timestamp + time::time) > NOW() + INTERVAL '30 minutes'
               ORDER BY date, time`;

        const result = await pool.query(query, [req.params.id]);

        // Log pour debug
        if (!showAll) {
            console.log(`📅 Showtimes for movie ${req.params.id}: ${result.rows.length} available (30min+ from now)`);
        }

        res.json(result.rows);
    } catch (error) {
        console.error('Showtimes fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch showtimes' });
    }
});

app.post('/api/showtimes', authenticateToken, isAdmin, async (req, res) => {
    const { movie_id, date, time, room, price, total_seats } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO showtimes (movie_id, date, time, room, price, total_seats, available_seats) VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id',
            [movie_id, date, time, room, price || 3000, total_seats || 60]
        );
        res.json({ id: result.rows[0].id, message: 'Showtime created successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create showtime' });
    }
});

app.put('/api/showtimes/:id', authenticateToken, isAdmin, async (req, res) => {
    const { date, time, room, price } = req.body;
    try {
        await pool.query('UPDATE showtimes SET date=$1, time=$2, room=$3, price=$4 WHERE id=$5',
            [date, time, room, price, req.params.id]
        );
        res.json({ message: 'Showtime updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update showtime' });
    }
});

app.delete('/api/showtimes/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM showtimes WHERE id = $1', [req.params.id]);
        res.json({ message: 'Showtime deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete showtime' });
    }
});

// ========== BOOKINGS ROUTES ==========

// Get occupied seats for a showtime
app.get('/api/showtimes/:id/seats', async (req, res) => {
    try {
        const showtimeResult = await pool.query('SELECT total_seats FROM showtimes WHERE id = $1', [req.params.id]);
        if (showtimeResult.rows.length === 0) return res.status(404).json({ error: 'Séance non trouvée' });

        const bookingsResult = await pool.query(
            "SELECT seats FROM bookings WHERE showtime_id = $1 AND status != 'cancelled'",
            [req.params.id]
        );

        const occupiedSeats = [];
        bookingsResult.rows.forEach(b => {
            if (b.seats) {
                b.seats.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)).forEach(n => occupiedSeats.push(n));
            }
        });

        res.json({
            occupiedSeats,
            totalSeats: showtimeResult.rows[0].total_seats || 150
        });
    } catch (error) {
        console.error('Error fetching seats:', error);
        res.status(500).json({ error: 'Erreur lors du chargement des places' });
    }
});

app.post('/api/bookings', authenticateToken, async (req, res) => {
    const { showtime_id, seats, tickets, total_price } = req.body;
    const user_id = req.user.id;

    console.log('📝 New booking request:', { user_id, showtime_id, seats, tickets, total_price });

    const totalTickets = (tickets.adulte || 0) + (tickets.enfant || 0) + (tickets.popcorn || 0);

    try {
        const showtimeResult = await pool.query('SELECT * FROM showtimes WHERE id = $1', [showtime_id]);
        if (showtimeResult.rows.length === 0) {
            console.error('❌ Showtime not found:', showtime_id);
            return res.status(404).json({ error: 'Showtime not found' });
        }

        const showtime = showtimeResult.rows[0];
        console.log('✅ Showtime found:', showtime.available_seats, 'seats available');

        if (showtime.available_seats < totalTickets) return res.status(400).json({ error: 'Places insuffisantes' });

        let result;
        try {
            // Essayer avec ticket_type
            result = await pool.query(
                'INSERT INTO bookings (user_id, showtime_id, seats, total_price, ticket_type) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [user_id, showtime_id, seats.join(', '), total_price, JSON.stringify(tickets)]
            );
            console.log('✅ Booking created WITH ticket_type:', result.rows[0].id);
        } catch (e) {
            // Si colonne ticket_type n'existe pas, essayer sans
            console.log('⚠️  ticket_type column missing, inserting without it');
            result = await pool.query(
                'INSERT INTO bookings (user_id, showtime_id, seats, total_price) VALUES ($1, $2, $3, $4) RETURNING id',
                [user_id, showtime_id, seats.join(', '), total_price]
            );
            console.log('✅ Booking created WITHOUT ticket_type:', result.rows[0].id);
        }

        await pool.query('UPDATE showtimes SET available_seats = available_seats - $1 WHERE id = $2', [totalTickets, showtime_id]);

        const bookingId = result.rows[0].id;

        // RÉPONDRE IMMÉDIATEMENT - email en arrière-plan
        res.json({ id: bookingId, seats: seats.join(', '), message: 'Booking created successfully' });

        // Envoyer l'email en arrière-plan (sans bloquer la réponse)
        pool.query(`
            SELECT u.name, u.email, m.title, s.date, s.time, s.room
            FROM bookings b JOIN users u ON b.user_id = u.id
            JOIN showtimes s ON b.showtime_id = s.id JOIN movies m ON s.movie_id = m.id WHERE b.id = $1
        `, [bookingId]).then(bookingDetails => {
            if (bookingDetails.rows.length > 0) {
                const details = bookingDetails.rows[0];
                const ticketBreakdown = [];
                if (tickets.adulte > 0) ticketBreakdown.push(`${tickets.adulte} Adulte(s)`);
                if (tickets.enfant > 0) ticketBreakdown.push(`${tickets.enfant} Enfant(s)`);
                if (tickets.popcorn > 0) ticketBreakdown.push(`${tickets.popcorn} Popcorn`);

                const confirmationHTML = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #000;">Réservation confirmée ! 🎟️</h1>
                        <p>Bonjour <strong>${details.name}</strong>,</p>
                        <div style="background: #f5f5f5; padding: 20px; border-radius: 10px;">
                            <p><strong>Film:</strong> ${details.title}</p>
                            <p><strong>Date:</strong> ${new Date(details.date).toLocaleDateString('fr-FR')}</p>
                            <p><strong>Heure:</strong> ${details.time}</p>
                            <p><strong>Salle:</strong> ${details.room}</p>
                            <p><strong>Billets:</strong> ${ticketBreakdown.join(' + ')}</p>
                            <p><strong>Places:</strong> ${seats.join(', ')}</p>
                            <p><strong>Total:</strong> ${total_price.toLocaleString('fr-FR')} FCFA</p>
                        </div>
                        <p>Annulation gratuite jusqu'à 5 min avant.</p>
                    </div>
                `;
                sendEmail(details.email, `Confirmation - ${details.title}`, confirmationHTML)
                    .catch(e => console.log('Email background error:', e.message));
            }
        }).catch(e => console.log('Email fetch error:', e.message));
    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

app.get('/api/bookings', authenticateToken, async (req, res) => {
    try {
        console.log('👤 User', req.user.id, 'requesting bookings');
        const result = await pool.query(`
            SELECT b.*, m.title, s.date, s.time, s.room 
            FROM bookings b 
            JOIN showtimes s ON b.showtime_id = s.id 
            JOIN movies m ON s.movie_id = m.id 
            WHERE b.user_id = $1 
            ORDER BY b.booking_time DESC
        `, [req.user.id]);
        console.log(`✅ Found ${result.rows.length} bookings for user ${req.user.id}`);
        if (result.rows.length > 0) {
            console.log('Sample booking:', result.rows[0]);
        }
        res.json(result.rows);
    } catch (error) {
        console.error('Get bookings error:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

app.put('/api/bookings/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*, s.date, s.time FROM bookings b JOIN showtimes s ON b.showtime_id = s.id 
            WHERE b.id = $1 AND b.user_id = $2
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });

        const booking = result.rows[0];
        const showtimeDate = new Date(`${booking.date} ${booking.time}`);
        const timeDiff = (showtimeDate - new Date()) / (1000 * 60);

        if (timeDiff < 25) return res.status(400).json({ error: 'Cannot cancel less than 25 minutes before showtime' });

        await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', ['cancelled', req.params.id]);
        await pool.query('UPDATE showtimes SET available_seats = available_seats + $1 WHERE id = $2',
            [JSON.parse(booking.seats).length, booking.showtime_id]);

        res.json({ message: 'Booking cancelled successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to cancel booking' });
    }
});

// ========== PROFILE ROUTES ==========

app.put('/api/profile', authenticateToken, async (req, res) => {
    const { name, phone, email } = req.body;
    try {
        // Vérifier si l'email est déjà pris
        if (email !== req.user.email) {
            const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.user.id]);
            if (existing.rows.length > 0) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé' });
            }
        }

        await pool.query(
            'UPDATE users SET name = $1, phone = $2, email = $3 WHERE id = $4',
            [name, phone, email, req.user.id]
        );

        const updated = await pool.query('SELECT id, name, email, phone, is_admin FROM users WHERE id = $1', [req.user.id]);
        console.log('✅ Profile updated for user', req.user.id);
        res.json({ user: updated.rows[0], message: 'Profil mis à jour' });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Erreur mise à jour profil' });
    }
});

// ========== ADMIN BOOKING ROUTES ==========

app.delete('/api/admin/bookings/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const booking = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
        if (booking.rows.length === 0) {
            return res.status(404).json({ error: 'Réservation introuvable' });
        }

        const b = booking.rows[0];
        // Calculer le nombre de places à rendre
        let totalTickets = 1;
        try {
            if (b.ticket_type) {
                const tickets = JSON.parse(b.ticket_type);
                totalTickets = (tickets.adulte || 0) + (tickets.enfant || 0) + (tickets.popcorn || 0) || 1;
            }
        } catch (e) {
            // Si pas de ticket_type ou erreur parse, on prend 1 place par défaut
            totalTickets = 1;
        }

        await pool.query('UPDATE showtimes SET available_seats = available_seats + $1 WHERE id = $2', [totalTickets, b.showtime_id]);
        await pool.query('DELETE FROM bookings WHERE id = $1', [req.params.id]);

        console.log(`🗑️  Admin deleted booking ${req.params.id}, restored ${totalTickets} seats`);
        res.json({ message: 'Réservation supprimée' });
    } catch (error) {
        console.error('Delete booking error:', error);
        res.status(500).json({ error: 'Erreur suppression' });
    }
});

// ========== RATINGS ROUTES ==========

app.post('/api/ratings', authenticateToken, async (req, res) => {
    const { movie_id, rating } = req.body;
    try {
        await pool.query(
            'INSERT INTO ratings (user_id, movie_id, rating) VALUES ($1, $2, $3) ON CONFLICT (user_id, movie_id) DO UPDATE SET rating = $3',
            [req.user.id, movie_id, rating]
        );

        const avgResult = await pool.query('SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM ratings WHERE movie_id = $1', [movie_id]);
        await pool.query('UPDATE movies SET rating = $1, votes_count = $2 WHERE id = $3',
            [avgResult.rows[0].avg_rating, avgResult.rows[0].count, movie_id]);

        res.json({ message: 'Rating submitted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to rate movie' });
    }
});

// ========== NEWSLETTER ROUTES ==========

app.post('/api/newsletter/subscribe', async (req, res) => {
    const { email } = req.body;
    try {
        await pool.query('INSERT INTO newsletter (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', [email]);
        res.json({ message: 'Subscribed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Subscription failed' });
    }
});

// Admin: Get newsletter subscribers
app.get('/api/admin/newsletter', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM newsletter ORDER BY subscribed_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Newsletter fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch subscribers' });
    }
});

// Admin: Delete newsletter subscriber
app.delete('/api/admin/newsletter/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM newsletter WHERE id = $1', [req.params.id]);
        res.json({ message: 'Subscriber deleted' });
    } catch (error) {
        console.error('Delete subscriber error:', error);
        res.status(500).json({ error: 'Failed to delete subscriber' });
    }
});

// ========== ADMIN ROUTES ==========

app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, email, phone, is_admin, email_notifications, phone_verified, created_at FROM users');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// DEBUG endpoint - à retirer après debug
app.get('/api/debug/bookings', async (req, res) => {
    try {
        const bookings = await pool.query('SELECT * FROM bookings ORDER BY id DESC LIMIT 5');
        const showtimes = await pool.query('SELECT COUNT(*) as count FROM showtimes');
        const users = await pool.query('SELECT COUNT(*) as count FROM users');
        const movies = await pool.query('SELECT COUNT(*) as count FROM movies');

        res.json({
            bookings_count: bookings.rows.length,
            bookings_sample: bookings.rows,
            showtimes_count: showtimes.rows[0].count,
            users_count: users.rows[0].count,
            movies_count: movies.rows[0].count
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/bookings', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                b.id, 
                b.user_id,
                b.showtime_id,
                b.seats, 
                b.total_price, 
                b.status, 
                b.booking_time,
                u.name as user_name, 
                u.email, 
                m.title, 
                s.date, 
                s.time, 
                s.room 
            FROM bookings b 
            JOIN users u ON b.user_id = u.id 
            JOIN showtimes s ON b.showtime_id = s.id 
            JOIN movies m ON s.movie_id = m.id 
            ORDER BY b.booking_time DESC
        `);
        console.log(`Admin bookings query returned ${result.rows.length} rows`);
        res.json(result.rows);
    } catch (error) {
        console.error('Admin bookings error:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const users = await pool.query('SELECT COUNT(*) FROM users');
        const bookings = await pool.query('SELECT COUNT(*) FROM bookings WHERE status = $1', ['confirmed']);
        const revenue = await pool.query('SELECT SUM(total_price) FROM bookings WHERE status = $1', ['confirmed']);
        const movies = await pool.query('SELECT COUNT(*) FROM movies WHERE is_active = true');

        res.json({
            users: parseInt(users.rows[0].count),
            bookings: parseInt(bookings.rows[0].count),
            revenue: parseFloat(revenue.rows[0].sum) || 0,
            movies: parseInt(movies.rows[0].count)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ========== PRICE SETTINGS ==========

// Create settings table in initDatabase (called on startup)
async function ensureSettingsTable() {
    await pool.query(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    // Insert default prices if not set
    await pool.query(`INSERT INTO settings (key, value) VALUES ('price_adulte', '3000') ON CONFLICT (key) DO NOTHING`);
    await pool.query(`INSERT INTO settings (key, value) VALUES ('price_enfant', '2000') ON CONFLICT (key) DO NOTHING`);
    await pool.query(`INSERT INTO settings (key, value) VALUES ('price_popcorn', '4000') ON CONFLICT (key) DO NOTHING`);

    // Migration: ajouter colonne trailer_url si elle n'existe pas
    try {
        await pool.query('ALTER TABLE movies ADD COLUMN IF NOT EXISTS trailer_url TEXT');
        console.log('✅ Migration: colonne trailer_url ajoutée');
    } catch (e) {
        console.log('Migration trailer_url:', e.message);
    }

    // Migration: ajouter colonne ticket_type si elle n'existe pas
    try {
        await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_type TEXT`);
        console.log('✅ Migration: colonne ticket_type ajoutée');
    } catch (e) {
        console.log('Migration ticket_type:', e.message);
    }
}

// Get prices (public)
app.get('/api/settings/prices', async (req, res) => {
    try {
        const result = await pool.query("SELECT key, value FROM settings WHERE key LIKE 'price_%'");
        const prices = {};
        result.rows.forEach(row => {
            const type = row.key.replace('price_', '');
            prices[type] = parseInt(row.value);
        });
        res.json(prices);
    } catch (error) {
        res.json({ adulte: 3000, enfant: 2000, popcorn: 4000 });
    }
});

// Update prices (admin only)
app.put('/api/admin/prices', authenticateToken, isAdmin, async (req, res) => {
    const { adulte, enfant, popcorn } = req.body;
    try {
        await ensureSettingsTable();
        if (adulte) await pool.query(`INSERT INTO settings (key, value, updated_at) VALUES ('price_adulte', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [adulte]);
        if (enfant) await pool.query(`INSERT INTO settings (key, value, updated_at) VALUES ('price_enfant', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [enfant]);
        if (popcorn) await pool.query(`INSERT INTO settings (key, value, updated_at) VALUES ('price_popcorn', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [popcorn]);
        console.log(`✅ Prices updated: Adulte=${adulte}, Enfant=${enfant}, Popcorn=${popcorn}`);
        res.json({ success: true, prices: { adulte, enfant, popcorn } });
    } catch (error) {
        console.error('Price update error:', error);
        res.status(500).json({ error: 'Failed to update prices' });
    }
});

// ========== PASSWORD RESET ==========

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis' });

    try {
        const result = await pool.query('SELECT id, name FROM users WHERE email = $1', [email]);
        // Toujours répondre OK pour ne pas divulguer si l'email existe
        if (result.rows.length === 0) {
            return res.json({ success: true, message: 'Si cet email existe, un lien vous a été envoyé.' });
        }

        const user = result.rows[0];
        const token = require('crypto').randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

        // Invalider les anciens tokens
        await pool.query('UPDATE password_resets SET used = true WHERE email = $1', [email]);
        await pool.query(
            'INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3)',
            [email, token, expiresAt]
        );

        const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
        const resetLink = `${siteUrl}/reset-password.html?token=${token}`;

        const html = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;padding:40px;border-radius:12px;">
                <h1 style="font-size:1.8rem;margin-bottom:8px;">SYLVER SCREEN CINEMA</h1>
                <hr style="border-color:#333;margin-bottom:32px;">
                <h2 style="font-weight:400;margin-bottom:16px;">Réinitialisation de mot de passe</h2>
                <p style="color:#aaa;line-height:1.6;">Bonjour ${user.name},</p>
                <p style="color:#aaa;line-height:1.6;">Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous. Ce lien expire dans <strong style="color:#fff;">1 heure</strong>.</p>
                <div style="text-align:center;margin:32px 0;">
                    <a href="${resetLink}" style="background:#fff;color:#000;padding:14px 32px;text-decoration:none;font-weight:600;border-radius:6px;display:inline-block;font-size:1rem;">
                        Réinitialiser mon mot de passe
                    </a>
                </div>
                <p style="color:#666;font-size:0.85rem;">Si vous n'avez pas fait cette demande, ignorez cet email. Votre mot de passe ne changera pas.</p>
                <p style="color:#555;font-size:0.8rem;margin-top:32px;">© 2026 Sylver Screen Cinema, Douala Grand Mall</p>
            </div>
        `;

        await sendEmail(email, '🔑 Réinitialisation de mot de passe — Sylver Screen', html);
        res.json({ success: true, message: 'Si cet email existe, un lien vous a été envoyé.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/auth/verify-reset-token
app.get('/api/auth/verify-reset-token', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ valid: false });

    try {
        const result = await pool.query(
            'SELECT email FROM password_resets WHERE token = $1 AND used = false AND expires_at > NOW()',
            [token]
        );
        if (result.rows.length === 0) return res.json({ valid: false });
        res.json({ valid: true, email: result.rows[0].email });
    } catch (error) {
        res.status(500).json({ valid: false });
    }
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token et mot de passe requis' });
    if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' });

    try {
        const result = await pool.query(
            'SELECT email FROM password_resets WHERE token = $1 AND used = false AND expires_at > NOW()',
            [token]
        );
        if (result.rows.length === 0) return res.status(400).json({ error: 'Lien invalide ou expiré' });

        const { email } = result.rows[0];
        const hashed = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hashed, email]);
        await pool.query('UPDATE password_resets SET used = true WHERE token = $1', [token]);

        res.json({ success: true, message: 'Mot de passe mis à jour avec succès' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Start server
app.listen(PORT, async () => {
    await ensureSettingsTable();
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     🎬 SYLVER SCREEN CINEMA SERVER                   ║
║                                                       ║
║     Server running on http://localhost:${PORT}        ║
║                                                       ║
║     📍 Site: http://localhost:${PORT}/index.html      ║
║     👨‍💼 Admin: http://localhost:${PORT}/admin.html     ║
║                                                       ║
║     🗄️  Database: PostgreSQL (Supabase)              ║
║                                                       ║
║     🔐 Admin: admin@sylver-screen.com / admin123     ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
});