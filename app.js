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

// ========== AUTH ==========

document.addEventListener('DOMContentLoaded', function () {
    checkAuth();
    loadMovies();
    loadTicketPrices();
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

        if (!response.ok) throw new Error('Failed');

        const bookings = await response.json();
        const now = new Date();

        const futureBookings = bookings.filter(b => {
            const showtime = new Date(`${b.date}T${b.time}`);
            return showtime > now && b.status === 'confirmed';
        });

        if (futureBookings.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-gray); padding:3rem 1rem;">Aucune réservation active</p>';
            return;
        }

        container.innerHTML = futureBookings.map(b => {
            const showtime = new Date(`${b.date}T${b.time}`);
            const minutesUntil = (showtime - now) / 60000;
            const canCancel = minutesUntil > 5;

            return `
                <div style="background:var(--black); border:1px solid var(--border-gray); padding:1.25rem; margin-bottom:1rem;">
                    <div style="margin-bottom:1rem;">
                        <h4 style="font-size:1.05rem; font-weight:700; margin-bottom:0.5rem;">${b.title}</h4>
                        <p style="color:var(--text-gray); font-size:0.85rem; margin-bottom:0.25rem;">📅 ${new Date(b.date).toLocaleDateString('fr-FR')} à ${b.time}</p>
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
        container.innerHTML = '<p style="text-align:center; color:var(--text-gray); padding:2rem;">Erreur</p>';
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
    btn.textContent = 'Création en cours...';

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

            closeModal('registerModal');
            updateNavigation();

            showDialog({
                icon: '🎬',
                title: 'Bienvenue !',
                message: `Votre compte a été créé avec succès. Bonne séance chez Sylver Screen, ${name} !`,
                buttons: [
                    { label: 'Voir les films', style: 'btn-white', action: () => document.getElementById('movies').scrollIntoView({ behavior: 'smooth' }) },
                    { label: 'Fermer', style: 'btn-black', action: () => { } }
                ]
            });
        } else {
            // Si compte existe, proposer de se connecter
            if (data.error && data.error.includes('existe')) {
                showDialog({
                    icon: '⚠️',
                    title: 'Compte existant',
                    message: 'Un compte avec cet email existe déjà. Souhaitez-vous vous connecter ?',
                    buttons: [
                        { label: 'Se connecter', style: 'btn-white', action: () => openLoginModal() },
                        { label: 'Annuler', style: 'btn-black', action: () => { } }
                    ]
                });
            } else {
                showToast(data.error || 'Erreur lors de l\'inscription', 'error');
            }
        }
    } catch (error) {
        showToast('Erreur de connexion. Vérifiez votre connexion internet.', 'error');
    } finally {
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

    if (!moviesData || moviesData.length === 0) {
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
    const totalTickets = ticketQuantities.adulte + ticketQuantities.enfant + ticketQuantities.popcorn;
    const maxSeats = 10; // Limite raisonnable

    ticketQuantities[type] = Math.max(0, Math.min(maxSeats, ticketQuantities[type] + delta));

    // Mettre à jour l'affichage
    document.getElementById(`qty-${type}`).textContent = ticketQuantities[type];
    updateBookingSummary();
}

function resetTicketQuantities() {
    ticketQuantities = { adulte: 0, enfant: 0, popcorn: 0 };
    document.getElementById('qty-adulte').textContent = '0';
    document.getElementById('qty-enfant').textContent = '0';
    document.getElementById('qty-popcorn').textContent = '0';
}

async function updateShowtimes() {
    const movieId = parseInt(document.getElementById('bookingMovie').value);
    try {
        const response = await fetch(`${API_URL}/movies/${movieId}/showtimes`);
        showtimes = await response.json();
        const select = document.getElementById('bookingShowtime');

        if (showtimes.length === 0) {
            select.innerHTML = '<option>Aucune séance disponible</option>';
            document.getElementById('seatsGrid').innerHTML = '';
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
    const seat = document.querySelector(`[data-seat="${n}"]`);
    const idx = selectedSeats.indexOf(n);
    if (idx > -1) {
        selectedSeats.splice(idx, 1);
        seat.classList.remove('selected');
    } else {
        selectedSeats.push(n);
        seat.classList.add('selected');
    }
    updateBookingSummary();
}

function updateBookingSummary() {
    const totalTickets = ticketQuantities.adulte + ticketQuantities.enfant + ticketQuantities.popcorn;
    const totalPrice =
        (ticketQuantities.adulte * ticketPrices.adulte) +
        (ticketQuantities.enfant * ticketPrices.enfant) +
        (ticketQuantities.popcorn * ticketPrices.popcorn);

    document.getElementById('selectedSeatsCount').textContent = totalTickets;
    document.getElementById('totalPrice').textContent = totalPrice.toLocaleString('fr-FR') + ' FCFA';

    // Détail des billets
    const breakdown = [];
    if (ticketQuantities.adulte > 0) breakdown.push(`${ticketQuantities.adulte} Adulte${ticketQuantities.adulte > 1 ? 's' : ''}`);
    if (ticketQuantities.enfant > 0) breakdown.push(`${ticketQuantities.enfant} Enfant${ticketQuantities.enfant > 1 ? 's' : ''}`);
    if (ticketQuantities.popcorn > 0) breakdown.push(`${ticketQuantities.popcorn} Popcorn`);

    document.getElementById('ticketBreakdown').textContent = breakdown.length > 0 ? breakdown.join(' · ') : 'Aucun billet sélectionné';
}

async function confirmBooking() {
    const totalTickets = ticketQuantities.adulte + ticketQuantities.enfant + ticketQuantities.popcorn;

    if (totalTickets === 0) {
        showToast('Sélectionnez au moins un billet', 'error');
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
                tickets: ticketQuantities,
                total_price: totalPrice
            })
        });

        const data = await response.json();

        if (response.ok) {
            closeModal('bookingModal');
            resetTicketQuantities();

            const breakdown = [];
            if (ticketQuantities.adulte > 0) breakdown.push(`${ticketQuantities.adulte} Adulte`);
            if (ticketQuantities.enfant > 0) breakdown.push(`${ticketQuantities.enfant} Enfant`);
            if (ticketQuantities.popcorn > 0) breakdown.push(`${ticketQuantities.popcorn} Popcorn`);

            showToast(`✅ Réservation confirmée ! ${breakdown.join(' + ')} · ${totalPrice.toLocaleString('fr-FR')} FCFA`);
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