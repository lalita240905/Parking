const BASE_URL = window.location.origin;

// Initialize state from Storage
let token = localStorage.getItem('token');
let username = localStorage.getItem('username');
let role = localStorage.getItem('role') || 'user'; 
let isLoginMode = true;

// DOM Selectors
const getEl = (id) => document.getElementById(id);

const authSection = getEl('auth-section');
const appWrapper = getEl('app-wrapper');
const usernameDisplay = getEl('username-display');
const roleDisplay = getEl('role-display');
const welcomeName = getEl('welcome-name');
const parkingGrid = getEl('parking-grid');
const toastContainer = getEl('toast-container');
const authForm = getEl('auth-form');
const authSubmit = getEl('auth-submit');
const authTitle = getEl('auth-title');
const authSubtitle = getEl('auth-subtitle');
const logoutBtn = getEl('logout-btn');
const viewTitle = getEl('view-title');

// Dashboard metrics
const dashAvailable = getEl('dash-available');
const dashOccupied = getEl('dash-occupied');

// Modal Elements
const spotModal = getEl('spot-modal');
const closeModal = getEl('close-modal');
const modalSpotId = getEl('modal-spot-id');
const modalSpotStatus = getEl('modal-spot-status');
const modalBtnFree = getEl('modal-btn-free');
const modalBtnReserve = getEl('modal-btn-reserve');

let currentActiveSpot = null;

/**
 * Robust Initialization
 */
function init() {
    console.log("Initializing ParkCloud UI...");
    
    setupNavigation();

    // Safety check
    if (token && !username) {
        logout();
        return;
    }

    if (token) {
        showApp();
    } else {
        showAuth();
    }
}

// ------------------- UI Controller -------------------

function showAuth() {
    if (authSection) authSection.style.display = 'flex';
    if (appWrapper) appWrapper.style.display = 'none';
}

function showApp() {
    if (!authSection || !appWrapper) return;

    authSection.style.display = 'none';
    appWrapper.style.display = 'flex';
    
    if (usernameDisplay) usernameDisplay.textContent = username || 'Unknown Node';
    if (welcomeName) welcomeName.textContent = username || 'User';
    if (roleDisplay) roleDisplay.textContent = role === 'admin' ? 'SYSTEM ADMIN' : 'OPERATOR';
    
    fetchParkingSpots();
    setupSSE();

    // Explicitly redirect to dashboard after login
    const dashboardLink = document.querySelector('.nav-link[data-target="dashboard"]');
    if (dashboardLink) dashboardLink.click();
}

function logout() {
    localStorage.clear();
    token = null;
    username = null;
    role = 'user';
    showAuth();
    showToast('SYSTEM EXIT', 'Session terminated successfully.', 'success');
}

if (logoutBtn) logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
});

// ------------------- Navigation -------------------

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link[data-target]');
    const sections = document.querySelectorAll('.view-section');

    const titles = {
        'dashboard': 'Dashboard Overview',
        'parking': 'Real-time Parking Grid',
        'booking': 'Booking Management',
        'history': 'Booking History',
        'analytics': 'System Analytics',
        'admin': 'Admin Control Panel',
        'settings': 'System Notifications'
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class
            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            // Add active class
            link.classList.add('active');
            const target = link.getAttribute('data-target');
            
            const targetSection = getEl(`view-${target}`);
            if (targetSection) {
                targetSection.classList.add('active');
            }
            
            viewTitle.textContent = titles[target] || 'ParkCloud Interface';
            
            if (target === 'parking' || target === 'dashboard') {
                fetchParkingSpots();
            }
        });
    });
}

// ------------------- Authentication -------------------

if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const uname = getEl('username').value;
        const pass = getEl('password').value;

        try {
            const payload = { username: uname, password: pass };

            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Authentication rejected');

            token = data.token;
            username = data.username;
            role = data.role || 'admin';
            
            localStorage.setItem('token', token);
            localStorage.setItem('username', username);
            localStorage.setItem('role', role);
            
            showApp();
            showToast('SYSTEM CONNECTED', `Welcome back, ${username}`, 'success');
        } catch (err) {
            console.error("Auth Error:", err);
            showToast('ACCESS DENIED', err.message, 'error');
        }
    });
}

// ------------------- Application Logic -------------------

async function fetchParkingSpots() {
    if (!token) return;
    try {
        const response = await fetch(`${BASE_URL}/parking`);
        if (!response.ok) throw new Error('Network response was not ok');
        const spots = await response.json();
        
        updateDashboardMetrics(spots);
        renderParkingSpots(spots);
    } catch (err) {
        console.error("Error fetching spots:", err);
    }
}

function updateDashboardMetrics(spots) {
    if (dashAvailable && dashOccupied) {
        const freeCount = spots.filter(s => s.status === 'Free').length;
        const occupiedCount = spots.filter(s => s.status === 'Occupied').length;
        dashAvailable.textContent = freeCount;
        dashOccupied.textContent = occupiedCount;
    }
}

function renderParkingSpots(spots) {
    if (!parkingGrid) return;
    parkingGrid.innerHTML = '';
    
    spots.forEach(spot => {
        const isFree = spot.status === 'Free';
        const stateClass = isFree ? 'free' : 'occupied';
        const displayStatus = isFree ? 'AVAILABLE' : 'BUSY';

        const el = document.createElement('div');
        el.className = `brutal-slot ${stateClass}`;
        
        el.innerHTML = `
            <span class="sub-text">${spot.location}</span>
            <div class="slot-id-lg">${spot.id}</div>
            <div class="status-badge">${displayStatus}</div>
        `;

        el.addEventListener('click', () => openSpotModal(spot));

        parkingGrid.appendChild(el);
    });
}

// ------------------- Modal Logic -------------------

function openSpotModal(spot) {
    if (!spotModal) return;
    currentActiveSpot = spot;
    
    modalSpotId.textContent = spot.location.split(' - ')[0] || `ID: ${spot.id}`;
    
    const isFree = spot.status === 'Free';
    modalSpotStatus.textContent = isFree ? 'AVAILABLE' : 'BUSY';
    modalSpotStatus.className = `tag text-white border-2 border-black ${isFree ? 'bg-teal' : 'bg-pink'}`;
    
    if (role === 'admin') {
        modalBtnFree.style.display = 'block';
        modalBtnReserve.style.display = 'block';
    } else {
        modalBtnFree.style.display = 'none';
        modalBtnReserve.style.display = 'none';
    }

    spotModal.style.display = 'flex';
}

if (closeModal) {
    closeModal.addEventListener('click', () => {
        spotModal.style.display = 'none';
    });
}

if (modalBtnFree) {
    modalBtnFree.addEventListener('click', () => {
        if (currentActiveSpot) toggleSpot(currentActiveSpot.id, 'Free');
    });
}

if (modalBtnReserve) {
    modalBtnReserve.addEventListener('click', () => {
        if (currentActiveSpot) toggleSpot(currentActiveSpot.id, 'Occupied');
    });
}

async function toggleSpot(id, newStatus) {
    if (role !== 'admin' || !token) {
        showToast('DENIED', 'Admin privileges required', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${BASE_URL}/parking/update/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Update failed');
        }
        
        spotModal.style.display = 'none';
        fetchParkingSpots();
    } catch (err) {
        showToast('CMD FAILURE', err.message, 'error');
    }
}

// ------------------- Real-time Notifications (SSE) -------------------

let eventSource = null;

function setupSSE() {
    if (eventSource) {
        eventSource.close();
    }
    
    eventSource = new EventSource(`${BASE_URL}/notification/stream`);
    
    eventSource.onopen = () => {
        console.log("[SSE] Connected to data stream");
    };

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.event === 'spot_freed') {
                showToast('SYSTEM ALERT', `Spot at ${data.location || 'Unknown'} was released.`, 'success');
                fetchParkingSpots();
            } else if (data.event === 'spot_busy') {
                showToast('SYSTEM ALERT', `Spot at ${data.location || 'Unknown'} was reserved.`, 'error');
                fetchParkingSpots();
            } else if (data.event === 'update' || data.event === 'connected') {
                fetchParkingSpots();
            }
        } catch(e) {
            console.error("[SSE] Data Parsing Error:", e);
        }
    };

    eventSource.onerror = (err) => {
        eventSource.close();
        setTimeout(setupSSE, 5000);
    };
}

// ------------------- Notification UI -------------------

function showToast(title, message, type='success') {
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const timer = setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 4000);

    toast.onclick = () => {
        clearTimeout(timer);
        toast.remove();
    };

    toast.innerHTML = `
        <div class="toast-content">
            <h4>${title}</h4>
            <p style="font-size: 0.85rem; margin-top: 0.25rem;">${message}</p>
        </div>
    `;

    toastContainer.appendChild(toast);
}

// Run App
window.onload = init;
