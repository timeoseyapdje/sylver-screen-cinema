// app.js
const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';

let currentUser = null;
let authToken = null;
let selectedSeats = [];
let currentMovie = null;
let movies = [];
let showtimes = [];
let ticketQuantities = { adulte: 0, enfant: 0, popcorn: 0 };
let ticketPrices = { adulte: 3000, enfant: 2000, popcorn: 4000 };

// ========== TOAST & DIALOG ==========

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
        <span class="toast-msg">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function showDialog({ icon = 'ℹ️', title, message, buttons = [] }) {
    const overlay = document.getElementById('dialogOverlay');
    if (!overlay) return;

    document.getElementById('dialogIcon').textContent = icon;
    document.getElementById('dialogTitle').textContent = title;
    document.getElementById('dialogMessage').textContent = message;

    const btnsContainer = document.getElementById('dialogButtons');
    btnsContainer.innerHTML = '';

    if (buttons.length === 0) {
        buttons = [{ label: 'OK', style: 'btn-white', action: closeDialog }];
    }

    buttons.forEach(btn => {
        const el = document.createElement('button');
        el.className = btn.style || 'btn-white';
        el.textContent = btn.label;
        el.style.minWidth = '120px';
        el.style.padding = '0.75rem 1.5rem';
        el.onclick = () => {
            closeDialog();
            if (btn.action) btn.action();
        };
        btnsContainer.appendChild(el);
    });

    overlay.style.display = 'flex';
    overlay.classList.add('active');
}

function closeDialog() {
    const overlay = document.getElementById('dialogOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.remove('active');
    }
}

// ========== MOBILE MENU ==========

function toggleMobileMenu() {
    document.getElementById('mobileMenu').classList.toggle('open');
}

function closeMobileMenu() {
    document.getElementById('mobileMenu').classList.remove('open');
}

function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = '🙈';
    } else {
        input.type = 'password';
        button.textContent = '👁';
    }
}

// ========== AUTH ==========

document.addEventListener('DOMContentLoaded', function () {
    checkAuth();
    loadTicketPrices();

    // Load films carousel if element exists (index.html only)
    if (document.getElementById('filmsCarousel')) {
        loadFilmsCarousel();
    }

    // Load movies grid only if element exists (index.html only)
    if (document.getElementById('moviesGrid')) {
        loadMovies();
    }
});

function checkAuth() {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');
    if (token && user) {
        authToken = token;
        currentUser = JSON.parse(user);
        updateNavigation();
    }
}

function updateNavigation() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    const mobileRegisterBtn = document.getElementById('mobileRegisterBtn');

    if (currentUser) {
        const label = currentUser.is_admin ? '👨‍💼 ADMIN' : '👤 MON COMPTE';
        const action = currentUser.is_admin
            ? () => window.location.href = 'admin.html'
            : openAccountModal;

        loginBtn.textContent = label;
        loginBtn.onclick = action;
        if (mobileLoginBtn) { mobileLoginBtn.textContent = label; mobileLoginBtn.onclick = () => { closeMobileMenu(); action(); }; }

        if (registerBtn) registerBtn.style.display = 'none';
        if (mobileRegisterBtn) mobileRegisterBtn.style.display = 'none';

        // Bouton déconnexion
        if (!document.getElementById('logoutBtn')) {
            const btn = document.createElement('button');
            btn.id = 'logoutBtn';
            btn.className = 'btn-black';
            btn.textContent = 'Déconnexion';
            btn.style.fontSize = '0.8rem';
            btn.onclick = confirmLogout;
            document.getElementById('navLinks').appendChild(btn);
        }
    } else {
        loginBtn.textContent = 'Connexion';
        loginBtn.onclick = openLoginModal;
        if (mobileLoginBtn) { mobileLoginBtn.textContent = 'Connexion'; mobileLoginBtn.onclick = () => { closeMobileMenu(); openLoginModal(); }; }

        if (registerBtn) registerBtn.style.display = '';
        if (mobileRegisterBtn) mobileRegisterBtn.style.display = '';

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.remove();
    }
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    authToken = null;
    currentUser = null;
    updateNavigation();
    showToast('Déconnexion réussie', 'success');
    location.reload();
}

function confirmLogout() {
    showDialog({
        icon: '⚠️',
        title: 'Déconnexion',
        message: 'Voulez-vous vraiment vous déconnecter ?',
        buttons: [
            { label: 'Annuler', style: 'btn-black' },
            { label: 'Déconnexion', style: 'btn-white', action: logout }
        ]
    });
}

// ========== MON COMPTE ==========

async function openAccountModal() {
    if (!currentUser) return;

    document.getElementById('accountName').textContent = currentUser.name;
    document.getElementById('accountEmail').textContent = currentUser.email;
    document.getElementById('accountPhone').textContent = currentUser.phone || 'Non renseigné';

    await loadUserBookings();
    openModal('accountModal');
}

async function loadUserBookings() {
    const container = document.getElementById('accountBookings');
    container.innerHTML = '<div class="spinner" style="margin:2rem auto;"></div>';

    try {
        const response = await fetch(`${API_URL}/bookings`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            console.error('Bookings response error:', response.status);
            throw new Error('Failed');
        }

        const bookings = await response.json();
        console.log('Bookings loaded:', bookings.length);
        const now = new Date();

        const futureBookings = bookings.filter(b => {
            try {
                // Extraire la date string (YYYY-MM-DD)
                const dateStr = typeof b.date === 'string' ? b.date.split('T')[0] : b.date;
                const timeStr = typeof b.time === 'string' ? b.time.substring(0, 8) : b.time;
                const showtime = new Date(`${dateStr}T${timeStr}`);
                const isFuture = showtime > now;
                const isConfirmed = b.status === 'confirmed';
                console.log(`  Booking ${b.id}: ${dateStr} ${timeStr} → ${isFuture ? 'Future' : 'Past'}, ${isConfirmed ? 'Confirmed' : 'Cancelled'}`);
                return isFuture && isConfirmed;
            } catch (error) {
                console.error('Error parsing booking:', b.id, error);
                return false;
            }
        });

        console.log('Future bookings:', futureBookings.length);

        if (futureBookings.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-gray); padding:3rem 1rem;">Aucune réservation active</p>';
            return;
        }

        container.innerHTML = futureBookings.map(b => {
            const dateStr = typeof b.date === 'string' ? b.date.split('T')[0] : b.date;
            const timeStr = typeof b.time === 'string' ? b.time.substring(0, 5) : b.time;
            const showtime = new Date(`${dateStr}T${b.time}`);
            const minutesUntil = (showtime - now) / 60000;
            const canCancel = minutesUntil > 5;

            return `
                <div style="background:var(--black); border:1px solid var(--border-gray); padding:1.25rem; margin-bottom:1rem;">
                    <div style="margin-bottom:1rem;">
                        <h4 style="font-size:1.05rem; font-weight:700; margin-bottom:0.5rem;">${b.title}</h4>
                        <p style="color:var(--text-gray); font-size:0.85rem; margin-bottom:0.25rem;">📅 ${new Date(dateStr).toLocaleDateString('fr-FR')} à ${timeStr}</p>
                        <p style="color:var(--text-gray); font-size:0.85rem; margin-bottom:0.25rem;">🪑 Places : ${b.seats}</p>
                        <p style="font-size:1.1rem; font-weight:700; margin-top:0.5rem;">${parseInt(b.total_price).toLocaleString('fr-FR')} FCFA</p>
                    </div>
                    ${canCancel
                    ? `<button class="btn-black" style="width:100%; padding:0.7rem; font-size:0.85rem;" onclick="cancelBooking(${b.id})">Annuler la réservation</button>`
                    : `<p style="color:#999; font-size:0.8rem; text-align:center; padding:0.5rem;">⚠️ Annulation impossible (moins de 5 min)</p>`
                }
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('Load bookings error:', e);
        container.innerHTML = `
            <div style="text-align:center; padding:2rem;">
                <p style="color:var(--text-gray); margin-bottom:1rem;">Erreur de chargement des réservations</p>
                <button class="btn-white" onclick="loadUserBookings()">Réessayer</button>
            </div>
        `;
    }
}

async function cancelBooking(bookingId) {
    showDialog({
        icon: '⚠️',
        title: 'Annuler',
        message: 'Annuler cette réservation ?',
        buttons: [
            { label: 'Non', style: 'btn-black' },
            {
                label: 'Oui',
                style: 'btn-white',
                action: async () => {
                    try {
                        const response = await fetch(`${API_URL}/bookings/${bookingId}/cancel`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${authToken}` }
                        });

                        if (response.ok) {
                            showToast('Réservation annulée');
                            await loadUserBookings();
                        } else {
                            showToast('Erreur', 'error');
                        }
                    } catch (e) {
                        showToast('Erreur de connexion', 'error');
                    }
                }
            }
        ]
    });
}

function showEditProfile() {
    document.getElementById('profileView').style.display = 'none';
    document.getElementById('profileEdit').style.display = 'block';
    document.getElementById('editName').value = currentUser.name;
    document.getElementById('editEmail').value = currentUser.email;
    document.getElementById('editPhone').value = currentUser.phone || '';
}

function cancelEditProfile() {
    document.getElementById('profileView').style.display = 'block';
    document.getElementById('profileEdit').style.display = 'none';
}

async function saveProfile(event) {
    event.preventDefault();
    const name = document.getElementById('editName').value;
    const email = document.getElementById('editEmail').value;
    const phone = document.getElementById('editPhone').value;

    try {
        const response = await fetch(`${API_URL}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ name, email, phone })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            document.getElementById('accountName').textContent = currentUser.name;
            document.getElementById('accountEmail').textContent = currentUser.email;
            document.getElementById('accountPhone').textContent = currentUser.phone || 'Non renseigné';

            cancelEditProfile();
            showToast('Profil mis à jour');
        } else {
            showToast(data.error || 'Erreur', 'error');
        }
    } catch (e) {
        showToast('Erreur de connexion', 'error');
    }
}


async function login(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Connexion...';

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            closeModal('loginModal');
            updateNavigation();
            showToast(`Bienvenue ${currentUser.name} ! 🎬`, 'success');

            if (currentUser.is_admin) {
                showDialog({
                    icon: '👨‍💼',
                    title: 'Accès Admin',
                    message: 'Vous êtes connecté en tant qu\'administrateur.',
                    buttons: [
                        { label: 'Panel Admin', style: 'btn-white', action: () => window.location.href = 'admin.html' },
                        { label: 'Rester ici', style: 'btn-black', action: () => { } }
                    ]
                });
            }
        } else {
            showToast(data.error || 'Email ou mot de passe incorrect', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion. Vérifiez votre connexion internet.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Se connecter';
    }
}

async function registerStep1(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = '⏳ Inscription...';

    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;
    const emailNotifications = document.getElementById('newsletterOptIn').checked;

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password, emailNotifications })
        });

        const data = await response.json();

        if (response.ok) {
            // Connecter directement l'utilisateur
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            // Fermer le modal AVANT d'afficher le message
            closeModal('registerModal');

            // Mettre à jour la navigation
            updateNavigation();

            // Afficher message de succès après un court délai
            setTimeout(() => {
                showDialog({
                    icon: '🎉',
                    title: 'Inscription réussie !',
                    message: `Bienvenue chez Sylver Screen, ${name} ! Votre compte a été créé avec succès. ${emailNotifications ? 'Un email de confirmation vous a été envoyé.' : ''}`,
                    buttons: [
                        { label: 'Découvrir les films', style: 'btn-white', action: () => document.getElementById('movies').scrollIntoView({ behavior: 'smooth' }) },
                        { label: 'Fermer', style: 'btn-black', action: () => { } }
                    ]
                });
            }, 300);

            // Ne pas réinitialiser le bouton car modal fermé
            return;
        } else {
            // Si compte existe, proposer de se connecter
            if (data.error && typeof data.error === 'string' && data.error.includes('existe')) {
                closeModal('registerModal');
                setTimeout(() => {
                    showDialog({
                        icon: '⚠️',
                        title: 'Compte existant',
                        message: 'Un compte avec cet email existe déjà. Souhaitez-vous vous connecter ?',
                        buttons: [
                            { label: 'Se connecter', style: 'btn-white', action: () => { closeDialog(); openLoginModal(); } },
                            { label: 'Annuler', style: 'btn-black', action: () => { } }
                        ]
                    });
                }, 300);
                return; // Ne pas réinitialiser le bouton
            } else {
                showToast(data.error || 'Erreur lors de l\'inscription', 'error');
            }
        }
    } catch (error) {
        showToast('Erreur de connexion. Vérifiez votre connexion internet.', 'error');
    } finally {
        // Réinitialiser le bouton seulement si modal encore ouvert
        btn.disabled = false;
        btn.textContent = 'Créer mon compte';
    }
}

// ========== MOVIES ==========

async function loadMovies() {
    const grid = document.getElementById('moviesGrid');
    grid.innerHTML = '<div style="grid-column:1/-1"><div class="spinner"></div></div>';

    try {
        const response = await fetch(`${API_URL}/movies`);
        if (!response.ok) throw new Error('Erreur serveur');
        movies = await response.json();
        displayMovies(movies);
    } catch (error) {
        grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:4rem;">
                <p style="color:var(--text-gray); margin-bottom:1.5rem;">Impossible de charger les films</p>
                <button class="btn-white" onclick="loadMovies()">Réessayer</button>
            </div>`;
    }
}

function displayMovies(moviesData) {
    const grid = document.getElementById('moviesGrid');

    if (!moviesData || !Array.isArray(moviesData) || moviesData.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:4rem;"><p style="color:var(--text-gray);">Aucun film à l\'affiche pour le moment</p></div>';
        return;
    }

    grid.innerHTML = moviesData.map(movie => `
        <div class="movie-card" onclick="showMovieDetails(${movie.id})">
            <div class="movie-poster">
                ${movie.poster_url
            ? `<img src="${movie.poster_url}" alt="${movie.title}" loading="lazy" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:1rem;\\'><span style=\\'font-size:3rem;\\'>🎬</span><span style=\\'font-size:0.8rem;letter-spacing:1px;color:#999;\\'>${movie.title.toUpperCase()}</span></div>'">`
            : `<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:1rem;"><span style="font-size:3rem;">🎬</span><span style="font-size:0.8rem;letter-spacing:1px;color:#999;">${movie.title.toUpperCase()}</span></div>`
        }
            </div>
            <div class="movie-info">
                <div class="movie-title">${movie.title}</div>
                <div class="movie-genre">${movie.genre}</div>
                <div class="movie-rating">
                    <span>${'★'.repeat(Math.floor(movie.rating || 0))}${'☆'.repeat(5 - Math.floor(movie.rating || 0))}</span>
                    <span class="rating-text">${(movie.rating || 0).toFixed(1)} (${movie.votes_count || 0})</span>
                </div>
                <div class="movie-actions">
                    <button class="btn-book" onclick="event.stopPropagation(); quickBook(${movie.id})">Réserver</button>
                    <button class="btn-info" onclick="event.stopPropagation(); showMovieDetails(${movie.id})">Détails</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function showMovieDetails(movieId) {
    currentMovie = movies.find(m => m.id === movieId);
    document.getElementById('movieTitle').textContent = currentMovie.title;
    document.getElementById('movieDetails').innerHTML = `
        <div style="text-align:center; margin-bottom:1.5rem;">
            ${currentMovie.poster_url
            ? `<img src="${currentMovie.poster_url}" alt="${currentMovie.title}" style="max-width:100%; max-height:350px; object-fit:cover;">`
            : '<div style="font-size:5rem;">🎬</div>'}
        </div>
        <p style="margin-bottom:0.5rem;"><strong>Genre :</strong> ${currentMovie.genre}</p>
        <p style="margin-bottom:0.5rem;"><strong>Durée :</strong> ${currentMovie.duration} min</p>
        <p style="margin-bottom:1.25rem;"><strong>Note :</strong> ${(currentMovie.rating || 0).toFixed(1)}/5 (${currentMovie.votes_count || 0} votes)</p>
        <p style="color:var(--text-gray); line-height:1.7; font-size:0.9rem;">${currentMovie.description || ''}</p>
    `;

    // Reset stars
    document.querySelectorAll('#userRating .star').forEach(s => s.classList.remove('active'));
    openModal('movieModal');
}

function quickBook(movieId) {
    currentMovie = movies.find(m => m.id === movieId);
    openBookingModal();
}

async function rateMovie(rating) {
    if (!currentUser) {
        showDialog({
            icon: '🔐',
            title: 'Connexion requise',
            message: 'Vous devez être connecté pour noter un film.',
            buttons: [
                { label: 'Se connecter', style: 'btn-white', action: openLoginModal },
                { label: 'Annuler', style: 'btn-black' }
            ]
        });
        return;
    }

    try {
        const response = await fetch(`${API_URL}/ratings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ movie_id: currentMovie.id, rating })
        });

        if (response.ok) {
            document.querySelectorAll('#userRating .star').forEach((star, i) => {
                star.classList.toggle('active', i < rating);
            });
            showToast(`Vous avez noté "${currentMovie.title}" : ${rating}/5 ⭐`, 'success');
            loadMovies();
        } else {
            showToast('Erreur lors de la notation', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

// ========== BOOKING ==========

async function openBookingModal() {
    if (!currentUser) {
        showDialog({
            icon: '🔐',
            title: 'Connexion requise',
            message: 'Vous devez être connecté pour réserver des places.',
            buttons: [
                { label: 'Se connecter', style: 'btn-white', action: openLoginModal },
                { label: 'Créer un compte', style: 'btn-black', action: openRegisterModal }
            ]
        });
        return;
    }

    const select = document.getElementById('bookingMovie');
    select.innerHTML = movies.map(m =>
        `<option value="${m.id}" ${m.id === currentMovie?.id ? 'selected' : ''}>${m.title}</option>`
    ).join('');

    resetTicketQuantities();
    await updateShowtimes();
    openModal('bookingModal');
}

// ========== TICKET PRICES ==========
async function loadTicketPrices() {
    try {
        const response = await fetch(`${API_URL}/settings/prices`);
        if (response.ok) {
            const data = await response.json();
            ticketPrices = { adulte: data.adulte || 3000, enfant: data.enfant || 2000, popcorn: data.popcorn || 4000 };
        }
    } catch (e) { /* utilise les prix par défaut */ }
    updatePriceDisplay();
}

function updatePriceDisplay() {
    const fmt = n => n.toLocaleString('fr-FR') + ' FCFA';
    if (document.getElementById('price-adulte')) document.getElementById('price-adulte').textContent = fmt(ticketPrices.adulte);
    if (document.getElementById('price-enfant')) document.getElementById('price-enfant').textContent = fmt(ticketPrices.enfant);
    if (document.getElementById('price-popcorn')) document.getElementById('price-popcorn').textContent = fmt(ticketPrices.popcorn);
}

function changeTicketQty(type, delta) {
    const maxSeats = 10;

    ticketQuantities[type] = Math.max(0, Math.min(maxSeats, ticketQuantities[type] + delta));

    // Mettre à jour l'affichage
    document.getElementById(`qty-${type}`).textContent = ticketQuantities[type];

    // Reset les places si on dépasse
    const totalTickets = ticketQuantities.adulte + ticketQuantities.enfant + ticketQuantities.popcorn;
    if (selectedSeats.length > totalTickets) {
        // Désélectionner les places en trop
        while (selectedSeats.length > totalTickets) {
            const seatNum = selectedSeats.pop();
            const seat = document.querySelector(`[data-seat="${seatNum}"]`);
            if (seat) seat.classList.remove('selected');
        }
    }

    updateBookingSummary();
}

function resetTicketQuantities() {
    ticketQuantities = { adulte: 0, enfant: 0, popcorn: 0 };
    selectedSeats = [];
    document.getElementById('qty-adulte').textContent = '0';
    document.getElementById('qty-enfant').textContent = '0';
    document.getElementById('qty-popcorn').textContent = '0';
    // Désélectionner visuellement les places
    document.querySelectorAll('.seat.selected').forEach(s => s.classList.remove('selected'));
}

async function updateShowtimes() {
    const movieId = parseInt(document.getElementById('bookingMovie').value);
    try {
        const response = await fetch(`${API_URL}/movies/${movieId}/showtimes`);
        showtimes = await response.json();
        const select = document.getElementById('bookingShowtime');

        if (showtimes.length === 0) {
            select.innerHTML = '<option>Aucune séance disponible (réservations closes 30 min avant)</option>';
            document.getElementById('seatsGrid').innerHTML = '<p style="text-align:center; color:var(--text-gray); padding:2rem;">Les réservations se ferment 30 minutes avant chaque séance.</p>';
            return;
        }

        select.innerHTML = showtimes.map(st =>
            `<option value="${st.id}">${st.date} à ${st.time} — ${st.room} (${st.available_seats} places)</option>`
        ).join('');

        loadSeats();
    } catch (error) {
        showToast('Erreur lors du chargement des séances', 'error');
    }
}

function loadSeats() {
    const grid = document.getElementById('seatsGrid');
    selectedSeats = [];

    const showtimeId = parseInt(document.getElementById('bookingShowtime').value);
    const showtime = showtimes.find(s => s.id === showtimeId);
    if (!showtime) return;

    const TOTAL = 60;
    const occupiedCount = Math.max(0, TOTAL - showtime.available_seats);
    const occupiedSeats = new Set();

    while (occupiedSeats.size < occupiedCount) {
        occupiedSeats.add(Math.floor(Math.random() * TOTAL) + 1);
    }

    let html = '';
    for (let i = 1; i <= TOTAL; i++) {
        const occupied = occupiedSeats.has(i);
        html += `<div class="seat ${occupied ? 'occupied' : ''}" 
                      ${!occupied ? `onclick="toggleSeat(${i})"` : ''}
                      data-seat="${i}">${i}</div>`;
    }

    grid.innerHTML = html;
    updateBookingSummary();
}

function toggleSeat(n) {
    const totalTicketTypes = ticketQuantities.adulte + ticketQuantities.enfant + ticketQuantities.popcorn;

    if (totalTicketTypes === 0) {
        showToast('Sélectionnez d\'abord le nombre de billets', 'info');
        return;
    }

    const seat = document.querySelector(`[data-seat="${n}"]`);
    const idx = selectedSeats.indexOf(n);

    if (idx > -1) {
        // Désélectionner
        selectedSeats.splice(idx, 1);
        seat.classList.remove('selected');
    } else {
        // Sélectionner seulement si on n'a pas dépassé le nombre de billets
        if (selectedSeats.length >= totalTicketTypes) {
            showToast(`Vous avez déjà sélectionné ${totalTicketTypes} places`, 'info');
            return;
        }
        selectedSeats.push(n);
        seat.classList.add('selected');
    }
    updateBookingSummary();
}

function updateBookingSummary() {
    const totalTicketTypes = ticketQuantities.adulte + ticketQuantities.enfant + ticketQuantities.popcorn;
    const selectedSeatsCount = selectedSeats.length;

    // Calcul du prix selon les types de billets
    const totalPrice =
        (ticketQuantities.adulte * ticketPrices.adulte) +
        (ticketQuantities.enfant * ticketPrices.enfant) +
        (ticketQuantities.popcorn * ticketPrices.popcorn);

    document.getElementById('selectedSeatsCount').textContent = `${selectedSeatsCount} / ${totalTicketTypes}`;
    document.getElementById('totalPrice').textContent = totalPrice.toLocaleString('fr-FR') + ' FCFA';

    // Détail des billets
    const breakdown = [];
    if (ticketQuantities.adulte > 0) breakdown.push(`${ticketQuantities.adulte} Adulte${ticketQuantities.adulte > 1 ? 's' : ''}`);
    if (ticketQuantities.enfant > 0) breakdown.push(`${ticketQuantities.enfant} Enfant${ticketQuantities.enfant > 1 ? 's' : ''}`);
    if (ticketQuantities.popcorn > 0) breakdown.push(`${ticketQuantities.popcorn} Popcorn`);

    const message = breakdown.length > 0
        ? `${breakdown.join(' · ')} — Choisissez ${totalTicketTypes} places`
        : 'Aucun billet sélectionné';

    document.getElementById('ticketBreakdown').textContent = message;
}

async function confirmBooking() {
    const totalTickets = ticketQuantities.adulte + ticketQuantities.enfant + ticketQuantities.popcorn;

    if (totalTickets === 0) {
        showToast('Sélectionnez au moins un billet', 'error');
        return;
    }

    if (selectedSeats.length === 0) {
        showToast('Choisissez vos places sur la grille', 'error');
        return;
    }

    if (selectedSeats.length !== totalTickets) {
        showToast(`Sélectionnez exactement ${totalTickets} places`, 'error');
        return;
    }

    const showtimeId = parseInt(document.getElementById('bookingShowtime').value);
    const totalPrice =
        (ticketQuantities.adulte * ticketPrices.adulte) +
        (ticketQuantities.enfant * ticketPrices.enfant) +
        (ticketQuantities.popcorn * ticketPrices.popcorn);

    const btn = document.querySelector('#bookingModal button[onclick="confirmBooking()"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Réservation...';

    try {
        const response = await fetch(`${API_URL}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({
                showtime_id: showtimeId,
                seats: selectedSeats,
                tickets: ticketQuantities,
                total_price: totalPrice
            })
        });

        const data = await response.json();

        if (response.ok) {
            closeModal('bookingModal');
            resetTicketQuantities();
            selectedSeats = [];

            const breakdown = [];
            if (ticketQuantities.adulte > 0) breakdown.push(`${ticketQuantities.adulte} Adulte`);
            if (ticketQuantities.enfant > 0) breakdown.push(`${ticketQuantities.enfant} Enfant`);
            if (ticketQuantities.popcorn > 0) breakdown.push(`${ticketQuantities.popcorn} Popcorn`);

            showToast(`✅ ${breakdown.join(' + ')} · Places ${selectedSeats.join(', ')}`);
        } else {
            showToast(data.error || 'Erreur lors de la réservation', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// ========== NEWSLETTER ==========

async function subscribeNewsletter() {
    const email = document.getElementById('newsletterEmail').value;
    if (!email) { showToast('Veuillez entrer votre email', 'error'); return; }

    try {
        const response = await fetch(`${API_URL}/newsletter/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (response.ok) {
            document.getElementById('newsletterEmail').value = '';
            showToast('Merci ! Vous recevrez nos actualités chaque semaine. 🎬', 'success');
        } else {
            showToast('Erreur d\'inscription à la newsletter', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

// ========== MODALS ==========

function openModal(id) {
    closeAllModals();
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.body.style.overflow = '';
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.body.style.overflow = '';
}

function openLoginModal() { closeAllModals(); openModal('loginModal'); }
function openRegisterModal() { closeAllModals(); openModal('registerModal'); }

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
        if (e.target === modal) closeModal(modal.id);
    });
});

// ========== HERO SLIDER ==========
let currentSlide = 0;
let autoSlideInterval;

function showSlide(index) {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.slider-dot');

    if (!slides.length) return;

    // Wrap around
    if (index >= slides.length) currentSlide = 0;
    else if (index < 0) currentSlide = slides.length - 1;
    else currentSlide = index;

    // Update slides
    slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === currentSlide);
    });

    // Update dots
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
    });
}

function changeSlide(direction) {
    showSlide(currentSlide + direction);
    resetAutoSlide();
}

function goToSlide(index) {
    showSlide(index);
    resetAutoSlide();
}

function resetAutoSlide() {
    clearInterval(autoSlideInterval);
    startAutoSlide();
}

function startAutoSlide() {
    autoSlideInterval = setInterval(() => {
        showSlide(currentSlide + 1);
    }, 5000); // Change slide every 5 seconds
}

// Initialize slider
document.addEventListener('DOMContentLoaded', () => {
    showSlide(0);
    startAutoSlide();
});

// ========== THEME TOGGLE ==========
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    const icon = document.getElementById('themeIcon');

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update icon
    icon.textContent = newTheme === 'light' ? '🌙' : '☀️';
}

// Load saved theme
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const icon = document.getElementById('themeIcon');

    document.documentElement.setAttribute('data-theme', savedTheme);

    if (icon) {
        icon.textContent = savedTheme === 'light' ? '🌙' : '☀️';
    }
});

// ========== FILMS CAROUSEL ==========
async function loadFilmsCarousel() {
    console.log('🎬 loadFilmsCarousel appelé');
    const carousel = document.getElementById('filmsCarousel');
    console.log('📦 Carousel element:', carousel);

    if (!carousel) {
        console.error('❌ Element #filmsCarousel non trouvé');
        return;
    }

    try {
        console.log('🌐 Fetching:', `${API_URL}/movies`);
        const response = await fetch(`${API_URL}/movies`);
        console.log('📡 Response:', response.status);
        const films = await response.json();
        console.log('🎥 Films:', films.length, 'trouvés');

        if (!films || films.length === 0) {
            carousel.innerHTML = '<div class="carousel-loading"><p>Aucun film disponible</p></div>';
            return;
        }

        carousel.innerHTML = films.map(film => `
            <a href="film.html?id=${film.id}" class="film-card-carousel">
                <div class="film-card-poster">
                    ${film.poster_url
                ? `<img src="${film.poster_url}" alt="${film.title}" loading="lazy">`
                : `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:var(--bg-tertiary);">
                            <span style="font-size:4rem;">🎬</span>
                           </div>`
            }
                </div>
                <div class="film-card-info">
                    <h3 class="film-card-title">${film.title}</h3>
                    <div class="film-card-meta">
                        <span>${film.genre || 'Genre'}</span>
                        <span>${film.duration ? film.duration + ' min' : 'N/A'}</span>
                        ${film.rating ? `<span>★ ${film.rating}/5</span>` : ''}
                    </div>
                    <p class="film-card-description">${film.description || 'Description non disponible.'}</p>
                    <div class="film-card-cta">
                        <button class="btn-book" onclick="event.preventDefault(); window.location.href='film.html?id=${film.id}'">
                            Réserver
                        </button>
                    </div>
                </div>
            </a>
        `).join('');

        setupCarouselNavigation();

    } catch (error) {
        console.error('❌ Error loading films carousel:', error);
        carousel.innerHTML = '<div class="carousel-loading"><p>Erreur de chargement. Vérifier console.</p></div>';
    }
}

function setupCarouselNavigation() {
    const carousel = document.getElementById('filmsCarousel');
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');

    if (!carousel || !prevBtn || !nextBtn) return;

    prevBtn.addEventListener('click', () => {
        carousel.scrollBy({ left: -400, behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', () => {
        carousel.scrollBy({ left: 400, behavior: 'smooth' });
    });
}