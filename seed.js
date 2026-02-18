// seed.js
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
    console.log('🔧 Initialisation des tables...\n');
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
        title TEXT UNIQUE NOT NULL,
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
        movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
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
    await pool.query(`CREATE TABLE IF NOT EXISTS newsletter (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Admin
    const adminPassword = await bcrypt.hash('admin123', 10);
    await pool.query(`
        INSERT INTO users (name, email, phone, password, is_admin, phone_verified)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email) DO NOTHING
    `, ['Admin', 'admin@sylver-screen.com', '+237000000000', adminPassword, true, true]);

    console.log('✅ Tables OK\n');
}

const movies = [
    {
        title: 'Wicked',
        genre: 'Musical / Fantasy',
        duration: 160,
        description: 'L\'histoire inédite des sorcières d\'Oz avant l\'arrivée de Dorothy. Avec Cynthia Erivo et Ariana Grande dans un spectacle musical époustouflant.',
        poster_url: 'https://upload.wikimedia.org/wikipedia/en/5/5c/Wicked_2024_film_poster.jpg',
        release_date: '2025-01-10',
        end_date: '2025-05-15'
    },
    {
        title: 'Moana 2',
        genre: 'Animation / Aventure',
        duration: 100,
        description: 'Vaiana reçoit un appel inattendu de ses ancêtres et doit voyager vers des mers lointaines inexplorées pour une aventure épique.',
        poster_url: 'https://upload.wikimedia.org/wikipedia/en/6/6a/Moana_2_poster.jpg',
        release_date: '2025-01-05',
        end_date: '2025-04-20'
    },
    {
        title: 'Nosferatu',
        genre: 'Horreur / Gothique',
        duration: 132,
        description: 'Robert Eggers signe une réinterprétation gothique et terrifiante du mythe du comte Orlok. Un chef-d\'œuvre visuel.',
        poster_url: 'https://upload.wikimedia.org/wikipedia/en/9/91/Nosferatu_2024_film_poster.jpg',
        release_date: '2025-01-15',
        end_date: '2025-03-30'
    },
    {
        title: 'Captain America: Brave New World',
        genre: 'Action / Super-héros',
        duration: 118,
        description: 'Sam Wilson endosse le bouclier de Captain America et se retrouve au cœur d\'un complot international qui menace le monde entier.',
        poster_url: 'https://upload.wikimedia.org/wikipedia/en/b/b4/Captain_America_Brave_New_World_poster.jpg',
        release_date: '2025-02-14',
        end_date: '2025-05-01'
    },
    {
        title: 'Mickey 17',
        genre: 'Science-Fiction',
        duration: 137,
        description: 'Un homme sacrifiable est envoyé en mission suicide sur une planète glaciale. Bong Joon-ho adapte le roman d\'Edward Ashton avec Robert Pattinson.',
        poster_url: 'https://upload.wikimedia.org/wikipedia/en/5/5b/Mickey_17_film_poster.jpg',
        release_date: '2025-03-07',
        end_date: '2025-05-30'
    },
    {
        title: 'Black Bag',
        genre: 'Thriller / Espionnage',
        duration: 94,
        description: 'Un agent des services secrets doit déterminer si sa propre femme est une traîtresse. Steven Soderbergh dirige Cate Blanchett et Michael Fassbender.',
        poster_url: 'https://upload.wikimedia.org/wikipedia/en/2/25/Black_Bag_2025_film_poster.jpg',
        release_date: '2025-03-14',
        end_date: '2025-05-20'
    }
];

async function seed() {
    console.log('🌱 Remplissage de la base de données...\n');

    try {
        await initDatabase();

        // 1. Films - ajouter seulement les nouveaux
        console.log('🎬 Vérification des films...');

        let addedMovies = 0;
        let updatedMovies = 0;

        for (const movie of movies) {
            const rating = (3.5 + Math.random() * 1.5).toFixed(1);
            const votes = Math.floor(50 + Math.random() * 300);

            // Vérifier si le film existe déjà
            const existing = await pool.query('SELECT id FROM movies WHERE title = $1', [movie.title]);

            if (existing.rows.length === 0) {
                await pool.query(
                    `INSERT INTO movies (title, genre, duration, description, poster_url, release_date, end_date, rating, votes_count)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [movie.title, movie.genre, movie.duration, movie.description, movie.poster_url,
                    movie.release_date, movie.end_date, rating, votes]
                );
                addedMovies++;
                console.log(`   ✓ ${movie.title} ajouté`);
            } else {
                // Mettre à jour le poster et la description si différents
                await pool.query(
                    `UPDATE movies SET poster_url = $1, description = $2, genre = $3 WHERE title = $4`,
                    [movie.poster_url, movie.description, movie.genre, movie.title]
                );
                updatedMovies++;
                console.log(`   ↻ ${movie.title} mis à jour`);
            }
        }
        console.log(`   📊 ${addedMovies} ajoutés, ${updatedMovies} mis à jour`);

        // 2. Séances
        console.log('\n📅 Ajout des séances...');
        const now = new Date();
        const currentHour = now.getHours();

        // Horaires proches pour tester (dans les prochaines heures)
        const slots = [
            { time: '14:00', room: 'Salle 1' },
            { time: '16:30', room: 'Salle 2' },
            { time: '19:00', room: 'Salle 1' },
            { time: '21:30', room: 'Salle 2' }
        ];

        const movieResult = await pool.query('SELECT id FROM movies ORDER BY id');
        const movieIds = movieResult.rows.map(r => r.id);
        let count = 0;

        for (const movieId of movieIds) {
            // Séances aujourd'hui + demain seulement
            for (let d = 0; d < 2; d++) {
                const date = new Date();
                date.setDate(date.getDate() + d);
                const dateStr = date.toISOString().split('T')[0];

                // Si c'est aujourd'hui, filtrer les horaires déjà passés
                let availableSlots = [...slots];
                if (d === 0) {
                    availableSlots = slots.filter(slot => {
                        const hour = parseInt(slot.time.split(':')[0]);
                        return hour > currentHour + 1; // Au moins 1h dans le futur
                    });
                }

                // 2 séances par jour
                const daySlots = availableSlots.sort(() => Math.random() - 0.5).slice(0, Math.min(2, availableSlots.length));
                for (const slot of daySlots) {
                    const available = 60 - Math.floor(Math.random() * 10);

                    // Vérifier si cette séance existe déjà
                    const existing = await pool.query(
                        'SELECT id FROM showtimes WHERE movie_id = $1 AND date = $2 AND time = $3 AND room = $4',
                        [movieId, dateStr, slot.time, slot.room]
                    );

                    if (existing.rows.length === 0) {
                        await pool.query(
                            `INSERT INTO showtimes (movie_id, date, time, room, price, total_seats, available_seats)
                             VALUES ($1, $2, $3, $4, 3000, 60, $5)`,
                            [movieId, dateStr, slot.time, slot.room, available]
                        );
                        count++;
                    }
                }
            }
        }
        console.log(`   ✓ ${count} séances créées`);

        // 3. Utilisateurs test
        console.log('\n👥 Utilisateurs de test...');
        const testPassword = await bcrypt.hash('test123', 10);
        const testUsers = [
            { name: 'Jean Dupont', email: 'jean@example.com', phone: '+237670000001' },
            { name: 'Marie Kouam', email: 'marie@example.com', phone: '+237670000002' },
            { name: 'Paul Mbella', email: 'paul@example.com', phone: '+237670000003' }
        ];
        for (const u of testUsers) {
            await pool.query(
                `INSERT INTO users (name, email, phone, password, phone_verified, email_notifications)
                 VALUES ($1, $2, $3, $4, true, true) ON CONFLICT (email) DO NOTHING`,
                [u.name, u.email, u.phone, testPassword]
            );
            console.log(`   ✓ ${u.name}`);
        }

        console.log('\n✅ Base de données prête !');
        console.log(`\n📊 ${movies.length} films · ${count} séances`);
        console.log('\n🔐 Admin: admin@sylver-screen.com / admin123');
        console.log('👥 Test: jean@example.com / test123\n');

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

seed();