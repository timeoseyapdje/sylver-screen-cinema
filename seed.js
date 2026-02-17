// seed.js - Remplir la base PostgreSQL avec des données de démonstration
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables first
async function initDatabase() {
    console.log('🔧 Initialisation des tables de la base de données...\n');

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
            total_seats INTEGER DEFAULT 100,
            available_seats INTEGER DEFAULT 100
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            showtime_id INTEGER NOT NULL REFERENCES showtimes(id),
            seats TEXT NOT NULL,
            total_price REAL NOT NULL,
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

        await pool.query(`CREATE TABLE IF NOT EXISTS newsletter (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        await pool.query(`
            INSERT INTO users (name, email, phone, password, is_admin, phone_verified)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO NOTHING
        `, ['Admin', 'admin@sylver-screen.com', '+237000000000', adminPassword, true, true]);

        console.log('✅ Tables créées avec succès\n');
    } catch (error) {
        console.error('❌ Erreur lors de la création des tables:', error);
        throw error;
    }
}

// Films de démonstration
const movies = [
    {
        title: 'Indomptable',
        genre: 'Drame Camerounais',
        duration: 120,
        description: 'Un film puissant sur la résilience et la détermination camerounaise.',
        poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400',
        release_date: '2025-02-01',
        end_date: '2025-04-30'
    },
    {
        title: 'Wicked',
        genre: 'Musical/Fantasy',
        duration: 160,
        description: 'L\'histoire inédite des sorcières d\'Oz avant l\'arrivée de Dorothy.',
        poster_url: 'https://images.unsplash.com/photo-1594908900066-3f47337549d8?w=400',
        release_date: '2025-02-10',
        end_date: '2025-05-15'
    },
    {
        title: 'Moana 2',
        genre: 'Animation/Aventure',
        duration: 100,
        description: 'Moana part pour une nouvelle aventure épique à travers l\'océan Pacifique.',
        poster_url: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=400',
        release_date: '2025-02-05',
        end_date: '2025-04-20'
    },
    {
        title: 'Nosferatu',
        genre: 'Horreur',
        duration: 132,
        description: 'Une réinterprétation gothique du classique vampire.',
        poster_url: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400',
        release_date: '2025-02-15',
        end_date: '2025-03-30'
    },
    {
        title: 'Dune: Part Three',
        genre: 'Science-Fiction/Épique',
        duration: 165,
        description: 'La conclusion épique de la trilogie Dune.',
        poster_url: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400',
        release_date: '2025-02-20',
        end_date: '2025-06-01'
    },
    {
        title: 'Les Lions de la Téranga',
        genre: 'Comédie Camerounaise',
        duration: 95,
        description: 'Une comédie hilarante sur une équipe de football amateur.',
        poster_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400',
        release_date: '2025-02-12',
        end_date: '2025-04-12'
    }
];

async function seed() {
    console.log('🌱 Début du remplissage de la base de données PostgreSQL...\n');

    try {
        // First, initialize database tables
        await initDatabase();

        // 1. Insérer les films
        console.log('🎬 Ajout des films...');
        for (const movie of movies) {
            const rating = (3.5 + Math.random() * 1.5).toFixed(1);
            const votes = Math.floor(50 + Math.random() * 300);

            // Check if movie already exists
            const existing = await pool.query('SELECT id FROM movies WHERE title = $1', [movie.title]);

            if (existing.rows.length === 0) {
                await pool.query(
                    `INSERT INTO movies (title, genre, duration, description, poster_url, release_date, end_date, rating, votes_count)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [movie.title, movie.genre, movie.duration, movie.description, movie.poster_url,
                    movie.release_date, movie.end_date, rating, votes]
                );
                console.log(`   ✓ ${movie.title} (${movie.genre})`);
            } else {
                console.log(`   ⊙ ${movie.title} (déjà présent)`);
            }
        }

        // 2. Insérer les séances
        console.log('\n📅 Ajout des séances...');

        // Corriger les séances existantes à 150 places → 60
        await pool.query(`UPDATE showtimes SET total_seats = 60, available_seats = LEAST(available_seats, 60) WHERE total_seats = 150`);

        // Supprimer les séances passées
        await pool.query('DELETE FROM showtimes WHERE date < CURRENT_DATE');

        const showtimes = [
            { time: '11:00', room: 'Salle 1' },
            { time: '14:00', room: 'Salle 1' },
            { time: '17:00', room: 'Salle 2' },
            { time: '20:00', room: 'Salle 1' },
            { time: '21:30', room: 'Salle 2' }
        ];

        let showtimeCount = 0;

        // Get all movie IDs
        const movieResult = await pool.query('SELECT id FROM movies');
        const movieIds = movieResult.rows.map(row => row.id);

        for (const movieId of movieIds) {
            const numShowtimes = 3 + Math.floor(Math.random() * 3);

            for (let i = 0; i < numShowtimes; i++) {
                const daysAhead = Math.floor(Math.random() * 7);
                const date = new Date();
                date.setDate(date.getDate() + daysAhead);
                const dateStr = date.toISOString().split('T')[0];

                const showtime = showtimes[Math.floor(Math.random() * showtimes.length)];
                const seats = 60;
                const available = seats - Math.floor(Math.random() * 15);

                // Check if this showtime already exists
                const existing = await pool.query(
                    'SELECT id FROM showtimes WHERE movie_id = $1 AND date = $2 AND time = $3',
                    [movieId, dateStr, showtime.time]
                );

                if (existing.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO showtimes (movie_id, date, time, room, price, total_seats, available_seats)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [movieId, dateStr, showtime.time, showtime.room, 3000, seats, available]
                    );
                    showtimeCount++;
                }
            }
        }
        console.log(`   ✓ ${showtimeCount} séances ajoutées`);

        // 3. Ajouter des utilisateurs de test
        console.log('\n👥 Ajout d\'utilisateurs de test...');
        const testUsers = [
            { name: 'Jean Dupont', email: 'jean@example.com', phone: '+237670000001' },
            { name: 'Marie Kouam', email: 'marie@example.com', phone: '+237670000002' },
            { name: 'Paul Mbella', email: 'paul@example.com', phone: '+237670000003' }
        ];

        const testPassword = await bcrypt.hash('test123', 10);
        for (const user of testUsers) {
            await pool.query(
                `INSERT INTO users (name, email, phone, password, phone_verified, email_notifications)
                 VALUES ($1, $2, $3, $4, true, true)
                 ON CONFLICT (email) DO NOTHING`,
                [user.name, user.email, user.phone, testPassword]
            );
            console.log(`   ✓ ${user.name} (${user.email})`);
        }

        console.log('\n✅ Base de données remplie avec succès !');
        console.log('\n📊 Résumé :');
        console.log(`   • ${movies.length} films`);
        console.log(`   • ${showtimeCount} séances`);
        console.log(`   • ${testUsers.length} utilisateurs de test`);
        console.log('\n🔐 Compte Admin :');
        console.log('   Email: admin@sylver-screen.com');
        console.log('   Password: admin123');
        console.log('\n👥 Comptes de test :');
        console.log('   Email: jean@example.com / marie@example.com / paul@example.com');
        console.log('   Password: test123\n');

    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

seed();