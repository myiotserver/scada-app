/**
 * SCADA Unified - Carousel Logic
 */

let socket = null;
let currentUser = null;
let latestCarouselsSnapshot = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    startClock();
    loadTheme();
    setupLoginEnterKey();
});

// --- Theme Toggle ---
function loadTheme() {
    const saved = localStorage.getItem('scada_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const icon = document.getElementById('theme-icon');
    if (saved === 'light') {
        icon.className = 'bx bxs-sun';
    } else {
        icon.className = 'bx bxs-moon';
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('scada_theme', next);
    const icon = document.getElementById('theme-icon');
    if (icon) {
        if (next === 'light') {
            icon.className = 'bx bxs-sun';
        } else {
            icon.className = 'bx bxs-moon';
        }
    }
}

// --- Mobile Card Switcher ---
let activeCard = 1;

function showCard(num) {
    activeCard = num;
    const cards = document.querySelectorAll('#view-home .carousel-col');
    cards.forEach((card, idx) => {
        card.classList.toggle('mobile-active', idx === num - 1);
    });
    // Update picker buttons
    document.querySelectorAll('.picker-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === num - 1);
    });
}

function activateMobileCard() {
    if (window.innerWidth <= 768) {
        showCard(activeCard);
    }
}

function startClock() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('clock-time').innerText = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        document.getElementById('clock-date').innerText = now.toLocaleDateString('en-GB', options);
    }, 1000);
}

function checkAuth() {
    const user = localStorage.getItem('scada_user');
    if (user) {
        try {
            currentUser = JSON.parse(user);
            // Validate session integrity (fresh login required for roles)
            if (!currentUser.roles || !currentUser.accessToken) {
                console.log("Invalid session detected, forcing logout");
                handleLogout();
                return;
            }
            initApp();
        } catch (e) {
            handleLogout();
        }
    } else {
        document.getElementById('login-view').style.display = 'flex';
    }
}

function setupLoginEnterKey() {
    const inputs = [document.getElementById('username'), document.getElementById('password')];
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    handleLogin();
                }
            });
        }
    });
}

async function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');

    if (!username || !password) {
        errorMsg.innerText = "Please enter username and password";
        return;
    }

    try {
        const res = await fetch('/api/auth/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok) {
            currentUser = data; // Contains accessToken and roles
            localStorage.setItem('scada_user', JSON.stringify(currentUser));
            initApp();
        } else {
            errorMsg.innerText = data.message || "Login failed";
        }
    } catch (e) {
        errorMsg.innerText = "Network error";
        console.error(e);
    }
}

function handleLogout() {
    localStorage.removeItem('scada_user');
    location.reload();
}

function initApp() {
    document.getElementById('login-view').style.display = 'none';
    document.querySelector('.app-wrapper').style.display = 'flex';

    if (currentUser && currentUser.username) {
        document.getElementById('current-user-display').innerText = currentUser.username;
    }

    // Default to offline state before data is received
    const offlineState = {};
    for (let i = 1; i <= 5; i++) offlineState[i] = { id: i, state: 'OFFLINE', data: null };
    renderCarousels(offlineState);

    // Connect Socket
    socket = io();

    socket.on('init', (data) => {
        console.log("Init Data", data);
        latestCarouselsSnapshot = data;
        renderCarousels(data);
    });

    socket.on('carousel-update', (data) => {
        latestCarouselsSnapshot = data;
        renderCarousels(data);
    });

    socket.on('config-loading', (loading) => {
        const overlays = document.querySelectorAll('.card-loading-overlay');
        overlays.forEach(overlay => {
            if (loading) {
                overlay.classList.add('active');
            } else {
                overlay.classList.remove('active');
            }
        });
    });

    // OPC-UA events
    socket.on('opcua-status', (status) => {
        updateOpcUaStatusUI(status);
        updateFooterConnections({ opcStatus: status });
    });
    socket.on('opcua-value', (data) => updateOpcUaLiveValue(data));
    socket.on('scada-alert', (alertData) => handleScadaAlert(alertData));

    // Load initial settings
    loadSettings();
    initOpcUaFormDefaults();

    // Start SQL polling
    pollSqlStatus();
    setInterval(pollSqlStatus, 10000); // Poll every 10s

    // Initial OPC Status Sync
    if (currentUser && currentUser.accessToken) {
        fetch('/api/opcua/status', {
            headers: { 'x-access-token': currentUser.accessToken }
        })
            .then(res => res.json())
            .then(status => {
                if (status) {
                    updateOpcUaStatusUI(status);
                    updateFooterConnections({ opcStatus: status });
                }
            })
            .catch(err => console.error("Initial OPC status fetch failed", err));
    }
}

function initOpcUaFormDefaults() {
    const signalEl = document.getElementById('opcua-new-signal');
    const scaleEl = document.getElementById('opcua-new-scale');
    if (!signalEl || !scaleEl || signalEl.dataset.bound === '1') return;

    const applyScalePreset = () => {
        if (signalEl.value === 'GROSS_WEIGHT' && (!scaleEl.value || scaleEl.value === '1')) {
            scaleEl.value = '0.01';
        }
        if (signalEl.value !== 'GROSS_WEIGHT' && scaleEl.value === '0.01') {
            scaleEl.value = '1';
        }
    };

    signalEl.addEventListener('change', applyScalePreset);
    signalEl.dataset.bound = '1';
    applyScalePreset();
}

// --- Footer Logic ---

function updateFooterSensors(carousels) {
    if (!carousels) return;
    for (let i = 1; i <= 5; i++) {
        const carousel = carousels[i];
        const el = document.getElementById(`sensor-${i}`);
        if (!el) continue;

        const led = el.querySelector('.led');
        if (!led) continue;

        // Reset classes
        led.className = 'led';

        if (carousel && carousel.data && carousel.data.sensorStatus) {
            led.classList.add('status-good');
        } else {
            led.classList.add('status-bad');
        }
    }
}

let lastSqlStatus = false;
let lastOpcStatus = false;

// function pollSqlStatus removed (merged with bottom one)

function updateFooterConnections(statusUpdate) {
    if (!statusUpdate) return;

    // Update local state - SQL
    if (statusUpdate.sql !== undefined) {
        lastSqlStatus = !!statusUpdate.sql;
    }

    // Update local state - OPC
    if (statusUpdate.opcStatus !== undefined) {
        lastOpcStatus = !!statusUpdate.opcStatus.connected;
    } else if (statusUpdate.opcConnected !== undefined) {
        lastOpcStatus = !!statusUpdate.opcConnected;
    }

    // Update UI - SQL
    const sqlIcon = document.getElementById('conn-sql');
    if (sqlIcon) {
        sqlIcon.className = 'conn-item ' + (lastSqlStatus ? 'status-good' : 'status-bad');
        const label = sqlIcon.querySelector('.conn-label');
        if (label) label.innerText = lastSqlStatus ? 'Connected' : 'Disconnected';
    }

    // Update UI - OPC
    const opcIcon = document.getElementById('conn-opc');
    if (opcIcon) {
        opcIcon.className = 'conn-item ' + (lastOpcStatus ? 'status-good' : 'status-bad');
        const label = opcIcon.querySelector('.conn-label');
        if (label) label.innerText = lastOpcStatus ? 'Connected' : 'Disconnected';
    }
}

let currentView = 'home';
let appSettings = {};

function navigate(view) {
    currentView = view;
    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');

    // Show/hide card picker
    const picker = document.getElementById('card-picker');
    const isMobile = window.innerWidth <= 768;
    if (picker) picker.style.display = view === 'home' ? '' : 'none';

    // Show selected
    if (view === 'home') {
        document.getElementById('view-home').style.display = isMobile ? 'flex' : 'grid';
    } else if (view === 'config') {
        // Allow Admin AND User
        if (!currentUser || !currentUser.roles || (!currentUser.roles.includes('ROLE_ADMIN') && !currentUser.roles.includes('ROLE_USER'))) {
            alert("Access Denied.");
            navigate('home');
            return;
        }
        document.getElementById('view-config').style.display = 'flex';
        loadSettings();
    } else if (view === 'users') {
        // Role Check
        if (!currentUser || !currentUser.roles || !currentUser.roles.includes('ROLE_ADMIN')) {
            alert("Access Denied: Admin privileges required.");
            navigate('home');
            return;
        }
        document.getElementById('view-users').style.display = 'flex';
        loadUsers();
    } else if (view === 'opcua') {
        if (!currentUser || !currentUser.roles || !currentUser.roles.includes('ROLE_ADMIN')) {
            alert("Access Denied: Admin privileges required.");
            navigate('home');
            return;
        }
        document.getElementById('view-opcua').style.display = 'flex';
        document.getElementById('view-opcua').style.display = 'flex';
        loadOpcUaConfig();
    } else if (view === 'history') {
        // Allow Admin AND User (maybe guest too? Let's say Admin/User for now)
        if (!currentUser || !currentUser.roles) {
            alert("Access Denied.");
            navigate('home');
            return;
        }
        document.getElementById('view-history').style.display = 'flex';
        loadHistory();
    }

    // Update Nav Active State
    document.querySelectorAll('.nav-btn').forEach((btn, idx) => {
        btn.classList.remove('active');
        const views = ['home', 'config', 'users', 'opcua', 'history'];


        // Hide buttons for restricted roles logic:
        // Guest: Hide all except Home
        // User: Hide Users & OPCUA
        // Admin: Show all

        const isGuest = currentUser && currentUser.roles && currentUser.roles.includes('ROLE_GUEST');
        const isUser = currentUser && currentUser.roles && currentUser.roles.includes('ROLE_USER');
        const isAdmin = currentUser && currentUser.roles && currentUser.roles.includes('ROLE_ADMIN');

        // Apply display logic to nav buttons
        if (idx === 1) { // Config
            btn.style.display = (isAdmin || isUser) ? 'flex' : 'none';
        }
        if (idx === 2) { // Users
            btn.style.display = (isAdmin) ? 'flex' : 'none';
        }
        if (idx === 3) { // OPCUA
            btn.style.display = (isAdmin) ? 'flex' : 'none';
        }
        if (idx === 4) { // History
            btn.style.display = (isAdmin || isUser || isGuest) ? 'flex' : 'none';
        }

        if (views[idx] === view) btn.classList.add('active');
    });
}


// --- Settings Logic ---
async function loadSettings() {
    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/settings', {
            headers: { 'x-access-token': token }
        });
        if (res.ok) {
            appSettings = await res.json();
            renderSettings();
        } else {
            // Handle 403 or other errors
            if (res.status === 403) alert("Access Denied to Settings");
        }
    } catch (e) {
        console.error("Failed to load settings", e);
    }
}

function renderSettings() {
    // SQL Inputs
    document.getElementById('cfg-server').value = appSettings.sql_server || '';
    document.getElementById('cfg-uid').value = appSettings.sql_uid || '';
    document.getElementById('cfg-pass').value = appSettings.sql_pass || '';
    document.getElementById('cfg-db').value = appSettings.sql_db || '';
    document.getElementById('cfg-table-zero').value = appSettings.table_zeroing || '';
    document.getElementById('cfg-table-weight').value = appSettings.table_weight || '';
    document.getElementById('cfg-table-main').value = appSettings.table_main || '';

    // Interlocks
    const container = document.getElementById('interlock-settings');
    container.innerHTML = '';

    for (let i = 1; i <= 5; i++) {
        const key = `carousel${i}`;
        const isInterlocked = appSettings.interlocks ? appSettings.interlocks[key] : false;

        const row = document.createElement('div');
        row.className = 'interlock-row';
        row.innerHTML = `
            <span style="font-weight:bold;">Carousel ${i}</span>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:0.8rem;">Normal</span>
                <label class="switch">
                    <input type="checkbox" onchange="toggleInterlock('${key}', this.checked)" ${isInterlocked ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
                <span style="font-size:0.8rem;">Interlock</span>
            </div>
        `;
        container.appendChild(row);
    }
}

async function toggleInterlock(key, checked) {
    if (!appSettings.interlocks) appSettings.interlocks = {};
    appSettings.interlocks[key] = checked;
    // Auto save on toggle? Or wait for save button? 
    // Usually toggles are instant, let's save.
    await saveSettings(true);
}

async function saveSettings(silent = false) {
    // Update local object from inputs
    appSettings.sql_server = document.getElementById('cfg-server').value;
    appSettings.sql_uid = document.getElementById('cfg-uid').value;
    appSettings.sql_pass = document.getElementById('cfg-pass').value;
    appSettings.sql_db = document.getElementById('cfg-db').value;
    appSettings.table_zeroing = document.getElementById('cfg-table-zero').value;
    appSettings.table_weight = document.getElementById('cfg-table-weight').value;
    appSettings.table_main = document.getElementById('cfg-table-main').value;

    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            body: JSON.stringify(appSettings)
        });

        if (res.ok) {
            if (!silent) alert('Settings Saved Successfully');
        } else {
            alert('Failed to save settings: ' + res.statusText);
        }
    } catch (e) {
        console.error("Save error", e);
    }
}

// --- User Management Logic ---
async function loadUsers() {
    try {
        if (!currentUser || !currentUser.accessToken) {
            alert("Error: No access token found. Please Logout and Login again.");
            return;
        }
        const token = currentUser.accessToken;
        const res = await fetch('/api/users', {
            headers: { 'x-access-token': token }
        });

        if (res.ok) {
            const users = await res.json();
            if (Array.isArray(users)) {
                renderUsers(users);
                if (users.length === 0) alert("No users found in database.");
            } else {
                alert("Error: Invalid response format");
            }
        } else {
            const err = await res.text();
            try {
                const jsonErr = JSON.parse(err);
                alert("Failed to load users: " + jsonErr.message);
            } catch (e) {
                alert("Failed to load users: " + res.statusText);
            }
        }
    } catch (e) {
        console.error("Failed to load users", e);
        alert("Network Error loading users: " + e.message);
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('user-list-body');
    tbody.innerHTML = '';

    users.forEach(u => {
        const roles = u.roles ? u.roles.map(r => r.name).join(', ') : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.id}</td>
            <td>${u.username}</td>
            <td>${u.email}</td>
            <td>${roles}</td>
            <td>
                <button class="btn-sm btn-danger" onclick="deleteUser(${u.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function showAddUserModal() {
    document.getElementById('user-modal').style.display = 'flex';
    document.getElementById('new-username').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('new-role').value = 'user';
}

function closeUserModal() {
    document.getElementById('user-modal').style.display = 'none';
}

async function submitUserCreation() {
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value.trim();
    const role = document.getElementById('new-role').value;

    if (!username || !password) {
        alert("Username and Password are required");
        return;
    }

    const email = `${username}@example.com`; // Auto-generate email for simplicity as per previous pattern

    createUser({ username, email, password, roles: [role] });
}

async function createUser(userData) {
    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/auth/signup', { // Use Auth Signup or User Create? Auth signup handles roles better usually
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            body: JSON.stringify(userData)
        });
        if (res.ok) {
            alert('User Created');
            closeUserModal();
            loadUsers();
        } else {
            const err = await res.json();
            alert('Error: ' + err.message);
        }
    } catch (e) {
        alert('Create failed');
    }
}

async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        const token = currentUser.accessToken;
        const res = await fetch(`/api/users/${id}`, {
            method: 'DELETE',
            headers: { 'x-access-token': token }
        });
        if (res.ok) {
            loadUsers();
        } else {
            alert('Failed to delete');
        }
    } catch (e) {
        alert('Delete error');
    }
}

function renderCarousels(carousels) {
    latestCarouselsSnapshot = carousels || latestCarouselsSnapshot;
    const container = document.getElementById('view-home');
    container.innerHTML = '';

    // Update Footer Sensors
    updateFooterSensors(carousels);

    for (let i = 1; i <= 5; i++) {
        const carousel = carousels ? carousels[i] : null;
        const col = document.createElement('div');
        // Map State to Class
        const stateClass =
            (carousel && carousel.state === 'RUN') ? 'status-running' :
                (carousel && carousel.state === 'PAUSE') ? 'status-paused' :
                    (carousel && carousel.state === 'STOP') ? 'status-stopped' :
                        (carousel && carousel.state === 'RESET') ? 'status-reset' : '';

        col.className = `carousel-col ${stateClass}`;
        // Add Click Handler
        col.onclick = (e) => {
            // Prevent if clicking update button
            if (e.target.closest('.update-btn')) return;
            openControlModal(i, carousel ? carousel.state : 'OFFLINE');
        };
        col.style.cursor = 'pointer';

        if (carousel && carousel.data && carousel.data.productId) {
            const d = carousel.data;
            const counter = parseInt(d.counter) || 0;
            const target = parseInt(d.target) || 1;
            const progress = Math.min((counter / target) * 100, 100);

            // Determine Weight Class based on logic
            let weightClass = '';

            if (carousel.state === 'STOP') {
                weightClass = 'bg-info';
            } else if (carousel.state === 'RUN') {
                if (d.lastGross < d.toleranceMin) {
                    weightClass = 'bg-danger';
                } else if (d.lastGross > d.toleranceMax) {
                    weightClass = 'bg-warning';
                } else {
                    weightClass = 'bg-success';
                }
            } else {
                // Default handling for other states (PAUSE/RESET) if needed
                // Currently defaults to base style (Teal/Primary)
                // If user wants Green for PAUSE/RESET too, uncomment below:
                // weightClass = 'bg-success';
            }

            col.innerHTML = `
                <div class="carousel-card">
                    <div class="card-loading-overlay">
                        <div class="spinner"></div>
                        <div class="loading-text">Updating Data...</div>
                    </div>

                    <div class="card-header">
                        <div class="carousel-number">Carousel ${i}</div>
                        <div class="carousel-name">${d.productName || carousel.name}</div>
                    </div>
                    
                    <div class="card-body">
                        <div class="info-row">
                            <span class="info-label">Product ID</span>
                            <span class="info-value">${d.productId}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Packing Order</span>
                            <span class="info-value">${d.packingOrder}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Package</span>
                            <span class="info-value" title="${d.packagingMaterial || '-'}">${d.packagingMaterial || '-'}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Tolerance</span>
                            <span class="info-value">${d.toleranceMin} — ${d.toleranceMax} Kg</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Pack Weight</span>
                            <span class="info-value">${(parseFloat(d.packWeight) || 0).toFixed(2)} Kg</span>
                        </div>
                    </div>

                    <div class="weight-section">
                        <div class="weight-label">Gross Weight</div>
                        <div class="weight-display ${weightClass}">${(d.lastGross || 0).toFixed(2)} Kg</div>
                    </div>

                    <div class="progress-section">
                        <div class="progress-info">
                            <span>Counter: ${counter} Pcs</span>
                            <span>Target: ${target} Pcs</span>
                        </div>
                        <div class="progress-bar-track">
                            <div class="progress-bar-fill" style="width: ${progress.toFixed(1)}%"></div>
                        </div>
                    </div>

                    <div class="stats-grid" title="Statistics based on the last 1 hour of production">
                        <div class="stat-box">
                            <div class="stat-label">Min (1h)</div>
                            <div class="stat-value">${(d.minVal || 0).toFixed(2)}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">Nett</div>
                            <div class="stat-value">${(d.lastNett || 0).toFixed(2)}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">Avg (1h)</div>
                            <div class="stat-value">${(d.average || 0).toFixed(2)}</div>
                        </div>
                    </div>

                    <div class="card-footer">
                        <button class="update-btn" onclick="triggerManualUpdate(${i}, event)">⟳ Update Data</button>
                    </div>
                </div>
            `;
        } else {
            col.innerHTML = `
                <div class="empty-state">
                    <div class="card-loading-overlay">
                        <div class="spinner"></div>
                        <div class="loading-text">Updating Data...</div>
                    </div>
                    <span class="icon" style="color:var(--accent-danger); opacity:0.8;">🔌</span>
                    <span style="font-size:1rem; font-weight:600; color:var(--text-secondary);">Carousel ${i}</span>
                    <span style="font-weight:700; color:var(--accent-danger); letter-spacing:1px; margin-top:5px; margin-bottom:15px;">OFFLINE</span>
                    <div class="weight-section" style="width: 100%; padding: 0 14px;">
                        <div class="weight-label">Gross Weight</div>
                        <div class="weight-display bg-danger">0.00 Kg</div>
                    </div>
                </div>
            `;
            col.style.borderColor = "var(--accent-danger)";
            col.style.boxShadow = "none";
        }

        container.appendChild(col);
    }
    activateMobileCard();
}

// --- Manual Update Integration ---
async function triggerManualUpdate(id, event) {
    if (event) event.stopPropagation();

    // Show loading immediately for better UX
    const overlays = document.querySelectorAll('.card-loading-overlay');
    overlays.forEach(overlay => overlay.classList.add('active'));

    try {
        const token = localStorage.getItem('scada_token');
        const res = await fetch('/api/scada/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            }
        });
        if (!res.ok) throw new Error("Failed to refresh data");
    } catch (err) {
        console.error("Manual refresh error:", err.message);
        // Hide on error
        overlays.forEach(overlay => overlay.classList.remove('active'));
    }
}

// --- Control Modal Logic ---
let currentControlId = null;

function openControlModal(id, currentState) {
    currentControlId = id;
    const modal = document.getElementById('control-modal');
    document.getElementById('modal-title').innerText = `Control: Carousel ${id}`;

    const statusSpan = document.getElementById('modal-status-val');
    statusSpan.innerText = currentState || 'UNKNOWN';
    statusSpan.className = '';
    if (currentState === 'RUN') statusSpan.classList.add('text-success');
    if (currentState === 'RESET') statusSpan.style.color = '#3b82f6';
    // color is handled by CSS vars usually

    // Disable logic if needed?? User said: "Apabila tag OPC kosong atau offline maka semua kontrol tadi akan disabled"
    // We can check opc connection status here if we have it globally? 
    // We have opcua-status event. Let's start basic.

    modal.style.display = 'flex';
}

function closeControlModal() {
    document.getElementById('control-modal').style.display = 'none';
    currentControlId = null;
}

window.onclick = function (event) {
    const modal = document.getElementById('control-modal');
    const opcEditModal = document.getElementById('opcua-edit-modal');
    if (event.target === modal) {
        closeControlModal();
    }
    if (event.target === opcEditModal) {
        closeOpcUaEditModal();
    }
}

async function sendControlCommand(command) {
    if (!currentControlId) return;

    // Check if OPC is connected (Client side check)
    // REMOVED: Control is now via SQL, independant of OPC status.
    /*
    const badge = document.getElementById('opcua-status-badge');
    if (badge && badge.innerText === 'DISCONNECTED') {
        alert("Cannot send command: OPC-UA is Disconnected");
        return;
    }
    */

    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            body: JSON.stringify({ carouselId: currentControlId, command })
        });

        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            closeControlModal();
        } else {
            alert("Error: " + (data.error || 'Command Failed'));
        }
    } catch (e) {
        alert("Command Error: " + e.message);
    }
}

async function triggerResetError() {
    const btn = document.getElementById('btn-reset-error');
    const originalHtml = btn ? btn.innerHTML : '';

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="icon">⏳</span> RESETTING...';
        }

        const token = currentUser && currentUser.accessToken;
        const res = await fetch('/api/control/reset-error', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'x-access-token': token } : {})
            }
        });
        const raw = await res.text();
        let data = null;
        try {
            data = raw ? JSON.parse(raw) : null;
        } catch (parseErr) {
            if (!res.ok) {
                const msg = res.status === 404
                    ? 'Endpoint reset-error belum tersedia. Restart backend lalu coba lagi.'
                    : `Server returned non-JSON response (HTTP ${res.status})`;
                showOpcUaToast(msg, 'error');
                return;
            }
            throw parseErr;
        }

        if (res.ok && data && data.success) {
            showOpcUaToast('Reset error signal sent', 'success');
        } else {
            showOpcUaToast((data && data.error) || `Failed to send reset signal (HTTP ${res.status})`, 'error');
        }
    } catch (e) {
        showOpcUaToast(`Reset error failed: ${e.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml || '<span class="icon">🔄</span> RESET';
        }
    }
}

// ==========================================================
// OPC-UA Configuration Functions
// ==========================================================

let opcuaConfig = null;
let opcuaLiveValues = {};
let editingOpcuaIndex = null;

async function loadOpcUaConfig() {
    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/opcua/config', {
            headers: { 'x-access-token': token }
        });
        if (res.ok) {
            opcuaConfig = await res.json();
            document.getElementById('opcua-endpoint').value = opcuaConfig.endpointUrl || '';
            document.getElementById('opcua-security').value = opcuaConfig.securityMode || 'None';
            document.getElementById('opcua-policy').value = opcuaConfig.securityPolicy || 'Basic256';
            document.getElementById('opcua-publish').value = opcuaConfig.publishInterval || 1000;
            document.getElementById('opcua-sampling').value = opcuaConfig.samplingInterval || 500;
            document.getElementById('opcua-autoconnect').checked = opcuaConfig.autoConnect || false;
            document.getElementById('opcua-username').value = opcuaConfig.username || '';
            document.getElementById('opcua-password').value = opcuaConfig.password || '';
            renderOpcUaNodes();
        }

        const statusRes = await fetch('/api/opcua/status', {
            headers: { 'x-access-token': token }
        });
        if (statusRes.ok) {
            const st = await statusRes.json();
            updateOpcUaStatusUI(st);
            updateFooterConnections({ opcStatus: st });
        }
    } catch (e) {
        showOpcUaToast('Failed to load OPC-UA config', 'error');
    }
}

async function saveOpcUaConfig() {
    const config = {
        endpointUrl: document.getElementById('opcua-endpoint').value.trim(),
        securityMode: document.getElementById('opcua-security').value,
        securityPolicy: document.getElementById('opcua-policy').value,
        publishInterval: parseInt(document.getElementById('opcua-publish').value) || 1000,
        samplingInterval: parseInt(document.getElementById('opcua-sampling').value) || 500,
        autoConnect: document.getElementById('opcua-autoconnect').checked,
        username: document.getElementById('opcua-username').value.trim(),
        password: document.getElementById('opcua-password').value
    };

    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/opcua/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-access-token': token },
            body: JSON.stringify(config)
        });
        const data = await res.json();
        if (data.success) {
            opcuaConfig = data.config;
            showOpcUaToast('Config saved ✓', 'success');
        } else {
            showOpcUaToast(data.error || 'Save failed', 'error');
        }
    } catch (e) {
        showOpcUaToast('Save error', 'error');
    }
}

async function opcuaConnect() {
    const btn = document.getElementById('btn-opcua-connect');
    btn.disabled = true;
    btn.innerText = '⏳ CONNECTING...';

    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/opcua/connect', {
            method: 'POST',
            headers: { 'x-access-token': token }
        });
        const data = await res.json();
        if (data.success) {
            showOpcUaToast('Connected to OPC-UA server', 'success');
        } else {
            showOpcUaToast(data.error || 'Connect failed', 'error');
        }
    } catch (e) {
        showOpcUaToast('Connect error', 'error');
    }
    btn.disabled = false;
    btn.innerText = '🔌 CONNECT';
}

async function opcuaDisconnect() {
    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/opcua/disconnect', {
            method: 'POST',
            headers: { 'x-access-token': token }
        });
        const data = await res.json();
        if (data.success) {
            showOpcUaToast('Disconnected', 'success');
        } else {
            showOpcUaToast(data.error || 'Disconnect failed', 'error');
        }
    } catch (e) {
        showOpcUaToast('Disconnect error', 'error');
    }
}

async function addOpcUaNode() {
    const nodeId = document.getElementById('opcua-new-nodeid').value.trim();
    const name = document.getElementById('opcua-new-name').value.trim();
    const desc = document.getElementById('opcua-new-desc').value.trim();
    const machineIdRaw = document.getElementById('opcua-new-machine').value;
    const signalType = document.getElementById('opcua-new-signal').value;
    const scaleRaw = document.getElementById('opcua-new-scale').value;
    if (!nodeId) { showOpcUaToast('Node ID required', 'error'); return; }

    const machineId = machineIdRaw ? parseInt(machineIdRaw, 10) : null;
    const scale = Number.isFinite(parseFloat(scaleRaw)) ? parseFloat(scaleRaw) : 1;
    if (['GROSS_WEIGHT', 'PRODUCT_SENSOR', 'CAROUSEL_INTERLOCK', 'GROSS_NORMAL', 'GROSS_UNDER', 'GROSS_OVER', 'MACHINE_RUN'].includes(signalType) && !machineId) {
        showOpcUaToast('Machine wajib dipilih untuk signal ini', 'error');
        return;
    }

    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/opcua/config/nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-access-token': token },
            body: JSON.stringify({
                nodeId,
                name: name || nodeId,
                description: desc,
                machineId,
                signalType,
                scale
            })
        });
        const data = await res.json();
        if (data.success) {
            opcuaConfig.nodes = data.nodes;
            renderOpcUaNodes();
            document.getElementById('opcua-new-nodeid').value = '';
            document.getElementById('opcua-new-name').value = '';
            document.getElementById('opcua-new-desc').value = '';
            document.getElementById('opcua-new-machine').value = '';
            document.getElementById('opcua-new-signal').value = 'GROSS_WEIGHT';
            document.getElementById('opcua-new-scale').value = '0.01';
            showOpcUaToast('Node added', 'success');
        } else {
            showOpcUaToast(data.error || 'Add failed', 'error');
        }
    } catch (e) {
        showOpcUaToast('Add error', 'error');
    }
}

async function removeOpcUaNode(index) {
    try {
        const token = currentUser.accessToken;
        const res = await fetch(`/api/opcua/config/nodes/${index}`, {
            method: 'DELETE',
            headers: { 'x-access-token': token }
        });
        const data = await res.json();
        if (data.success) {
            opcuaConfig.nodes = data.nodes;
            renderOpcUaNodes();
            showOpcUaToast('Node removed', 'success');
        } else {
            showOpcUaToast(data.error || 'Remove failed', 'error');
        }
    } catch (e) {
        showOpcUaToast('Remove error', 'error');
    }
}

function openOpcUaEditModal(index) {
    if (!opcuaConfig || !Array.isArray(opcuaConfig.nodes)) return;
    const node = opcuaConfig.nodes[index];
    if (!node) return;

    editingOpcuaIndex = index;
    document.getElementById('opcua-edit-nodeid').value = node.nodeId || '';
    document.getElementById('opcua-edit-name').value = node.name || '';
    document.getElementById('opcua-edit-machine').value = node.machineId ? String(node.machineId) : '';
    document.getElementById('opcua-edit-signal').value = node.signalType || 'GROSS_WEIGHT';
    document.getElementById('opcua-edit-scale').value = Number.isFinite(parseFloat(node.scale)) ? String(node.scale) : '1';
    document.getElementById('opcua-edit-desc').value = node.description || '';

    document.getElementById('opcua-edit-modal').style.display = 'flex';
}

function closeOpcUaEditModal() {
    editingOpcuaIndex = null;
    const modal = document.getElementById('opcua-edit-modal');
    if (modal) modal.style.display = 'none';
}

async function saveOpcUaNodeEdit() {
    if (editingOpcuaIndex === null || editingOpcuaIndex === undefined) return;

    const nodeId = document.getElementById('opcua-edit-nodeid').value.trim();
    const name = document.getElementById('opcua-edit-name').value.trim();
    const machineIdRaw = document.getElementById('opcua-edit-machine').value;
    const signalType = document.getElementById('opcua-edit-signal').value;
    const scaleRaw = document.getElementById('opcua-edit-scale').value;
    const description = document.getElementById('opcua-edit-desc').value.trim();

    if (!nodeId) {
        showOpcUaToast('Node ID required', 'error');
        return;
    }

    const machineId = machineIdRaw ? parseInt(machineIdRaw, 10) : null;
    if (['GROSS_WEIGHT', 'PRODUCT_SENSOR', 'CAROUSEL_INTERLOCK', 'GROSS_NORMAL', 'GROSS_UNDER', 'GROSS_OVER', 'MACHINE_RUN'].includes(signalType) && !machineId) {
        showOpcUaToast('Machine wajib dipilih untuk signal ini', 'error');
        return;
    }

    const scale = Number.isFinite(parseFloat(scaleRaw)) ? parseFloat(scaleRaw) : 1;

    try {
        const token = currentUser.accessToken;
        const res = await fetch(`/api/opcua/config/nodes/${editingOpcuaIndex}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-access-token': token },
            body: JSON.stringify({
                nodeId,
                name: name || nodeId,
                machineId,
                signalType,
                scale,
                description
            })
        });

        const raw = await res.text();
        let data = null;
        try {
            data = raw ? JSON.parse(raw) : null;
        } catch (parseErr) {
            if (!res.ok) {
                const msg = res.status === 404
                    ? 'Endpoint update node belum tersedia. Restart backend lalu coba lagi.'
                    : `Server returned non-JSON response (HTTP ${res.status})`;
                showOpcUaToast(msg, 'error');
                return;
            }
            throw parseErr;
        }

        if (res.ok && data && data.success) {
            opcuaConfig.nodes = data.nodes;
            renderOpcUaNodes();
            closeOpcUaEditModal();
            showOpcUaToast('Node updated', 'success');
        } else {
            showOpcUaToast((data && data.error) || `Update failed (HTTP ${res.status})`, 'error');
        }
    } catch (e) {
        console.error('saveOpcUaNodeEdit failed:', e);
        showOpcUaToast(`Update error: ${e.message}`, 'error');
    }
}

function renderOpcUaNodes() {
    if (!opcuaConfig) return;
    const tbody = document.getElementById('opcua-nodes-body');
    tbody.innerHTML = '';
    document.getElementById('opcua-node-count').innerText = `${opcuaConfig.nodes.length} node${opcuaConfig.nodes.length !== 1 ? 's' : ''}`;

    if (opcuaConfig.nodes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#999; padding:20px;">No nodes configured</td></tr>`;
        return;
    }

    opcuaConfig.nodes.forEach((node, idx) => {
        const liveVal = opcuaLiveValues[node.name];
        const machineLabel = node.machineId ? `CR${node.machineId}` : 'Global';
        const signalType = node.signalType || 'UNKNOWN';
        const grossCategory = getGrossWeightCategory(node, liveVal);
        const signalTypeHtml = formatSignalTypeCell(signalType, grossCategory);
        const scale = Number.isFinite(parseFloat(node.scale)) ? parseFloat(node.scale) : 1;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td style="font-family: var(--font-digital); font-size: 0.8rem;">${node.nodeId}</td>
            <td style="font-weight: 600">${node.name}</td>
            <td>${machineLabel}</td>
            <td>${signalTypeHtml}</td>
            <td>${scale}</td>
            <td>${node.description || '—'}</td>
            <td style="font-family: var(--font-digital)" id="opcua-live-${idx}">${liveVal ? liveVal.value : '—'}</td>
            <td>
                <button class="btn-sm" onclick="openOpcUaEditModal(${idx})">Edit</button>
                <button class="btn-sm btn-danger" onclick="removeOpcUaNode(${idx})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getGrossWeightCategory(node, liveVal) {
    if (!node || !liveVal) return '';
    const signalType = (node.signalType || '').toString().trim().toUpperCase();
    if (signalType !== 'GROSS_WEIGHT') return '';

    const machineId = parseInt(node.machineId, 10);
    if (!Number.isInteger(machineId) || machineId < 1 || machineId > 5) return 'NO_MACHINE';

    const carousel = latestCarouselsSnapshot && latestCarouselsSnapshot[machineId];
    if (!carousel || !carousel.data) return 'NO_DATA';

    const toleranceMin = parseFloat(carousel.data.toleranceMin);
    const toleranceMax = parseFloat(carousel.data.toleranceMax);
    if (!Number.isFinite(toleranceMin) || !Number.isFinite(toleranceMax)) return 'NO_TOLERANCE';

    const rawValue = parseFloat(liveVal.value);
    if (!Number.isFinite(rawValue)) return 'NO_VALUE';

    const scale = Number.isFinite(parseFloat(node.scale)) ? parseFloat(node.scale) : 1;
    const grossValue = rawValue * scale;

    if (grossValue < toleranceMin) return 'UNDER_MIN';
    if (grossValue > toleranceMax) return 'OVER_MAX';
    return 'NORMAL';
}

function formatSignalTypeCell(signalType, grossCategory) {
    const safeSignalType = signalType || 'UNKNOWN';
    if (!grossCategory) {
        return `<span class="signal-type-main">${safeSignalType}</span>`;
    }

    const categoryClass =
        grossCategory === 'NORMAL' ? 'category-normal' :
            grossCategory === 'UNDER_MIN' ? 'category-under' :
                grossCategory === 'OVER_MAX' ? 'category-over' : 'category-info';

    return `
        <div class="signal-type-cell">
            <span class="signal-type-main">${safeSignalType}</span>
            <span class="signal-type-category ${categoryClass}">${grossCategory}</span>
        </div>
    `;
}

function updateOpcUaStatusUI(status) {
    const badge = document.getElementById('opcua-status-badge');
    const dot = document.getElementById('opcua-nav-dot');
    const btnConn = document.getElementById('btn-opcua-connect');
    const btnDisc = document.getElementById('btn-opcua-disconnect');

    if (!badge || !dot) return;

    badge.className = 'opcua-badge';
    dot.className = 'opcua-dot';

    if (status.connected) {
        badge.innerText = 'CONNECTED';
        badge.classList.add('connected');
        dot.classList.add('connected');
        btnConn.style.display = 'none';
        btnDisc.style.display = 'inline-block';
    } else if (status.connecting) {
        badge.innerText = 'CONNECTING...';
        badge.classList.add('connecting');
        dot.classList.add('connecting');
        btnConn.style.display = 'none';
        btnDisc.style.display = 'none';
    } else {
        badge.innerText = 'DISCONNECTED';
        btnConn.style.display = 'inline-block';
        btnDisc.style.display = 'none';
    }

    if (status.liveValues) {
        opcuaLiveValues = status.liveValues;
        // Trigger UI update for all known values
        if (opcuaConfig && opcuaConfig.nodes) {
            Object.values(status.liveValues).forEach(val => updateOpcUaLiveValue(val));
        }
    }
}

function updateOpcUaLiveValue(data) {
    if (!data || !data.name) return;
    opcuaLiveValues[data.name] = data;
    console.log('[OPC-UA] Live Value:', data.name, data.value); // Debug log

    if (opcuaConfig) {
        const idx = opcuaConfig.nodes.findIndex(n => n.name === data.name);
        if (idx >= 0) {
            const cell = document.getElementById(`opcua-live-${idx}`);
            if (cell) {
                cell.innerText = data.value !== null && data.value !== undefined ? data.value : '—';
                cell.style.color = data.statusCode === 'Good' ? '#28a745' : '#ffc107';

                // Also update row background flash? (Optional)
                cell.style.transition = 'none';
                cell.style.backgroundColor = 'rgba(40, 167, 69, 0.2)';
                setTimeout(() => {
                    cell.style.transition = 'background-color 0.5s';
                    cell.style.backgroundColor = 'transparent';
                }, 100);
            }
        }
    }
}

function showOpcUaToast(msg, type) {
    const existing = document.querySelector('.opcua-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = `opcua-toast ${type || ''}`;
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 3000);
}

function handleScadaAlert(alertData) {
    if (!alertData || alertData.type !== 'sql_insert_failed') return;

    const carousel = alertData.carousel || 'Unknown Carousel';
    const msg = alertData.message || `Gagal update WEIGHT_DATA untuk ${carousel}`;
    showOperatorToast(`${msg}. Cek koneksi SQL/table.`);
}

function showOperatorToast(msg) {
    const existing = document.querySelector('.operator-toast');
    if (existing) existing.remove();

    const t = document.createElement('div');
    t.className = 'operator-toast';
    t.innerText = msg;
    document.body.appendChild(t);

    setTimeout(() => { if (t.parentNode) t.remove(); }, 6000);
}

// --- SQL Status Polling ---
async function pollSqlStatus() {
    const badge = document.getElementById('sql-status-badge');
    // if (!badge) return; // Don't return early, we might need to update footer even if badge is missing (though it shouldn't be)

    try {
        const res = await fetch('/api/sql/status');
        const data = await res.json();

        // Update Footer (Always)
        updateFooterConnections({ sql: data.connected });

        // Update Badge (If exists)
        if (badge) {
            if (data.connected) {
                badge.innerText = "CONNECTED";
                badge.className = "status-badge connected";
                badge.title = `Connected to ${data.database} on ${data.server}`;
            } else {
                badge.innerText = "DISCONNECTED";
                badge.className = "status-badge disconnected";
                badge.title = "Connection Failed";
            }
        }
    } catch (e) {
        // Error state
        updateFooterConnections({ sql: false });
        if (badge) {
            badge.innerText = "ERROR";
            badge.className = "status-badge disconnected";
        }
    }
}

// Start polling
setInterval(pollSqlStatus, 10000);
// Initial check after short delay to ensure DOM load
setTimeout(pollSqlStatus, 1000);

// --- History Logic ---
async function loadHistory() {
    const tbody = document.getElementById('history-list-body');
    const carouselFilterEl = document.getElementById('history-carousel-filter');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading records...</td></tr>';

    try {
        const token = currentUser.accessToken;
        const limit = 100;
        const params = new URLSearchParams({ limit: String(limit) });
        const selectedCarousel = carouselFilterEl ? carouselFilterEl.value : '';
        if (selectedCarousel) {
            params.set('carousel', selectedCarousel);
        }

        const res = await fetch(`/api/scada/history?${params.toString()}`, {
            headers: { 'x-access-token': token }
        });

        if (res.ok) {
            const data = await res.json();
            renderHistory(data, limit);
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Failed to load history</td></tr>';
        }
    } catch (e) {
        console.error("History Error", e);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Network Error</td></tr>';
    }
}

function renderHistory(data, limit = 100) {
    const tbody = document.getElementById('history-list-body');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No records found</td></tr>';
        return;
    }

    // Check if we hit the limit
    if (data.length >= limit) {
        console.log(`[History] Showing ${limit} most recent records out of possibly more`);
    }

    data.forEach(row => {
        const tr = document.createElement('tr');
        // Format Date
        const date = new Date(row.TIMESTAMP || row.createdAt); // Fallback
        const dateStr = date.toLocaleString('en-GB');

        // Format weight values to 2 decimal places
        const grossWeight = row.GROSS_WEIGHT ? parseFloat(row.GROSS_WEIGHT).toFixed(2) : '-';
        const nettWeight = row.NETT_WEIGHT ? parseFloat(row.NETT_WEIGHT).toFixed(2) : '-';

        tr.innerHTML = `
            <td>${dateStr}</td>
            <td>${row.CAROUSEL}</td>
            <td>${row.PRODUCT_NAME} <span style="font-size:0.8em; color:#888;">(${row.PRODUCT_ID})</span></td>
            <td>${row.TARGET_COUNT || '-'}</td>
            <td>${grossWeight}</td>
            <td>${nettWeight}</td>
            <td><span class="status-badge status-${(row.STATUS || '').toLowerCase()}">${row.STATUS}</span></td>
        `;
        tbody.appendChild(tr);
    });
}
