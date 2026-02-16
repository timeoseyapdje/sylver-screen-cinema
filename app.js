// app.js - Frontend JavaScript with API integration
const API_URL = 'http://localhost:3000/api';
let currentUser = null;
let authToken = null;
let selectedSeats = [];
let currentMovie = null;
let movies = [];
let showtimes = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadMovies();
});

// ========== AUTH FUNCTIONS ==========

function checkAuth() {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');
    
    if (token && user) {
        authToken = token;
        currentUser = JSON.parse(user);
        updateNavigation();
        
        // Redirect to admin if admin user
        if (currentUser.is_admin && window.location.pathname === '/index.html') {
            // Don't auto-redirect, let user choose
        }
    }
}

function updateNavigation() {
    const authBtn = document.getElementById('authBtn');
    if (currentUser) {
        authBtn.textContent = currentUser.is_admin ? 'ADMIN' : currentUser.name.toUpperCase();
        authBtn.onclick = () => {
            if (currentUser.is_admin) {
                window.location.href = 'admin.html';
            } else {
                alert('Mon compte (à développer)');
            }
        };
    }
}

async function login(event) {
    event.preventDefault();
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
            
            if (currentUser.is_admin) {
                if (confirm('Vous êtes connecté en tant qu\'administrateur. Accéder au panel admin ?')) {
                    window.location.href = 'admin.html';
                }
            } else {
                alert('Connexion réussie !');
            }
        } else {
            alert(data.error || 'Connexion échouée');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Erreur de connexion');
    }
}

async function registerStep1(event) {
    event.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const method = document.getElementById('verificationMethod').value;

    try {
        const response = await fetch(`${API_URL}/auth/send-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, method })
        });

        if (response.ok) {
            // Store registration data temporarily
            sessionStorage.setItem('registrationData', JSON.stringify({
                name, email, phone, method,
                password: document.getElementById('registerPassword').value,
                emailNotifications: document.getElementById('newsletterOptIn').checked
            }));

            document.getElementById('methodUsed').textContent = method === 'whatsapp' ? 'WhatsApp' : 'SMS';
            document.getElementById('registerStep1').classList.add('hidden');
            document.getElementById('registerStep2').classList.remove('hidden');
        } else {
            alert('Échec d\'envoi du code');
        }
    } catch (error) {
        console.error('Send verification error:', error);
        alert('Erreur d\'envoi du code');
    }
}

async function verifyPhone(event) {
    event.preventDefault();
    
    const code = ['code1', 'code2', 'code3', 'code4', 'code5', 'code6']
        .map(id => document.getElementById(id).value)
        .join('');

    const registrationData = JSON.parse(sessionStorage.getItem('registrationData'));

    try {
        // Verify phone
        const verifyResponse = await fetch(`${API_URL}/auth/verify-phone`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: registrationData.phone, code })
        });

        if (!verifyResponse.ok) {
            alert('Code incorrect');
            return;
        }

        // Register user
        const registerResponse = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registrationData)
        });

        const data = await registerResponse.json();

        if (registerResponse.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            sessionStorage.removeItem('registrationData');
            closeModal('registerModal');
            updateNavigation();
            alert('Compte créé avec succès !');
            
            // Reset form
            document.getElementById('registerStep1').classList.remove('hidden');
            document.getElementById('registerStep2').classList.add('hidden');
        } else {
            alert(data.error || 'Inscription échouée');
        }
    } catch (error) {
        console.error('Verification error:', error);
        alert('Erreur de vérification');
    }
}

function moveToNext(current, nextId) {
    if (current.value.length === 1) {
        const next = document.getElementById(nextId);
        if (next) next.focus();
    }
}

// ========== MOVIES FUNCTIONS ==========

async function loadMovies() {
    try {
        const response = await fetch(`${API_URL}/movies`);
        movies = await response.json();
        displayMovies(movies);
    } catch (error) {
        console.error('Load movies error:', error);
        document.getElementById('moviesGrid').innerHTML = '<p style="text-align: center; color: var(--text-gray);">Erreur de chargement des films</p>';
    }
}

function displayMovies(moviesData) {
    const grid = document.getElementById('moviesGrid');
    
    if (moviesData.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-gray); grid-column: 1/-1;">Aucun film à l\'affiche pour le moment</p>';
        return;
    }

    grid.innerHTML = moviesData.map(movie => `
        <div class="movie-card" onclick="showMovieDetails(${movie.id})">
            <div class="movie-poster">
                ${movie.poster_url ? `<img src="${movie.poster_url}" alt="${movie.title}">` : '🎬'}
            </div>
            <div class="movie-info">
                <div class="movie-title">${movie.title}</div>
                <div class="movie-genre">${movie.genre}</div>
                <div class="movie-rating">
                    <span class="stars">${'★'.repeat(Math.floor(movie.rating))}${'☆'.repeat(5 - Math.floor(movie.rating))}</span>
                    <span class="rating-text">(${movie.rating.toFixed(1)} - ${movie.votes_count} votes)</span>
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
        <div style="text-align: center; margin-bottom: 2rem;">
            ${currentMovie.poster_url ? `<img src="${currentMovie.poster_url}" alt="${currentMovie.title}" style="max-width: 100%; max-height: 400px;">` : '<div style="font-size: 6rem;">🎬</div>'}
        </div>
        <p><strong>Genre:</strong> ${currentMovie.genre}</p>
        <p><strong>Durée:</strong> ${currentMovie.duration} minutes</p>
        <p><strong>Note moyenne:</strong> ${currentMovie.rating.toFixed(1)}/5 (${currentMovie.votes_count} votes)</p>
        <p style="margin-top: 1.5rem; line-height: 1.8;">${currentMovie.description || 'Aucune description disponible.'}</p>
    `;
    
    openModal('movieModal');
}

function quickBook(movieId) {
    currentMovie = movies.find(m => m.id === movieId);
    openBookingModal();
}

async function rateMovie(rating) {
    if (!currentUser) {
        alert('Veuillez vous connecter pour noter un film');
        openLoginModal();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/ratings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ movie_id: currentMovie.id, rating })
        });

        if (response.ok) {
            const stars = document.querySelectorAll('#userRating .star');
            stars.forEach((star, index) => {
                star.classList.toggle('active', index < rating);
            });
            alert(`Merci d'avoir noté "${currentMovie.title}" avec ${rating} étoiles !`);
            loadMovies(); // Reload to update ratings
        } else {
            alert('Erreur lors de la notation');
        }
    } catch (error) {
        console.error('Rating error:', error);
        alert('Erreur lors de la notation');
    }
}

// ========== BOOKING FUNCTIONS ==========

async function openBookingModal() {
    if (!currentUser) {
        alert('Veuillez vous connecter pour réserver');
        openLoginModal();
        return;
    }

    const select = document.getElementById('bookingMovie');
    select.innerHTML = movies.map(m => 
        `<option value="${m.id}" ${m.id === currentMovie?.id ? 'selected' : ''}>${m.title}</option>`
    ).join('');
    
    await updateShowtimes();
    openModal('bookingModal');
}

async function updateShowtimes() {
    const movieId = parseInt(document.getElementById('bookingMovie').value);
    
    try {
        const response = await fetch(`${API_URL}/movies/${movieId}/showtimes`);
        showtimes = await response.json();
        
        const select = document.getElementById('bookingShowtime');
        
        if (showtimes.length === 0) {
            select.innerHTML = '<option>Aucune séance disponible</option>';
            return;
        }
        
        select.innerHTML = showtimes.map(st => 
            `<option value="${st.id}">${st.date} à ${st.time} - ${st.room} (${st.available_seats} places)</option>`
        ).join('');
        
        loadSeats();
    } catch (error) {
        console.error('Load showtimes error:', error);
    }
}

function loadSeats() {
    const grid = document.getElementById('seatsGrid');
    selectedSeats = [];
    
    const showtimeId = parseInt(document.getElementById('bookingShowtime').value);
    const showtime = showtimes.find(s => s.id === showtimeId);
    
    if (!showtime) return;
    
    const totalSeats = showtime.total_seats;
    const occupiedCount = totalSeats - showtime.available_seats;
    const occupiedSeats = [];
    
    // Generate random occupied seats for demo
    for (let i = 0; i < occupiedCount; i++) {
        let seat;
        do {
            seat = Math.floor(Math.random() * totalSeats) + 1;
        } while (occupiedSeats.includes(seat));
        occupiedSeats.push(seat);
    }
    
    let seatsHTML = '';
    for (let i = 1; i <= totalSeats; i++) {
        const isOccupied = occupiedSeats.includes(i);
        seatsHTML += `
            <div class="seat ${isOccupied ? 'occupied' : ''}" 
                 onclick="${!isOccupied ? `toggleSeat(${i})` : ''}"
                 data-seat="${i}">
                ${i}
            </div>
        `;
    }
    
    grid.innerHTML = seatsHTML;
    updateBookingSummary();
}

function toggleSeat(seatNumber) {
    const seat = document.querySelector(`[data-seat="${seatNumber}"]`);
    const index = selectedSeats.indexOf(seatNumber);
    
    if (index > -1) {
        selectedSeats.splice(index, 1);
        seat.classList.remove('selected');
    } else {
        selectedSeats.push(seatNumber);
        seat.classList.add('selected');
    }
    
    updateBookingSummary();
}

function updateBookingSummary() {
    document.getElementById('selectedSeatsCount').textContent = selectedSeats.length;
    document.getElementById('totalPrice').textContent = (selectedSeats.length * 3000) + ' FCFA';
}

async function confirmBooking() {
    if (selectedSeats.length === 0) {
        alert('Veuillez sélectionner au moins une place');
        return;
    }

    const showtimeId = parseInt(document.getElementById('bookingShowtime').value);
    const totalPrice = selectedSeats.length * 3000;

    try {
        const response = await fetch(`${API_URL}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                showtime_id: showtimeId,
                seats: selectedSeats,
                total_price: totalPrice
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`Réservation confirmée !\n\nPlaces: ${selectedSeats.join(', ')}\nTotal: ${totalPrice} FCFA\n\nUn email de confirmation a été envoyé.`);
            closeModal('bookingModal');
            selectedSeats = [];
        } else {
            alert(data.error || 'Erreur lors de la réservation');
        }
    } catch (error) {
        console.error('Booking error:', error);
        alert('Erreur lors de la réservation');
    }
}

// ========== NEWSLETTER ==========

async function subscribeNewsletter() {
    const email = document.getElementById('newsletterEmail').value;
    
    if (!email) {
        alert('Veuillez entrer votre email');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/newsletter/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (response.ok) {
            alert('Merci ! Vous recevrez nos actualités chaque semaine.');
            document.getElementById('newsletterEmail').value = '';
        } else {
            alert('Erreur d\'inscription');
        }
    } catch (error) {
        console.error('Newsletter error:', error);
        alert('Erreur d\'inscription');
    }
}

// ========== MODAL FUNCTIONS ==========

function openModal(modalId) {
    closeAllModals();
    document.getElementById(modalId).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.body.style.overflow = 'auto';
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
    document.body.style.overflow = 'auto';
}

function openLoginModal() {
    closeAllModals();
    openModal('loginModal');
}

function openRegisterModal() {
    closeAllModals();
    openModal('registerModal');
}

// Close modal on outside click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal(modal.id);
        }
    });
});
