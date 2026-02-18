// admin.js - Admin panel JavaScript
const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let authToken = null;
let currentUser = null;
let movies = [];
let showtimes = [];
let allShowtimes = [];

// Initialize
document.addEventListener('DOMContentLoaded', async function () {
    checkAdminAuth();
    loadStats();
    await loadMovies(); // Attendre que les films soient chargés
    loadAllShowtimes(); // Ensuite charger les séances
    loadBookings();
    loadUsers();
    loadPrices();

    // Auto-refresh toutes les 30 secondes
    setInterval(() => {
        loadStats();
        loadBookings();
    }, 30000);
});

function checkAdminAuth() {
    authToken = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');

    if (!authToken || !user) {
        window.location.href = 'index.html';
        return;
    }

    currentUser = JSON.parse(user);
    if (!currentUser.is_admin) {
        alert('Accès refusé');
        window.location.href = 'index.html';
    }
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

// ========== STATS ==========

async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const stats = await response.json();
        document.getElementById('statUsers').textContent = stats.users;
        document.getElementById('statBookings').textContent = stats.bookings;
        document.getElementById('statRevenue').textContent = stats.revenue.toLocaleString();
        document.getElementById('statMovies').textContent = stats.movies;
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

// ========== TABS ==========

function switchTab(tabName) {
    // Update tab buttons - find which tab was clicked by checking data or text
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent.toLowerCase().includes(tabName.toLowerCase()) ||
            tab.onclick.toString().includes(tabName)) {
            tab.classList.add('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
}

// ========== MOVIES ==========

function previewPoster(input) {
    const preview = document.getElementById('posterPreview');
    const file = input.files[0];

    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert('⚠️ L\'image doit faire moins de 5 MB');
            input.value = '';
            preview.innerHTML = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('moviePoster').value = e.target.result;
            preview.innerHTML = `<img src="${e.target.result}" style="max-width:200px; max-height:300px; border:1px solid #333;">`;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
    }
}

async function loadMovies() {
    try {
        const response = await fetch(`${API_URL}/movies`);
        movies = await response.json();
        displayMoviesTable(movies);
    } catch (error) {
        console.error('Load movies error:', error);
    }
}

function displayMoviesTable(moviesData) {
    const tbody = document.querySelector('#moviesTable tbody');
    tbody.innerHTML = moviesData.map(movie => `
        <tr>
            <td>${movie.id}</td>
            <td>${movie.title}</td>
            <td>${movie.genre}</td>
            <td>${movie.duration} min</td>
            <td>${movie.rating.toFixed(1)} (${movie.votes_count})</td>
            <td>${movie.release_date || '-'}</td>
            <td>${movie.is_active ? 'Actif' : 'Inactif'}</td>
            <td>
                <button class="btn-edit" onclick="editMovie(${movie.id})">Modifier</button>
                <button class="btn-delete" onclick="deleteMovie(${movie.id})">Supprimer</button>
            </td>
        </tr>
    `).join('');
}

function openAddMovieModal() {
    document.getElementById('movieFormTitle').textContent = 'AJOUTER UN FILM';
    document.getElementById('movieId').value = '';
    document.getElementById('movieTitle').value = '';
    document.getElementById('movieGenre').value = '';
    document.getElementById('movieDuration').value = '';
    document.getElementById('moviePoster').value = '';
    document.getElementById('moviePosterFile').value = '';
    document.getElementById('posterPreview').innerHTML = '';
    document.getElementById('movieReleaseDate').value = '';
    document.getElementById('movieEndDate').value = '';
    document.getElementById('movieDescription').value = '';
    document.getElementById('movieActive').checked = true;
    openModal('movieFormModal');
}

function editMovie(movieId) {
    const movie = movies.find(m => m.id === movieId);
    document.getElementById('movieFormTitle').textContent = 'MODIFIER LE FILM';
    document.getElementById('movieId').value = movie.id;
    document.getElementById('movieTitle').value = movie.title;
    document.getElementById('movieGenre').value = movie.genre;
    document.getElementById('movieDuration').value = movie.duration;
    document.getElementById('moviePoster').value = movie.poster_url || '';
    document.getElementById('moviePosterFile').value = '';

    // Show existing poster
    const preview = document.getElementById('posterPreview');
    if (movie.poster_url) {
        preview.innerHTML = `<img src="${movie.poster_url}" style="max-width:200px; max-height:300px; border:1px solid #333;">`;
    } else {
        preview.innerHTML = '';
    }

    document.getElementById('movieReleaseDate').value = movie.release_date || '';
    document.getElementById('movieEndDate').value = movie.end_date || '';
    document.getElementById('movieDescription').value = movie.description || '';
    document.getElementById('movieActive').checked = movie.is_active;
    openModal('movieFormModal');
}

async function saveMovie(event) {
    event.preventDefault();

    const movieId = document.getElementById('movieId').value;
    const data = {
        title: document.getElementById('movieTitle').value,
        genre: document.getElementById('movieGenre').value,
        duration: parseInt(document.getElementById('movieDuration').value),
        poster_url: document.getElementById('moviePoster').value,
        release_date: document.getElementById('movieReleaseDate').value,
        end_date: document.getElementById('movieEndDate').value,
        description: document.getElementById('movieDescription').value,
        is_active: document.getElementById('movieActive').checked ? 1 : 0
    };

    try {
        const url = movieId ? `${API_URL}/movies/${movieId}` : `${API_URL}/movies`;
        const method = movieId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert(movieId ? 'Film modifié avec succès' : 'Film ajouté avec succès');
            closeModal('movieFormModal');
            loadMovies();
            loadStats();
        } else {
            alert('Erreur lors de l\'enregistrement');
        }
    } catch (error) {
        console.error('Save movie error:', error);
        alert('Erreur lors de l\'enregistrement');
    }
}

async function deleteMovie(movieId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce film ?')) return;

    try {
        const response = await fetch(`${API_URL}/movies/${movieId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            alert('Film supprimé avec succès');
            loadMovies();
            loadStats();
        } else {
            alert('Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('Delete movie error:', error);
        alert('Erreur lors de la suppression');
    }
}

// ========== SHOWTIMES ==========

async function loadAllShowtimes() {
    try {
        // Load showtimes for all movies
        allShowtimes = [];
        console.log('📅 Loading showtimes for', movies.length, 'movies');
        for (const movie of movies) {
            const response = await fetch(`${API_URL}/movies/${movie.id}/showtimes?all=true`);
            const movieShowtimes = await response.json();
            console.log(`  ${movie.title}:`, movieShowtimes.length, 'showtimes');
            allShowtimes = [...allShowtimes, ...movieShowtimes.map(st => ({
                ...st,
                movie_title: movie.title
            }))];
        }
        console.log('✅ Total showtimes loaded:', allShowtimes.length);
        displayShowtimesTable(allShowtimes);
    } catch (error) {
        console.error('Load showtimes error:', error);
    }
}

function displayShowtimesTable(showtimesData) {
    const tbody = document.querySelector('#showtimesTable tbody');
    if (!showtimesData || showtimesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:#999;">Aucune séance</td></tr>';
        return;
    }

    tbody.innerHTML = showtimesData.map(st => `
        <tr>
            <td>${st.id}</td>
            <td>${st.movie_title || 'Film #' + st.movie_id}</td>
            <td>${st.date}</td>
            <td>${st.time}</td>
            <td>${st.room}</td>
            <td>${st.price} FCFA</td>
            <td>${st.available_seats}/${st.total_seats}</td>
            <td>
                <button class="btn-edit" onclick="editShowtime(${st.id})">Modifier</button>
                <button class="btn-delete" onclick="deleteShowtime(${st.id})">Supprimer</button>
            </td>
        </tr>
    `).join('');
}

function openAddShowtimeModal() {
    document.getElementById('showtimeFormTitle').textContent = 'AJOUTER UNE SÉANCE';
    document.getElementById('showtimeId').value = '';

    // Populate movie select
    const select = document.getElementById('showtimeMovie');
    select.innerHTML = movies.map(m => `<option value="${m.id}">${m.title}</option>`).join('');

    document.getElementById('showtimeDate').value = '';
    document.getElementById('showtimeTime').value = '';
    document.getElementById('showtimeRoom').value = 'Salle 1';
    document.getElementById('showtimePrice').value = '3000';
    document.getElementById('showtimeSeats').value = '60';

    openModal('showtimeFormModal');
}

function editShowtime(showtimeId) {
    const showtime = allShowtimes.find(st => st.id === showtimeId);

    document.getElementById('showtimeFormTitle').textContent = 'MODIFIER LA SÉANCE';
    document.getElementById('showtimeId').value = showtime.id;

    const select = document.getElementById('showtimeMovie');
    select.innerHTML = movies.map(m => `<option value="${m.id}" ${m.id === showtime.movie_id ? 'selected' : ''}>${m.title}</option>`).join('');

    document.getElementById('showtimeDate').value = showtime.date;
    document.getElementById('showtimeTime').value = showtime.time;
    document.getElementById('showtimeRoom').value = showtime.room;
    document.getElementById('showtimePrice').value = showtime.price;
    document.getElementById('showtimeSeats').value = showtime.total_seats;

    openModal('showtimeFormModal');
}

async function saveShowtime(event) {
    event.preventDefault();

    const showtimeId = document.getElementById('showtimeId').value;
    const data = {
        movie_id: parseInt(document.getElementById('showtimeMovie').value),
        date: document.getElementById('showtimeDate').value,
        time: document.getElementById('showtimeTime').value,
        room: document.getElementById('showtimeRoom').value,
        price: parseFloat(document.getElementById('showtimePrice').value),
        total_seats: parseInt(document.getElementById('showtimeSeats').value)
    };

    try {
        const url = showtimeId ? `${API_URL}/showtimes/${showtimeId}` : `${API_URL}/showtimes`;
        const method = showtimeId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert(showtimeId ? 'Séance modifiée avec succès' : 'Séance ajoutée avec succès');
            closeModal('showtimeFormModal');
            loadAllShowtimes();
        } else {
            alert('Erreur lors de l\'enregistrement');
        }
    } catch (error) {
        console.error('Save showtime error:', error);
        alert('Erreur lors de l\'enregistrement');
    }
}

async function deleteShowtime(showtimeId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette séance ?')) return;

    try {
        const response = await fetch(`${API_URL}/showtimes/${showtimeId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            alert('Séance supprimée avec succès');
            loadAllShowtimes();
        } else {
            alert('Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('Delete showtime error:', error);
        alert('Erreur lors de la suppression');
    }
}

// ========== BOOKINGS ==========

async function loadBookings() {
    try {
        const response = await fetch(`${API_URL}/admin/bookings`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const bookings = await response.json();
        console.log('📊 Admin bookings loaded:', bookings.length);
        console.log('Sample booking:', bookings[0]);
        displayBookingsTable(bookings);
    } catch (error) {
        console.error('Load bookings error:', error);
    }
}

function displayBookingsTable(bookingsData) {
    const tbody = document.querySelector('#bookingsTable tbody');
    if (!bookingsData || bookingsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:#999;">Aucune réservation</td></tr>';
        return;
    }

    tbody.innerHTML = bookingsData.map(booking => {
        let bookingDate = 'N/A';
        try {
            bookingDate = new Date(booking.booking_time).toLocaleString('fr-FR');
        } catch (e) {
            bookingDate = booking.booking_time;
        }

        return `
            <tr>
                <td>${booking.id}</td>
                <td>${booking.user_name}<br><small>${booking.email}</small></td>
                <td>${booking.title}</td>
                <td>${booking.date} ${booking.time}<br><small>${booking.room}</small></td>
                <td>${booking.seats}</td>
                <td>${parseInt(booking.total_price).toLocaleString('fr-FR')} FCFA</td>
                <td>${booking.status === 'confirmed' ? '✅ Confirmé' : '❌ Annulé'}</td>
                <td>${bookingDate}</td>
            </tr>
        `;
    }).join('');
}

// ========== USERS ==========

async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const users = await response.json();
        displayUsersTable(users);
    } catch (error) {
        console.error('Load users error:', error);
    }
}

function displayUsersTable(usersData) {
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = usersData.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.phone}</td>
            <td>${user.is_admin ? 'Oui' : 'Non'}</td>
            <td>${user.email_notifications ? 'Oui' : 'Non'}</td>
            <td>${user.phone_verified ? 'Oui' : 'Non'}</td>
            <td>${new Date(user.created_at).toLocaleDateString('fr-FR')}</td>
        </tr>
    `).join('');
}

// ========== MODAL FUNCTIONS ==========

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ========== PRICE SETTINGS ==========

async function loadPrices() {
    try {
        const response = await fetch(`${API_URL}/settings/prices`);
        if (response.ok) {
            const prices = await response.json();
            const adulteInput = document.getElementById('priceAdulte');
            const enfantInput = document.getElementById('priceEnfant');
            const popcornInput = document.getElementById('pricePopcorn');

            if (adulteInput) {
                adulteInput.value = '';
                adulteInput.placeholder = `Actuel : ${(prices.adulte || 3000).toLocaleString('fr-FR')} FCFA`;
            }
            if (enfantInput) {
                enfantInput.value = '';
                enfantInput.placeholder = `Actuel : ${(prices.enfant || 2000).toLocaleString('fr-FR')} FCFA`;
            }
            if (popcornInput) {
                popcornInput.value = '';
                popcornInput.placeholder = `Actuel : ${(prices.popcorn || 4000).toLocaleString('fr-FR')} FCFA`;
            }
        }
    } catch (e) {
        console.error('Could not load prices');
    }
}

async function savePrices() {
    const adulte = parseInt(document.getElementById('priceAdulte').value);
    const enfant = parseInt(document.getElementById('priceEnfant').value);
    const popcorn = parseInt(document.getElementById('pricePopcorn').value);

    // Valider que au moins UN prix est renseigné
    if (!adulte && !enfant && !popcorn) {
        alert('❌ Veuillez entrer au moins un prix');
        return;
    }

    // Valider que les prix renseignés sont >= 500
    if ((adulte && adulte < 500) || (enfant && enfant < 500) || (popcorn && popcorn < 500)) {
        alert('❌ Les prix doivent être au minimum 500 FCFA');
        return;
    }

    // Créer objet avec seulement les prix modifiés
    const updates = {};
    if (adulte) updates.adulte = adulte;
    if (enfant) updates.enfant = enfant;
    if (popcorn) updates.popcorn = popcorn;

    try {
        const response = await fetch(`${API_URL}/admin/prices`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(updates)
        });

        if (response.ok) {
            const messages = [];
            if (adulte) messages.push(`🧑 Adulte : ${adulte.toLocaleString('fr-FR')} FCFA`);
            if (enfant) messages.push(`👶 Enfant : ${enfant.toLocaleString('fr-FR')} FCFA`);
            if (popcorn) messages.push(`🍿 Popcorn : ${popcorn.toLocaleString('fr-FR')} FCFA`);
            alert(`✅ Tarifs mis à jour !\n\n${messages.join('\n')}`);
            await loadPrices(); // Recharger pour afficher les nouvelles valeurs
        } else {
            alert('❌ Erreur lors de la mise à jour des tarifs');
        }
    } catch (e) {
        alert('❌ Erreur de connexion');
    }
}

// Close modal on outside click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            closeModal(modal.id);
        }
    });
});