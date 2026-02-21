// admin.js - Admin panel JavaScript
const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let authToken = null;
let currentUser = null;
let movies = [];
let showtimes = [];
let allShowtimes = [];

// ========== TOAST & DIALOG ==========

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: ${type === 'error' ? '#dc2626' : '#fff'};
        color: ${type === 'error' ? '#fff' : '#000'};
        padding: 1rem 1.5rem;
        border-radius: 4px;
        font-family: Montserrat, sans-serif;
        font-size: 0.9rem;
        font-weight: 600;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 400px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3500);
}

function showConfirmDialog(message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: #1a1a1a;
        border: 1px solid #333;
        padding: 2rem;
        max-width: 400px;
        width: 90%;
        text-align: center;
    `;

    dialog.innerHTML = `
        <p style="color: #fff; margin-bottom: 2rem; line-height: 1.6; white-space: pre-line;">${message}</p>
        <div style="display: flex; gap: 1rem;">
            <button class="cancelBtn" style="flex: 1; padding: 0.75rem; background: #000; border: 1px solid #fff; color: #fff; cursor: pointer; font-family: Montserrat, sans-serif; font-weight: 600;">Annuler</button>
            <button class="confirmBtn" style="flex: 1; padding: 0.75rem; background: #fff; border: none; color: #000; cursor: pointer; font-family: Montserrat, sans-serif; font-weight: 600;">Confirmer</button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    dialog.querySelector('.cancelBtn').onclick = () => overlay.remove();
    dialog.querySelector('.confirmBtn').onclick = () => {
        overlay.remove();
        if (onConfirm) onConfirm();
    };
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}


// Initialize
document.addEventListener('DOMContentLoaded', async function () {
    checkAdminAuth();
    loadStats();
    await loadMovies(); // Attendre que les films soient chargés
    loadAllShowtimes(); // Ensuite charger les séances
    loadBookings();
    loadUsers();
    loadPrices();
    loadNewsletter();

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
        showToast('Accès refusé', 'error');
        setTimeout(() => window.location.href = 'index.html', 1500);
        return;
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

function toggleArchive(archiveId) {
    const archive = document.getElementById(archiveId + 'Archive');
    const icon = document.getElementById(archiveId + 'Icon');

    if (archive.style.display === 'none') {
        archive.style.display = 'block';
        icon.textContent = '▲';
    } else {
        archive.style.display = 'none';
        icon.textContent = '▼';
    }
}

// ========== MOVIES ==========

function previewPosterUrl(url) {
    const preview = document.getElementById('posterPreview');
    if (!url || url.trim() === '') {
        preview.innerHTML = '';
        return;
    }
    preview.innerHTML = `<img src="${url}" alt="Aperçu" style="max-width:150px; max-height:220px; object-fit:cover; border:1px solid #333; border-radius:6px;" onerror="this.parentElement.innerHTML='<p style=color:#e55>URL invalide ou image inaccessible</p>'">`;
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
    if (!tbody) {
        console.error('moviesTable tbody not found');
        return;
    }

    if (!moviesData || !Array.isArray(moviesData) || moviesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem; color:#999;">Aucun film</td></tr>';
        return;
    }

    tbody.innerHTML = moviesData.map(movie => {
        const posterImg = movie.poster_url
            ? `<img src="${movie.poster_url}" style="width:50px; height:75px; object-fit:cover; border:1px solid #333;">`
            : '<span style="color:#666;">-</span>';

        return `
            <tr>
                <td>${movie.id}</td>
                <td>${posterImg}</td>
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
        `;
    }).join('');
}

function openAddMovieModal() {
    document.getElementById('movieFormTitle').textContent = 'AJOUTER UN FILM';
    document.getElementById('movieId').value = '';
    document.getElementById('movieTitle').value = '';
    document.getElementById('movieGenre').value = '';
    document.getElementById('movieDuration').value = '';
    document.getElementById('moviePoster').value = '';
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

    // Show existing poster
    previewPosterUrl(movie.poster_url || '');

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
            showToast(movieId ? 'Film modifié' : 'Film ajouté');
            closeModal('movieFormModal');
            loadMovies();
            loadStats();
        } else {
            showToast('Erreur lors de l\'enregistrement', 'error');
        }
    } catch (error) {
        console.error('Save movie error:', error);
        showToast('Erreur lors de l\'enregistrement', 'error');
    }
}

async function deleteMovie(movieId) {
    showConfirmDialog('Supprimer ce film ?', async () => {
        try {
            const response = await fetch(`${API_URL}/movies/${movieId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (response.ok) {
                showToast('Film supprimé');
                loadMovies();
                loadStats();
            } else {
                showToast('Erreur lors de la suppression', 'error');
            }
        } catch (error) {
            console.error('Delete movie error:', error);
            showToast('Erreur lors de la suppression', 'error');
        }
    });
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
    if (!showtimesData || !Array.isArray(showtimesData)) {
        console.error('Invalid showtimesData:', showtimesData);
        const tbody = document.querySelector('#showtimesTable tbody');
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:#999;">Erreur de chargement</td></tr>';
        document.getElementById('pastShowtimesCount').textContent = '0';
        document.getElementById('pastShowtimesRevenue').textContent = '0';
        return;
    }

    const now = new Date();

    // Séparer futures et passées
    const future = [];
    const past = [];

    showtimesData.forEach(st => {
        try {
            // Extraire date string proprement
            const dateStr = typeof st.date === 'string' ? st.date.split('T')[0] : st.date;
            const timeStr = typeof st.time === 'string' ? st.time.substring(0, 8) : st.time;
            const showtimeDate = new Date(`${dateStr}T${timeStr}`);

            if (showtimeDate > now) {
                future.push(st);
            } else {
                past.push(st);
            }
        } catch (e) {
            console.error('Error parsing showtime date:', st.id, e);
            // En cas d'erreur, mettre en passé par défaut
            past.push(st);
        }
    });

    // Afficher séances futures
    const tbody = document.querySelector('#showtimesTable tbody');
    console.log('📅 Showtimes: Future=', future.length, 'Past=', past.length);

    if (future.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:#999;">Aucune séance à venir</td></tr>';
    } else {
        tbody.innerHTML = future.map(st => `
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

    // Calculer revenus totaux des séances passées
    let totalRevenue = 0;
    past.forEach(st => {
        const sold = (st.total_seats || 0) - (st.available_seats || 0);
        const price = st.price || 0;
        if (!isNaN(sold) && !isNaN(price)) {
            totalRevenue += sold * price;
        }
    });

    // Afficher séances passées dans archive
    const pastTbody = document.querySelector('#pastShowtimesTable tbody');
    document.getElementById('pastShowtimesCount').textContent = past.length;
    document.getElementById('pastShowtimesRevenue').textContent = totalRevenue.toLocaleString('fr-FR');

    if (past.length === 0) {
        pastTbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:#999;">Aucune séance passée</td></tr>';
    } else {
        pastTbody.innerHTML = past.map(st => {
            const sold = st.total_seats - st.available_seats;
            const revenue = sold * st.price;
            return `
                <tr style="opacity:0.7;">
                    <td>${st.id}</td>
                    <td>${st.movie_title || 'Film #' + st.movie_id}</td>
                    <td>${st.date}</td>
                    <td>${st.time}</td>
                    <td>${st.room}</td>
                    <td>${sold} / ${st.total_seats}</td>
                    <td style="font-weight:700;">${revenue.toLocaleString('fr-FR')} FCFA</td>
                </tr>
            `;
        }).join('');
    }
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
            showToast(showtimeId ? 'Séance modifiée' : 'Séance ajoutée');
            closeModal('showtimeFormModal');
            loadAllShowtimes();
        } else {
            showToast('Erreur lors de l\'enregistrement', 'error');
        }
    } catch (error) {
        console.error('Save showtime error:', error);
        showToast('Erreur lors de l\'enregistrement', 'error');
    }
}

async function deleteShowtime(showtimeId) {
    showConfirmDialog('Supprimer cette séance ?', async () => {
        try {
            const response = await fetch(`${API_URL}/showtimes/${showtimeId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (response.ok) {
                showToast('Séance supprimée');
                loadAllShowtimes();
            } else {
                showToast('Erreur lors de la suppression', 'error');
            }
        } catch (error) {
            console.error('Delete showtime error:', error);
            showToast('Erreur lors de la suppression', 'error');
        }
    });
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
    if (!bookingsData || !Array.isArray(bookingsData)) {
        console.error('Invalid bookingsData:', bookingsData);
        const tbody = document.querySelector('#bookingsTable tbody');
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem; color:#999;">Erreur de chargement</td></tr>';
        document.getElementById('pastBookingsCount').textContent = '0';
        document.getElementById('pastBookingsRevenue').textContent = '0';
        return;
    }

    const now = new Date();

    // Séparer actives (futures + confirmées) et archives (passées ou annulées)
    const active = [];
    const archived = [];

    bookingsData.forEach(booking => {
        try {
            // Extraire date string proprement
            const dateStr = typeof booking.date === 'string' ? booking.date.split('T')[0] : booking.date;
            const timeStr = typeof booking.time === 'string' ? booking.time.substring(0, 8) : booking.time;
            const showtimeDate = new Date(`${dateStr}T${timeStr}`);
            const isFuture = showtimeDate > now;
            const isConfirmed = booking.status === 'confirmed';

            if (isFuture && isConfirmed) {
                active.push(booking);
            } else {
                archived.push(booking);
            }
        } catch (e) {
            console.error('Error parsing booking date:', booking.id, e);
            // En cas d'erreur, mettre en archive par défaut
            archived.push(booking);
        }
    });

    // Afficher réservations actives
    const tbody = document.querySelector('#bookingsTable tbody');
    console.log('🎟️ Bookings: Active=', active.length, 'Archived=', archived.length);

    if (active.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem; color:#999;">Aucune réservation active</td></tr>';
    } else {
        tbody.innerHTML = active.map(booking => {
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
                    <td>✅ Confirmé</td>
                    <td>${bookingDate}</td>
                    <td>
                        <button class="btn-delete" onclick="deleteBooking(${booking.id})">Supprimer</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Calculer revenus totaux des réservations passées confirmées
    let totalRevenue = 0;
    archived.forEach(booking => {
        if (booking.status === 'confirmed') {
            const price = parseInt(booking.total_price) || 0;
            if (!isNaN(price)) {
                totalRevenue += price;
            }
        }
    });

    // Afficher archives (passées + annulées)
    const pastTbody = document.querySelector('#pastBookingsTable tbody');
    document.getElementById('pastBookingsCount').textContent = archived.length;
    document.getElementById('pastBookingsRevenue').textContent = totalRevenue.toLocaleString('fr-FR');

    if (archived.length === 0) {
        pastTbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:#999;">Aucune réservation archivée</td></tr>';
    } else {
        pastTbody.innerHTML = archived.map(booking => {
            let bookingDate = 'N/A';
            try {
                bookingDate = new Date(booking.booking_time).toLocaleString('fr-FR');
            } catch (e) {
                bookingDate = booking.booking_time;
            }

            const statusIcon = booking.status === 'confirmed' ? '✅' : '❌';
            const statusText = booking.status === 'confirmed' ? 'Confirmé' : 'Annulé';

            return `
                <tr style="opacity:0.6;">
                    <td>${booking.id}</td>
                    <td>${booking.user_name}<br><small>${booking.email}</small></td>
                    <td>${booking.title}</td>
                    <td>${booking.date} ${booking.time}<br><small>${booking.room}</small></td>
                    <td>${booking.seats}</td>
                    <td>${parseInt(booking.total_price).toLocaleString('fr-FR')} FCFA</td>
                    <td>${statusIcon} ${statusText}</td>
                    <td>${bookingDate}</td>
                </tr>
            `;
        }).join('');
    }
}

async function deleteBooking(bookingId) {
    showConfirmDialog('Supprimer définitivement cette réservation ?', async () => {
        try {
            const response = await fetch(`${API_URL}/admin/bookings/${bookingId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (response.ok) {
                showToast('Réservation supprimée');
                loadBookings();
            } else {
                showToast('Erreur lors de la suppression', 'error');
            }
        } catch (e) {
            showToast('Erreur de connexion', 'error');
        }
    });
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

            if (adulteInput) adulteInput.value = prices.adulte || 3000;
            if (enfantInput) enfantInput.value = prices.enfant || 2000;
            if (popcornInput) popcornInput.value = prices.popcorn || 4000;
        }
    } catch (e) {
        console.error('Could not load prices');
        // Fallback to defaults
        const adulteInput = document.getElementById('priceAdulte');
        const enfantInput = document.getElementById('priceEnfant');
        const popcornInput = document.getElementById('pricePopcorn');
        if (adulteInput) adulteInput.value = 3000;
        if (enfantInput) enfantInput.value = 2000;
        if (popcornInput) popcornInput.value = 4000;
    }
}

async function savePrices() {
    const adulte = parseInt(document.getElementById('priceAdulte').value);
    const enfant = parseInt(document.getElementById('priceEnfant').value);
    const popcorn = parseInt(document.getElementById('pricePopcorn').value);

    if (isNaN(adulte) || isNaN(enfant) || isNaN(popcorn)) {
        showToast('Veuillez renseigner tous les prix', 'error');
        return;
    }

    if (adulte < 500 || enfant < 500 || popcorn < 500) {
        showToast('Les prix doivent être au minimum 500 FCFA', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/prices`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ adulte, enfant, popcorn })
        });

        if (response.ok) {
            showToast(`✅ Tarifs mis à jour — Adulte : ${adulte.toLocaleString('fr-FR')} · Enfant : ${enfant.toLocaleString('fr-FR')} · Popcorn : ${popcorn.toLocaleString('fr-FR')} FCFA`);
            await loadPrices();
        } else {
            showToast('Erreur lors de la mise à jour des tarifs', 'error');
        }
    } catch (e) {
        showToast('Erreur de connexion', 'error');
    }
}

// ========== NEWSLETTER ==========

async function loadNewsletter() {
    try {
        const response = await fetch(`${API_URL}/admin/newsletter`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const subscribers = await response.json();
        console.log('📧 Newsletter subscribers:', subscribers.length);

        document.getElementById('newsletterCount').textContent = subscribers.length;
        displayNewsletterTable(subscribers);
    } catch (error) {
        console.error('Load newsletter error:', error);
    }
}

function displayNewsletterTable(subscribers) {
    const tbody = document.querySelector('#newsletterTable tbody');
    if (!subscribers || subscribers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; color:#999;">Aucun abonné</td></tr>';
        return;
    }

    tbody.innerHTML = subscribers.map(sub => `
        <tr>
            <td>${sub.id}</td>
            <td>${sub.email}</td>
            <td>${new Date(sub.subscribed_at).toLocaleString('fr-FR')}</td>
            <td>
                <button class="btn-delete" onclick="deleteNewsletterSubscriber(${sub.id})">Supprimer</button>
            </td>
        </tr>
    `).join('');
}

async function deleteNewsletterSubscriber(id) {
    showConfirmDialog('Supprimer cet abonné ?', async () => {
        try {
            const response = await fetch(`${API_URL}/admin/newsletter/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (response.ok) {
                showToast('Abonné supprimé');
                loadNewsletter();
            } else {
                showToast('Erreur lors de la suppression', 'error');
            }
        } catch (e) {
            showToast('Erreur de connexion', 'error');
        }
    });
}

// Close modal on outside click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            closeModal(modal.id);
        }
    });
});