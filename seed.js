// seed.js - Script pour remplir la base de données avec des données de démonstration
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./sylver_screen.db', (err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données:', err);
        process.exit(1);
    }
    console.log('📦 Connexion à la base de données...');
});

// Films de démonstration
const movies = [
    {
        title: 'Indomptable',
        genre: 'Drame Camerounais',
        duration: 120,
        description: 'Un film puissant sur la résilience et la détermination camerounaise. L\'histoire inspirante d\'un champion qui refuse d\'abandonner.',
        poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400',
        release_date: '2025-02-01',
        end_date: '2025-04-30'
    },
    {
        title: 'Wicked',
        genre: 'Musical/Fantasy',
        duration: 160,
        description: 'L\'histoire inédite des sorcières d\'Oz avant l\'arrivée de Dorothy. Une aventure musicale époustouflante.',
        poster_url: 'https://images.unsplash.com/photo-1594908900066-3f47337549d8?w=400',
        release_date: '2025-02-10',
        end_date: '2025-05-15'
    },
    {
        title: 'Moana 2',
        genre: 'Animation/Aventure',
        duration: 100,
        description: 'Moana part pour une nouvelle aventure épique à travers l\'océan Pacifique. Une suite magique pour toute la famille.',
        poster_url: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=400',
        release_date: '2025-02-05',
        end_date: '2025-04-20'
    },
    {
        title: 'Nosferatu',
        genre: 'Horreur',
        duration: 132,
        description: 'Une réinterprétation gothique du classique vampire. Terreur et suspense dans cette nouvelle version sombre.',
        poster_url: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400',
        release_date: '2025-02-15',
        end_date: '2025-03-30'
    },
    {
        title: 'Dune: Part Three',
        genre: 'Science-Fiction/Épique',
        duration: 165,
        description: 'La conclusion épique de la trilogie Dune. Paul Atreides face à son destin ultime.',
        poster_url: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400',
        release_date: '2025-02-20',
        end_date: '2025-06-01'
    },
    {
        title: 'Les Lions de la Téranga',
        genre: 'Comédie Camerounaise',
        duration: 95,
        description: 'Une comédie hilarante sur une équipe de football amateur qui rêve de participer à la CAN. Rires garantis !',
        poster_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400',
        release_date: '2025-02-12',
        end_date: '2025-04-12'
    }
];

// Séances à créer
const showtimesTemplate = [
    { time: '11:00', room: 'Salle 1' },
    { time: '14:00', room: 'Salle 1' },
    { time: '17:00', room: 'Salle 2' },
    { time: '20:00', room: 'Salle 1' },
    { time: '21:30', room: 'Salle 2' }
];

// Générer les dates pour les 7 prochains jours
function getNextDays(count = 7) {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < count; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
}

// Fonction principale
async function seed() {
    console.log('🌱 Début du remplissage de la base de données...\n');

    db.serialize(() => {
        // 1. Insérer les films
        console.log('🎬 Ajout des films...');
        const movieStmt = db.prepare(`
            INSERT INTO movies (title, genre, duration, description, poster_url, release_date, end_date, rating, votes_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        movies.forEach((movie, index) => {
            const rating = (3.5 + Math.random() * 1.5).toFixed(1); // Notes entre 3.5 et 5
            const votes = Math.floor(50 + Math.random() * 300); // Entre 50 et 350 votes

            movieStmt.run(
                movie.title,
                movie.genre,
                movie.duration,
                movie.description,
                movie.poster_url,
                movie.release_date,
                movie.end_date,
                rating,
                votes
            );
            console.log(`   ✓ ${movie.title} (${movie.genre})`);
        });

        movieStmt.finalize();

        // 2. Insérer les séances
        console.log('\n📅 Ajout des séances...');
        const showtimeStmt = db.prepare(`
            INSERT INTO showtimes (movie_id, date, time, room, price, total_seats, available_seats)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const dates = getNextDays(7);
        let showtimeCount = 0;

        movies.forEach((movie, movieIndex) => {
            const movieId = movieIndex + 1;

            // Ajouter 3-5 séances par film sur les prochains jours
            const numShowtimes = 3 + Math.floor(Math.random() * 3);

            for (let i = 0; i < numShowtimes; i++) {
                const dateIndex = Math.floor(Math.random() * dates.length);
                const showtimeIndex = Math.floor(Math.random() * showtimesTemplate.length);

                const date = dates[dateIndex];
                const showtime = showtimesTemplate[showtimeIndex];
                const seats = showtime.room === 'Salle 1' ? 150 : 150;
                const availableSeats = seats - Math.floor(Math.random() * 30); // Quelques places déjà réservées

                showtimeStmt.run(
                    movieId,
                    date,
                    showtime.time,
                    showtime.room,
                    3000, // Prix standard
                    seats,
                    availableSeats
                );
                showtimeCount++;
            }
        });

        showtimeStmt.finalize();
        console.log(`   ✓ ${showtimeCount} séances ajoutées`);

        // 3. Ajouter quelques utilisateurs de test
        console.log('\n👥 Ajout d\'utilisateurs de test...');
        const userStmt = db.prepare(`
            INSERT INTO users (name, email, phone, password, phone_verified, email_notifications)
            VALUES (?, ?, ?, ?, 1, 1)
        `);

        const testUsers = [
            { name: 'Jean Dupont', email: 'jean@example.com', phone: '+237670000001' },
            { name: 'Marie Kouam', email: 'marie@example.com', phone: '+237670000002' },
            { name: 'Paul Mbella', email: 'paul@example.com', phone: '+237670000003' }
        ];

        const testPassword = bcrypt.hashSync('test123', 10);

        testUsers.forEach(user => {
            userStmt.run(user.name, user.email, user.phone, testPassword);
            console.log(`   ✓ ${user.name} (${user.email})`);
        });

        userStmt.finalize();

        // 4. Ajouter quelques réservations
        console.log('\n🎫 Ajout de réservations de démonstration...');
        const bookingStmt = db.prepare(`
            INSERT INTO bookings (user_id, showtime_id, seats, total_price, status)
            VALUES (?, ?, ?, ?, ?)
        `);

        for (let i = 0; i < 10; i++) {
            const userId = 2 + Math.floor(Math.random() * 3); // Users 2, 3, ou 4
            const showtimeId = 1 + Math.floor(Math.random() * showtimeCount);
            const numSeats = 1 + Math.floor(Math.random() * 4); // 1-4 places
            const seats = [];
            for (let s = 0; s < numSeats; s++) {
                seats.push(10 + i * 10 + s); // Places aléatoires
            }

            bookingStmt.run(
                userId,
                showtimeId,
                JSON.stringify(seats),
                numSeats * 3000,
                'confirmed'
            );
        }

        bookingStmt.finalize();
        console.log('   ✓ 10 réservations ajoutées');

        // 5. Ajouter des notes
        console.log('\n⭐ Ajout de notes de films...');
        const ratingStmt = db.prepare(`
            INSERT INTO ratings (user_id, movie_id, rating)
            VALUES (?, ?, ?)
        `);

        for (let userId = 2; userId <= 4; userId++) {
            for (let movieId = 1; movieId <= movies.length; movieId++) {
                if (Math.random() > 0.3) { // 70% de chance de noter
                    const rating = 3 + Math.floor(Math.random() * 3); // 3-5 étoiles
                    ratingStmt.run(userId, movieId, rating);
                }
            }
        }

        ratingStmt.finalize();
        console.log('   ✓ Notes ajoutées');

        console.log('\n✅ Base de données remplie avec succès !');
        console.log('\n📊 Résumé :');
        console.log(`   • ${movies.length} films`);
        console.log(`   • ${showtimeCount} séances`);
        console.log(`   • ${testUsers.length} utilisateurs de test`);
        console.log(`   • 10 réservations`);
        console.log(`   • Notes sur les films`);
        console.log('\n🔐 Compte Admin :');
        console.log('   Email: admin@sylver-screen.com');
        console.log('   Password: admin123');
        console.log('\n👥 Comptes de test :');
        console.log('   Email: jean@example.com / marie@example.com / paul@example.com');
        console.log('   Password: test123');
        console.log('\n🚀 Vous pouvez maintenant démarrer le serveur : npm start\n');
    });

    // Fermer la connexion
    db.close((err) => {
        if (err) {
            console.error('Erreur lors de la fermeture:', err);
        }
        process.exit(0);
    });
}

// Exécuter le seed
seed().catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
});