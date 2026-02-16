// server.js - Backend avec PostgreSQL (Supabase)
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
app.use(bodyParser.json());
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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                is_admin BOOLEAN DEFAULT false,
                email_notifications BOOLEAN DEFAULT true,
                phone_verified BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS movies (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                genre TEXT NOT NULL,
                duration INTEGER NOT NULL,
                description TEXT,
                poster_url TEXT,
                rating REAL DEFAULT 0,
                votes_count INTEGER DEFAULT 0,
                release_date DATE,
                end_date DATE,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS showtimes (
                id SERIAL PRIMARY KEY,
                movie_id INTEGER NOT NULL REFERENCES movies(id),
                date DATE NOT NULL,
                time TIME NOT NULL,
                room TEXT NOT NULL,
                price REAL DEFAULT 3000,
                total_seats INTEGER DEFAULT 100,
                available_seats INTEGER DEFAULT 100
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS bookings (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                showtime_id INTEGER NOT NULL REFERENCES showtimes(id),
                seats TEXT NOT NULL,
                total_price REAL NOT NULL,
                status TEXT DEFAULT 'confirmed',
                booking_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS ratings (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                movie_id INTEGER NOT NULL REFERENCES movies(id),
                rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, movie_id)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS verification_codes (
                id SERIAL PRIMARY KEY,
                phone TEXT NOT NULL,
                code TEXT NOT NULL,
                method TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS newsletter (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        await pool.query(`
            INSERT INTO users (name, email, phone, password, is_admin, phone_verified)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO NOTHING
        `, ['Admin', 'admin@sylver-screen.com', '+237000000000', adminPassword, true, true]);

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
    const { name, email, phone, password, emailNotifications } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (name, email, phone, password, email_notifications) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [name, email, phone, hashedPassword, emailNotifications]
        );
        const token = jwt.sign({ id: result.rows[0].id, email, is_admin: false }, JWT_SECRET);
        res.json({ token, user: { id: result.rows[0].id, name, email, phone, is_admin: false } });
    } catch (error) {
        res.status(400).json({ error: 'User already exists' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin }, JWT_SECRET);
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, is_admin: user.is_admin } });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/auth/send-verification', async (req, res) => {
    const { phone, method } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
        await pool.query(
            'INSERT INTO verification_codes (phone, code, method, expires_at) VALUES ($1, $2, $3, $4)',
            [phone, code, method, expiresAt]
        );
        console.log(`Verification code for ${phone} via ${method}: ${code}`);
        res.json({ success: true, message: 'Code sent successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send code' });
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

app.get('/api/movies', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM movies WHERE is_active = true ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
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
    const { title, genre, duration, description, poster_url, release_date, end_date } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO movies (title, genre, duration, description, poster_url, release_date, end_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [title, genre, duration, description, poster_url, release_date, end_date]
        );
        res.json({ id: result.rows[0].id, message: 'Movie created successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create movie' });
    }
});

app.put('/api/movies/:id', authenticateToken, isAdmin, async (req, res) => {
    const { title, genre, duration, description, poster_url, release_date, end_date, is_active } = req.body;
    try {
        await pool.query(
            'UPDATE movies SET title=$1, genre=$2, duration=$3, description=$4, poster_url=$5, release_date=$6, end_date=$7, is_active=$8 WHERE id=$9',
            [title, genre, duration, description, poster_url, release_date, end_date, is_active, req.params.id]
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
        const result = await pool.query(
            'SELECT * FROM showtimes WHERE movie_id = $1 AND date >= CURRENT_DATE ORDER BY date, time',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch showtimes' });
    }
});

app.post('/api/showtimes', authenticateToken, isAdmin, async (req, res) => {
    const { movie_id, date, time, room, price, total_seats } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO showtimes (movie_id, date, time, room, price, total_seats, available_seats) VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id',
            [movie_id, date, time, room, price || 3000, total_seats || 100]
        );
        res.json({ id: result.rows[0].id, message: 'Showtime created successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create showtime' });
    }
});

app.put('/api/showtimes/:id', authenticateToken, isAdmin, async (req, res) => {
    const { date, time, room, price } = req.body;
    try {
        await pool.query(
            'UPDATE showtimes SET date=$1, time=$2, room=$3, price=$4 WHERE id=$5',
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

app.post('/api/bookings', authenticateToken, async (req, res) => {
    const { showtime_id, seats, total_price } = req.body;
    const user_id = req.user.id;

    try {
        const showtimeResult = await pool.query('SELECT * FROM showtimes WHERE id = $1', [showtime_id]);
        if (showtimeResult.rows.length === 0) return res.status(404).json({ error: 'Showtime not found' });

        const showtime = showtimeResult.rows[0];
        if (showtime.available_seats < seats.length) return res.status(400).json({ error: 'Not enough available seats' });

        const result = await pool.query(
            'INSERT INTO bookings (user_id, showtime_id, seats, total_price) VALUES ($1, $2, $3, $4) RETURNING id',
            [user_id, showtime_id, JSON.stringify(seats), total_price]
        );

        await pool.query('UPDATE showtimes SET available_seats = available_seats - $1 WHERE id = $2', [seats.length, showtime_id]);
        res.json({ id: result.rows[0].id, message: 'Booking created successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

app.get('/api/bookings', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*, m.title as movie_title, s.date, s.time, s.room 
            FROM bookings b 
            JOIN showtimes s ON b.showtime_id = s.id 
            JOIN movies m ON s.movie_id = m.id 
            WHERE b.user_id = $1 
            ORDER BY b.booking_time DESC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

app.put('/api/bookings/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*, s.date, s.time FROM bookings b 
            JOIN showtimes s ON b.showtime_id = s.id 
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

// ========== ADMIN ROUTES ==========

app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, email, phone, is_admin, email_notifications, phone_verified, created_at FROM users');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.get('/api/admin/bookings', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*, u.name as user_name, u.email, m.title as movie_title, s.date, s.time, s.room 
            FROM bookings b 
            JOIN users u ON b.user_id = u.id 
            JOIN showtimes s ON b.showtime_id = s.id 
            JOIN movies m ON s.movie_id = m.id 
            ORDER BY b.booking_time DESC
        `);
        res.json(result.rows);
    } catch (error) {
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

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     🎬 SYLVER SCREEN CINEMA SERVER                   ║
║                                                       ║
║     Server running on http://localhost:${PORT}        ║
║                                                       ║
║     📍 Site public: http://localhost:${PORT}/index.html      ║
║     👨‍💼 Admin panel: http://localhost:${PORT}/admin.html     ║
║                                                       ║
║     🗄️  Database: PostgreSQL (Supabase)              ║
║                                                       ║
║     🔐 Admin login:                                   ║
║        Email: admin@sylver-screen.com                 ║
║        Password: admin123                             ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
});