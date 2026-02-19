// film.js - Film Detail Page Logic

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';

let currentFilmId = null;
let currentShowtime = null;
let selectedSeats = [];
let ticketQuantities = { adulte: 0, enfant: 0, popcorn: 0 };
let ticketPrices = { adulte: 3000, enfant: 2000, popcorn: 4000 };

// Get film ID from URL
function getFilmIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Load film details
async function loadFilmDetails() {
    const filmId = getFilmIdFromURL();

    if (!filmId) {
        window.location.href = 'index.html';
        return;
    }

    currentFilmId = filmId;

    try {
        const response = await fetch(`${API_URL}/movies/${filmId}`);
        const film = await response.json();

        if (!response.ok) {
            throw new Error('Film not found');
        }

        // Update page title
        document.title = `${film.title} - Sylver Screen Cinema`;
        document.getElementById('pageTitle').textContent = `${film.title} - Sylver Screen Cinema`;

        // Update film details
        document.getElementById('filmTitle').textContent = film.title;
        document.getElementById('filmGenre').textContent = film.genre;
        document.getElementById('filmDuration').textContent = film.duration ? `${film.duration} min` : 'N/A';
        document.getElementById('filmRatingBadge').textContent = film.rating ? `★ ${film.rating}/5` : '★ N/A';
        document.getElementById('filmSynopsis').textContent = film.description || 'Description non disponible.';

        // Set hero background
        if (film.poster_url) {
            const heroEl = document.querySelector('.film-hero-bg');
            heroEl.style.backgroundImage = `url('${film.poster_url}')`;
        }

        // Set trailer
        if (film.trailer_url) {
            setupTrailer(film.trailer_url);
        }

        // Load showtimes
        await loadShowtimes(filmId);

    } catch (error) {
        console.error('Error loading film:', error);
        showToast('Erreur lors du chargement du film', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
    }
}

// Setup trailer
function setupTrailer(trailerUrl) {
    const container = document.getElementById('trailerContainer');

    // Check if it's a YouTube URL
    let videoId = null;

    if (trailerUrl.includes('youtube.com/watch?v=')) {
        videoId = trailerUrl.split('v=')[1].split('&')[0];
    } else if (trailerUrl.includes('youtu.be/')) {
        videoId = trailerUrl.split('youtu.be/')[1].split('?')[0];
    }

    if (videoId) {
        container.innerHTML = `
            <iframe 
                width="100%" 
                height="100%" 
                src="https://www.youtube.com/embed/${videoId}" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
            </iframe>
        `;
    } else {
        container.innerHTML = `
            <div class="trailer-placeholder">
                <p>Bande-annonce non disponible</p>
            </div>
        `;
    }
}

// Load showtimes
async function loadShowtimes(filmId) {
    try {
        const response = await fetch(`${API_URL}/movies/${filmId}/showtimes`);
        const showtimes = await response.json();

        const select = document.getElementById('showtimeSelect');

        if (!showtimes || showtimes.length === 0) {
            select.innerHTML = '<option>Aucune séance disponible (fermeture 30 min avant)</option>';
            return;
        }

        // Group by date
        const grouped = {};
        showtimes.forEach(st => {
            const date = st.date.split('T')[0];
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(st);
        });

        // Build select options
        let html = '<option value="">Sélectionnez une séance</option>';

        Object.keys(grouped).sort().forEach(date => {
            const dateObj = new Date(date);
            const dateStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

            grouped[date].forEach(st => {
                const timeStr = st.time.substring(0, 5);
                html += `<option value="${st.id}" data-showtime='${JSON.stringify(st)}'>
                    ${dateStr} à ${timeStr} - ${st.available_seats} places
                </option>`;
            });
        });

        select.innerHTML = html;

    } catch (error) {
        console.error('Error loading showtimes:', error);
    }
}

// Select showtime
function selectShowtime() {
    const select = document.getElementById('showtimeSelect');
    const option = select.options[select.selectedIndex];

    if (!option.value) {
        document.getElementById('ticketsSelection').style.display = 'none';
        return;
    }

    currentShowtime = JSON.parse(option.dataset.showtime);
    ticketPrices = {
        adulte: parseInt(currentShowtime.price),
        enfant: parseInt(currentShowtime.price) * 0.7,
        popcorn: 4000
    };

    // Update prices display
    document.getElementById('priceAdulte').textContent = `${ticketPrices.adulte.toLocaleString()} FCFA`;
    document.getElementById('priceEnfant').textContent = `${Math.round(ticketPrices.enfant).toLocaleString()} FCFA`;
    document.getElementById('pricePopcorn').textContent = `${ticketPrices.popcorn.toLocaleString()} FCFA`;

    // Reset quantities
    ticketQuantities = { adulte: 0, enfant: 0, popcorn: 0 };
    document.getElementById('qtyAdulte').textContent = '0';
    document.getElementById('qtyEnfant').textContent = '0';
    document.getElementById('qtyPopcorn').textContent = '0';
    updateTotal();

    // Show tickets selection
    document.getElementById('ticketsSelection').style.display = 'block';
}

// Change ticket quantity
function changeTicketQty(type, delta) {
    ticketQuantities[type] = Math.max(0, ticketQuantities[type] + delta);
    document.getElementById(`qty${type.charAt(0).toUpperCase() + type.slice(1)}`).textContent = ticketQuantities[type];
    updateTotal();
}

// Update total
function updateTotal() {
    const total =
        ticketQuantities.adulte * ticketPrices.adulte +
        ticketQuantities.enfant * ticketPrices.enfant +
        ticketQuantities.popcorn * ticketPrices.popcorn;

    document.getElementById('totalAmount').textContent = `${total.toLocaleString()} FCFA`;
}

// Proceed to seats
function proceedToSeats() {
    const totalTickets = ticketQuantities.adulte + ticketQuantities.enfant;

    if (totalTickets === 0) {
        showToast('Veuillez sélectionner au moins un billet', 'error');
        return;
    }

    if (!authToken) {
        showToast('Veuillez vous connecter pour continuer', 'error');
        openLoginModal();
        return;
    }

    if (!currentShowtime) {
        showToast('Veuillez sélectionner une séance', 'error');
        return;
    }

    // Load seats and open modal
    loadSeats();
    openModal('seatsModal');
}

// Load seats
async function loadSeats() {
    if (!currentShowtime) return;

    try {
        const response = await fetch(`${API_URL}/showtimes/${currentShowtime.id}/seats`);
        const data = await response.json();

        const totalSeats = currentShowtime.total_seats;
        const occupiedSeats = data.occupiedSeats || [];
        const totalTickets = ticketQuantities.adulte + ticketQuantities.enfant;

        selectedSeats = [];

        const grid = document.getElementById('seatsGrid');
        let html = '';

        for (let i = 1; i <= totalSeats; i++) {
            const isOccupied = occupiedSeats.includes(i);
            html += `
                <div class="seat ${isOccupied ? 'occupied' : ''}" 
                     data-seat="${i}" 
                     onclick="toggleSeat(${i}, ${isOccupied})">
                    ${i}
                </div>
            `;
        }

        grid.innerHTML = html;
        updateSeatsDisplay();

    } catch (error) {
        console.error('Error loading seats:', error);
        showToast('Erreur lors du chargement des places', 'error');
    }
}

// Toggle seat
function toggleSeat(seatNum, isOccupied) {
    if (isOccupied) return;

    const totalTickets = ticketQuantities.adulte + ticketQuantities.enfant;
    const seatEl = document.querySelector(`[data-seat="${seatNum}"]`);

    if (selectedSeats.includes(seatNum)) {
        // Deselect
        selectedSeats = selectedSeats.filter(s => s !== seatNum);
        seatEl.classList.remove('selected');
    } else {
        // Select
        if (selectedSeats.length >= totalTickets) {
            showToast(`Vous ne pouvez sélectionner que ${totalTickets} place(s)`, 'error');
            return;
        }
        selectedSeats.push(seatNum);
        seatEl.classList.add('selected');
    }

    updateSeatsDisplay();
}

// Update seats display
function updateSeatsDisplay() {
    const totalTickets = ticketQuantities.adulte + ticketQuantities.enfant;
    const total =
        ticketQuantities.adulte * ticketPrices.adulte +
        ticketQuantities.enfant * ticketPrices.enfant +
        ticketQuantities.popcorn * ticketPrices.popcorn;

    document.getElementById('selectedSeatsDisplay').textContent =
        selectedSeats.length > 0 ? selectedSeats.sort((a, b) => a - b).join(', ') : 'Aucune';

    document.getElementById('seatsTotalDisplay').textContent = `${total.toLocaleString()} FCFA`;
}

// Confirm booking
async function confirmBooking() {
    const totalTickets = ticketQuantities.adulte + ticketQuantities.enfant;

    if (selectedSeats.length !== totalTickets) {
        showToast(`Veuillez sélectionner ${totalTickets} place(s)`, 'error');
        return;
    }

    if (!currentUser || !authToken) {
        showToast('Veuillez vous connecter', 'error');
        return;
    }

    const total =
        ticketQuantities.adulte * ticketPrices.adulte +
        ticketQuantities.enfant * ticketPrices.enfant +
        ticketQuantities.popcorn * ticketPrices.popcorn;

    const bookingData = {
        showtime_id: currentShowtime.id,
        tickets: {
            adulte: ticketQuantities.adulte,
            enfant: ticketQuantities.enfant,
            popcorn: ticketQuantities.popcorn
        },
        seats: selectedSeats,
        total_price: total
    };

    try {
        const response = await fetch(`${API_URL}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(bookingData)
        });

        const data = await response.json();

        if (response.ok) {
            closeModal('seatsModal');
            showDialog({
                icon: '🎉',
                title: 'Réservation confirmée !',
                message: `Votre réservation a été enregistrée. Un email de confirmation vous a été envoyé avec votre e-ticket.`,
                buttons: [
                    { label: 'Voir mes réservations', style: 'btn-white', action: () => { window.location.href = 'index.html'; openAccountModal(); } },
                    { label: 'Fermer', style: 'btn-black', action: () => { } }
                ]
            });
        } else {
            throw new Error(data.error || 'Erreur lors de la réservation');
        }

    } catch (error) {
        console.error('Booking error:', error);
        showToast(error.message || 'Erreur lors de la réservation', 'error');
    }
}

// Rate movie
let userRating = 0;
function rateMovie(rating) {
    userRating = rating;
    const stars = document.querySelectorAll('#userRating .star');
    stars.forEach((star, i) => {
        star.classList.toggle('active', i < rating);
    });

    // Save rating (could be sent to API)
    showToast(`Vous avez noté ce film ${rating}/5`, 'success');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFilmDetails();

    // Initialize theme from app.js
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const icon = document.getElementById('themeIcon');
    if (icon) {
        icon.textContent = savedTheme === 'light' ? '🌙' : '☀️';
    }
});