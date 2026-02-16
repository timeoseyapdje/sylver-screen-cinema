// server.js - Backend Node.js server with SQLite database
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'sylver-screen-secret-key-2025';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Database initialization
const db = new sqlite3.Database('./sylver_screen.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initDatabase();
    }
});

// Initialize database tables
function initDatabase() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT 0,
            email_notifications BOOLEAN DEFAULT 1,
            phone_verified BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Movies table
        db.run(`CREATE TABLE IF NOT EXISTS movies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            genre TEXT NOT NULL,
            duration INTEGER NOT NULL,
            description TEXT,
            poster_url TEXT,
            rating REAL DEFAULT 0,
            votes_count INTEGER DEFAULT 0,
            release_date DATE,
            end_date DATE,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Showtimes table
        db.run(`CREATE TABLE IF NOT EXISTS showtimes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            movie_id INTEGER NOT NULL,
            date DATE NOT NULL,
            time TIME NOT NULL,
            room TEXT NOT NULL,
            price REAL DEFAULT 3000,
            total_seats INTEGER DEFAULT 100,
            available_seats INTEGER DEFAULT 100,
            FOREIGN KEY (movie_id) REFERENCES movies(id)
        )`);

        // Bookings table
        db.run(`CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            showtime_id INTEGER NOT NULL,
            seats TEXT NOT NULL,
            total_price REAL NOT NULL,
            status TEXT DEFAULT 'confirmed',
            booking_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (showtime_id) REFERENCES showtimes(id)
        )`);

        // Ratings table
        db.run(`CREATE TABLE IF NOT EXISTS ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            movie_id INTEGER NOT NULL,
            rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, movie_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (movie_id) REFERENCES movies(id)
        )`);

        // Verification codes table
        db.run(`CREATE TABLE IF NOT EXISTS verification_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            code TEXT NOT NULL,
            method TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Newsletter subscribers
        db.run(`CREATE TABLE IF NOT EXISTS newsletter (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create admin user if not exists
        const adminPassword = bcrypt.hashSync('admin123', 10);
        db.run(`INSERT OR IGNORE INTO users (name, email, phone, password, is_admin, phone_verified) 
                VALUES ('Admin', 'admin@sylver-screen.com', '+237000000000', ?, 1, 1)`, [adminPassword], (err) => {
            if (err) {
                console.error('Error creating admin user:', err);
            } else {
                console.log('Database initialized successfully');
            }
        });
    });
}

// Email configuration (configure with your actual email settings)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'noreply@sylver-screen.com',
        pass: 'your-app-password'
    }
});

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// Admin middleware
function isAdmin(req, res, next) {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// ========== AUTH ROUTES ==========

// Register
app.post('/api/auth/register', async (req, res) => {
    const { name, email, phone, password, emailNotifications } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            `INSERT INTO users (name, email, phone, password, email_notifications) VALUES (?, ?, ?, ?, ?)`,
            [name, email, phone, hashedPassword, emailNotifications ? 1 : 0],
            function (err) {
                if (err) {
                    return res.status(400).json({ error: 'User already exists' });
                }

                const token = jwt.sign({ id: this.lastID, email, is_admin: false }, JWT_SECRET);
                res.json({
                    token,
                    user: { id: this.lastID, name, email, phone, is_admin: false }
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin }, JWT_SECRET);
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                is_admin: user.is_admin
            }
        });
    });
});

// Send verification code
app.post('/api/auth/send-verification', (req, res) => {
    const { phone, method } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    db.run(
        `INSERT INTO verification_codes (phone, code, method, expires_at) VALUES (?, ?, ?, ?)`,
        [phone, code, method, expiresAt],
        (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to send code' });
            }

            // In production, send SMS or WhatsApp message here
            console.log(`Verification code for ${phone} via ${method}: ${code}`);

            res.json({ success: true, message: 'Code sent successfully' });
        }
    );
});

// Verify phone
app.post('/api/auth/verify-phone', (req, res) => {
    const { phone, code } = req.body;

    db.get(
        `SELECT * FROM verification_codes WHERE phone = ? AND code = ? AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1`,
        [phone, code],
        (err, verification) => {
            if (err || !verification) {
                return res.status(400).json({ error: 'Invalid or expired code' });
            }

            db.run(`UPDATE users SET phone_verified = 1 WHERE phone = ?`, [phone]);
            res.json({ success: true });
        }
    );
});

// ========== MOVIES ROUTES ==========

// Get all movies
app.get('/api/movies', (req, res) => {
    db.all('SELECT * FROM movies WHERE is_active = 1 ORDER BY created_at DESC', (err, movies) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch movies' });
        }
        res.json(movies);
    });
});

// Get movie by ID
app.get('/api/movies/:id', (req, res) => {
    db.get('SELECT * FROM movies WHERE id = ?', [req.params.id], (err, movie) => {
        if (err || !movie) {
            return res.status(404).json({ error: 'Movie not found' });
        }
        res.json(movie);
    });
});

// Create movie (Admin only)
app.post('/api/movies', authenticateToken, isAdmin, (req, res) => {
    const { title, genre, duration, description, poster_url, release_date, end_date } = req.body;

    db.run(
        `INSERT INTO movies (title, genre, duration, description, poster_url, release_date, end_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, genre, duration, description, poster_url, release_date, end_date],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to create movie' });
            }
            res.json({ id: this.lastID, message: 'Movie created successfully' });
        }
    );
});

// Update movie (Admin only)
app.put('/api/movies/:id', authenticateToken, isAdmin, (req, res) => {
    const { title, genre, duration, description, poster_url, release_date, end_date, is_active } = req.body;

    db.run(
        `UPDATE movies SET title = ?, genre = ?, duration = ?, description = ?, 
         poster_url = ?, release_date = ?, end_date = ?, is_active = ? WHERE id = ?`,
        [title, genre, duration, description, poster_url, release_date, end_date, is_active, req.params.id],
        (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to update movie' });
            }
            res.json({ message: 'Movie updated successfully' });
        }
    );
});

// Delete movie (Admin only)
app.delete('/api/movies/:id', authenticateToken, isAdmin, (req, res) => {
    db.run('UPDATE movies SET is_active = 0 WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete movie' });
        }
        res.json({ message: 'Movie deleted successfully' });
    });
});

// ========== SHOWTIMES ROUTES ==========

// Get showtimes for a movie
app.get('/api/movies/:id/showtimes', (req, res) => {
    db.all(
        'SELECT * FROM showtimes WHERE movie_id = ? AND date >= date("now") ORDER BY date, time',
        [req.params.id],
        (err, showtimes) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch showtimes' });
            }
            res.json(showtimes);
        }
    );
});

// Create showtime (Admin only)
app.post('/api/showtimes', authenticateToken, isAdmin, (req, res) => {
    const { movie_id, date, time, room, price, total_seats } = req.body;

    db.run(
        `INSERT INTO showtimes (movie_id, date, time, room, price, total_seats, available_seats) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [movie_id, date, time, room, price || 3000, total_seats || 100, total_seats || 100],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to create showtime' });
            }
            res.json({ id: this.lastID, message: 'Showtime created successfully' });
        }
    );
});

// Update showtime (Admin only)
app.put('/api/showtimes/:id', authenticateToken, isAdmin, (req, res) => {
    const { date, time, room, price } = req.body;

    db.run(
        'UPDATE showtimes SET date = ?, time = ?, room = ?, price = ? WHERE id = ?',
        [date, time, room, price, req.params.id],
        (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to update showtime' });
            }
            res.json({ message: 'Showtime updated successfully' });
        }
    );
});

// Delete showtime (Admin only)
app.delete('/api/showtimes/:id', authenticateToken, isAdmin, (req, res) => {
    db.run('DELETE FROM showtimes WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete showtime' });
        }
        res.json({ message: 'Showtime deleted successfully' });
    });
});

// ========== BOOKINGS ROUTES ==========

// Create booking
app.post('/api/bookings', authenticateToken, (req, res) => {
    const { showtime_id, seats, total_price } = req.body;
    const user_id = req.user.id;

    // Check seat availability
    db.get('SELECT * FROM showtimes WHERE id = ?', [showtime_id], (err, showtime) => {
        if (err || !showtime) {
            return res.status(404).json({ error: 'Showtime not found' });
        }

        if (showtime.available_seats < seats.length) {
            return res.status(400).json({ error: 'Not enough available seats' });
        }

        // Create booking
        db.run(
            `INSERT INTO bookings (user_id, showtime_id, seats, total_price) VALUES (?, ?, ?, ?)`,
            [user_id, showtime_id, JSON.stringify(seats), total_price],
            function (err) {
                if (err) {
                    return res.status(500).json({ error: 'Failed to create booking' });
                }

                // Update available seats
                db.run(
                    'UPDATE showtimes SET available_seats = available_seats - ? WHERE id = ?',
                    [seats.length, showtime_id]
                );

                // Send confirmation email
                sendBookingConfirmation(user_id, this.lastID);

                res.json({ id: this.lastID, message: 'Booking created successfully' });
            }
        );
    });
});

// Get user bookings
app.get('/api/bookings', authenticateToken, (req, res) => {
    db.all(
        `SELECT b.*, m.title as movie_title, s.date, s.time, s.room 
         FROM bookings b 
         JOIN showtimes s ON b.showtime_id = s.id 
         JOIN movies m ON s.movie_id = m.id 
         WHERE b.user_id = ? 
         ORDER BY b.booking_time DESC`,
        [req.user.id],
        (err, bookings) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch bookings' });
            }
            res.json(bookings);
        }
    );
});

// Cancel booking
app.put('/api/bookings/:id/cancel', authenticateToken, (req, res) => {
    db.get(
        `SELECT b.*, s.date, s.time FROM bookings b 
         JOIN showtimes s ON b.showtime_id = s.id 
         WHERE b.id = ? AND b.user_id = ?`,
        [req.params.id, req.user.id],
        (err, booking) => {
            if (err || !booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            // Check if cancellation is allowed (25 minutes before showtime)
            const showtimeDate = new Date(`${booking.date} ${booking.time}`);
            const now = new Date();
            const timeDiff = (showtimeDate - now) / (1000 * 60); // minutes

            if (timeDiff < 25) {
                return res.status(400).json({ error: 'Cannot cancel less than 25 minutes before showtime' });
            }

            db.run('UPDATE bookings SET status = "cancelled" WHERE id = ?', [req.params.id], (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to cancel booking' });
                }

                // Restore available seats
                const seats = JSON.parse(booking.seats);
                db.run(
                    'UPDATE showtimes SET available_seats = available_seats + ? WHERE id = ?',
                    [seats.length, booking.showtime_id]
                );

                res.json({ message: 'Booking cancelled successfully' });
            });
        }
    );
});

// ========== RATINGS ROUTES ==========

// Rate a movie
app.post('/api/ratings', authenticateToken, (req, res) => {
    const { movie_id, rating } = req.body;
    const user_id = req.user.id;

    db.run(
        `INSERT OR REPLACE INTO ratings (user_id, movie_id, rating) VALUES (?, ?, ?)`,
        [user_id, movie_id, rating],
        (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to rate movie' });
            }

            // Update movie rating
            updateMovieRating(movie_id);
            res.json({ message: 'Rating submitted successfully' });
        }
    );
});

function updateMovieRating(movie_id) {
    db.get(
        'SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM ratings WHERE movie_id = ?',
        [movie_id],
        (err, result) => {
            if (!err && result) {
                db.run(
                    'UPDATE movies SET rating = ?, votes_count = ? WHERE id = ?',
                    [result.avg_rating, result.count, movie_id]
                );
            }
        }
    );
}

// ========== NEWSLETTER ROUTES ==========

app.post('/api/newsletter/subscribe', (req, res) => {
    const { email } = req.body;

    db.run('INSERT OR IGNORE INTO newsletter (email) VALUES (?)', [email], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Subscription failed' });
        }
        res.json({ message: 'Subscribed successfully' });
    });
});

// ========== ADMIN ROUTES ==========

// Get all users (Admin only)
app.get('/api/admin/users', authenticateToken, isAdmin, (req, res) => {
    db.all('SELECT id, name, email, phone, is_admin, email_notifications, phone_verified, created_at FROM users', (err, users) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch users' });
        }
        res.json(users);
    });
});

// Get all bookings (Admin only)
app.get('/api/admin/bookings', authenticateToken, isAdmin, (req, res) => {
    db.all(
        `SELECT b.*, u.name as user_name, u.email, m.title as movie_title, s.date, s.time, s.room 
         FROM bookings b 
         JOIN users u ON b.user_id = u.id 
         JOIN showtimes s ON b.showtime_id = s.id 
         JOIN movies m ON s.movie_id = m.id 
         ORDER BY b.booking_time DESC`,
        (err, bookings) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch bookings' });
            }
            res.json(bookings);
        }
    );
});

// Get statistics (Admin only)
app.get('/api/admin/stats', authenticateToken, isAdmin, (req, res) => {
    Promise.all([
        new Promise((resolve) => db.get('SELECT COUNT(*) as count FROM users', (err, result) => resolve(result?.count || 0))),
        new Promise((resolve) => db.get('SELECT COUNT(*) as count FROM bookings WHERE status = "confirmed"', (err, result) => resolve(result?.count || 0))),
        new Promise((resolve) => db.get('SELECT SUM(total_price) as revenue FROM bookings WHERE status = "confirmed"', (err, result) => resolve(result?.revenue || 0))),
        new Promise((resolve) => db.get('SELECT COUNT(*) as count FROM movies WHERE is_active = 1', (err, result) => resolve(result?.count || 0)))
    ]).then(([users, bookings, revenue, movies]) => {
        res.json({ users, bookings, revenue, movies });
    });
});

// Helper function to send booking confirmation email
function sendBookingConfirmation(user_id, booking_id) {
    db.get('SELECT * FROM users WHERE id = ?', [user_id], (err, user) => {
        if (err || !user || !user.email_notifications) return;

        const mailOptions = {
            from: 'noreply@sylver-screen.com',
            to: user.email,
            subject: 'Confirmation de réservation - Sylver Screen Cinema',
            html: `
                <h2>Merci pour votre réservation !</h2>
                <p>Bonjour ${user.name},</p>
                <p>Votre réservation #${booking_id} a été confirmée.</p>
                <p>Vous pouvez annuler jusqu'à 25 minutes avant la séance.</p>
                <br>
                <p>À bientôt au Sylver Screen Cinema !</p>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email:', error);
            } else {
                console.log('Email sent:', info.response);
            }
        });
    });
}

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
║     🔐 Admin login:                                   ║
║        Email: admin@sylver-screen.com                 ║
║        Password: admin123                             ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
});