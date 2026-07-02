/**
 * SCADA Unified - Carousel Logic
 */

let socket = null;
let currentUser = null;

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

    // Connect Socket with authentication
    socket = io({
        auth: {
            token: currentUser.accessToken
        }
    });

    socket.on('init', (data) => {
        console.log("Init Data", data);
        renderCarousels(data);
    });

    socket.on('carousel-update', (data) => {
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

    // SQL status via Socket.IO (real-time push instead of polling)
    socket.on('sql-status', (status) => {
        updateSqlStatusUI(status);
    });

    // System log real-time
    socket.on('system-log', (entry) => {
        appendLogEntry(entry);
    });

    // Load initial settings
    loadSettings();

    // Initial SQL status load - wait a bit for socket to be ready
    setTimeout(() => pollSqlStatus(), 500);
    // Periodic SQL status check (fallback if socket fails)
    setInterval(pollSqlStatus, 30000); // Every 30s

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

// --- Footer Logic ---

function updateFooterSensors(carousels) {
    for (let i = 1; i <= 5; i++) {
        const el = document.getElementById(`sensor-${i}`);
        if (!el) continue;

        const led = el.querySelector('.led');
        if (!led) continue;

        // Reset classes
        led.className = 'led';

        if (!lastOpcStatus) {
            led.classList.add('status-neutral'); // Gray: OPC UA Offline
            continue;
        }

        const liveVal = opcuaLiveValues[`S${i}`];
        if (liveVal) {
            if (!liveVal.statusCode || !liveVal.statusCode.toString().startsWith('Good')) {
                led.classList.add('status-neutral'); // Gray: bad sensor health
            } else if (liveVal.value === true || liveVal.value === 1 || liveVal.value === 'true') {
                led.classList.add('status-good'); // Green: active (bag detected)
            } else {
                led.classList.add('status-warning'); // Yellow: connected but inactive
            }
        } else {
            // Check if carousel sensorStatus is set as fallback
            const carousel = carousels ? carousels[i] : null;
            if (carousel && carousel.data && carousel.data.sensorStatus) {
                led.classList.add('status-good');
            } else {
                led.classList.add('status-warning'); // Yellow: connected (default when no liveVal yet but connected)
            }
        }
    }
}

let lastSqlStatus = false;
let lastOpcStatus = false;
let lastSqlStatusData = null;

// Reusable function to update SQL status UI (both footer and badge)
function updateSqlStatusUI(status) {
    if (!status) return;
    
    // Store last status
    lastSqlStatusData = status;
    
    // Update Footer
    updateFooterConnections({ sql: status.connected });
    
    // Update Badge (if exists in DOM)
    const badge = document.getElementById('sql-status-badge');
    if (badge) {
        if (status.connected) {
            badge.className = 'status-badge connected';
            badge.innerText = 'CONNECTED';
            badge.title = status.database ? `Connected to ${status.database} on ${status.server}` : 'Connected';
        } else {
            badge.className = 'status-badge disconnected';
            badge.innerText = 'DISCONNECTED';
            badge.title = 'Connection Failed';
        }
    }
}

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

    // Update UI - SQL (with blinking for disconnected)
    const sqlIcon = document.getElementById('conn-sql');
    if (sqlIcon) {
        sqlIcon.className = 'conn-item ' + (lastSqlStatus ? 'status-good' : 'status-bad blink-danger');
        const label = sqlIcon.querySelector('.conn-label');
        if (label) label.innerText = lastSqlStatus ? 'Connected' : 'Disconnected';
    }

    // Update UI - OPC (with blinking for disconnected)
    const opcIcon = document.getElementById('conn-opc');
    if (opcIcon) {
        opcIcon.className = 'conn-item ' + (lastOpcStatus ? 'status-good' : 'status-bad blink-danger');
        const label = opcIcon.querySelector('.conn-label');
        if (label) label.innerText = lastOpcStatus ? 'Connected' : 'Disconnected';
    }

    // Refresh sensor LEDs on connection state change
    updateFooterSensors();
}

let currentView = 'home';
let appSettings = {};
let historyIntervalId = null;

function navigate(view) {
    if (historyIntervalId) {
        clearInterval(historyIntervalId);
        historyIntervalId = null;
    }
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
        // Refresh SQL status when opening config page
        setTimeout(() => {
            if (lastSqlStatusData) {
                updateSqlStatusUI(lastSqlStatusData);
            } else {
                pollSqlStatus();
            }
        }, 100);
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

        // Start history auto-refresh interval based on dropdown selection
        onHistoryRefreshChange();
    } else if (view === 'logs') {
        // Allow Admin and User
        if (!currentUser || !currentUser.roles || (!currentUser.roles.includes('ROLE_ADMIN') && !currentUser.roles.includes('ROLE_USER'))) {
            alert("Access Denied.");
            navigate('home');
            return;
        }
        document.getElementById('view-logs').style.display = 'flex';
        loadLogs();
    }

    // Update Nav Active State
    document.querySelectorAll('.nav-btn').forEach((btn, idx) => {
        btn.classList.remove('active');
        const views = ['home', 'config', 'users', 'opcua', 'history', 'logs'];


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
        if (idx === 5) { // Logs
            btn.style.display = (isAdmin || isUser) ? 'flex' : 'none';
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

    // SQL Auto-Reconnect checkbox
    const sqlAutoReconnect = document.getElementById('cfg-sql-auto-reconnect');
    if (sqlAutoReconnect) {
        sqlAutoReconnect.checked = !!appSettings.sql_auto_reconnect;
    }

    // Interlocks
    const container = document.getElementById('interlock-settings');
    container.innerHTML = '';

    for (let i = 1; i <= 5; i++) {
        const key = `carousel${i}`;
        const isInterlocked = appSettings.interlocks ? appSettings.interlocks[key] : false;
        const devThreshold = (appSettings.deviationThresholds && appSettings.deviationThresholds[key] !== undefined)
            ? appSettings.deviationThresholds[key]
            : 1.0;

        const row = document.createElement('div');
        row.className = 'interlock-row';
        row.innerHTML = `
            <span style="font-weight:bold;">Carousel ${i}</span>
            <div style="display:flex; align-items:center; gap:10px;">
                <label style="font-size:0.75rem; white-space:nowrap;">Dev.Min :</label>
                <input type="number"
                       id="dev-threshold-${key}"
                       value="${devThreshold}"
                       step="0.01"
                       min="0"
                       style="width:72px; padding:3px 6px; font-size:0.8rem; border:1px solid #444; border-radius:4px; background:#1e1e2d; color:#e0e0e0;"
                       onchange="updateDeviationThreshold('${key}', this.value)">
                <span style="font-size:0.7rem; color:#888;">Kg</span>
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

async function updateDeviationThreshold(key, value) {
    if (!appSettings.deviationThresholds) appSettings.deviationThresholds = {};
    const numVal = parseFloat(value);
    if (!Number.isFinite(numVal) || numVal < 0) {
        // Reset to previously saved value
        const prev = appSettings.deviationThresholds[key] || 1.0;
        document.getElementById(`dev-threshold-${key}`).value = prev;
        return;
    }
    appSettings.deviationThresholds[key] = parseFloat(numVal.toFixed(4));
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

    // SQL Auto-Reconnect checkbox
    const sqlAutoReconnect = document.getElementById('cfg-sql-auto-reconnect');
    if (sqlAutoReconnect) {
        appSettings.sql_auto_reconnect = sqlAutoReconnect.checked;
    }

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
            // Reload SQL status after settings change
            setTimeout(() => pollSqlStatus(), 1500); // Wait 1.5s for backend to reconnect
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
            <td>${roles}</td>
            <td style="white-space: nowrap; width: 180px;">
                <div style="display: flex; flex-direction: row; gap: 8px; align-items: center; justify-content: flex-start;">
                    <button class="user-action-btn edit" onclick="showEditUserModal(${u.id}, '${u.username}', '${roles}')">
                        <i class='bx bx-edit-alt'></i> Edit
                    </button>
                    <button class="user-action-btn delete" onclick="deleteUser(${u.id})">
                        <i class='bx bx-trash'></i> Delete
                    </button>
                </div>
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

function showEditUserModal(id, username, rolesStr) {
    document.getElementById('edit-user-modal').style.display = 'flex';
    document.getElementById('edit-user-id').value = id;
    document.getElementById('edit-username').value = username;
    document.getElementById('edit-password').value = '';
    
    // Determine primary role for select
    let primaryRole = 'user';
    if (rolesStr.includes('admin')) primaryRole = 'admin';
    else if (rolesStr.includes('guest')) primaryRole = 'guest';
    document.getElementById('edit-role').value = primaryRole;
}

function closeEditUserModal() {
    document.getElementById('edit-user-modal').style.display = 'none';
}

async function submitUserEdit() {
    const id = document.getElementById('edit-user-id').value;
    const password = document.getElementById('edit-password').value.trim();
    const role = document.getElementById('edit-role').value;

    const updateData = {};
    if (password) {
        updateData.password = password;
    }
    updateData.roles = [role];

    try {
        const token = currentUser.accessToken;
        const res = await fetch(`/api/users/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            body: JSON.stringify(updateData)
        });
        
        if (res.ok) {
            alert('User updated successfully');
            closeEditUserModal();
            loadUsers();
        } else {
            const err = await res.json();
            alert('Error updating user: ' + (err.message || res.statusText));
        }
    } catch (e) {
        alert('Update failed: ' + e.message);
    }
}

function renderCarousels(carousels) {
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

            // Show the last stored PRODUCT_COUNT so the dashboard card matches SQL history.
            const displayedCounter = (d._lastInsertedProductCount !== undefined && d._lastInsertedProductCount !== null)
                ? (parseInt(d._lastInsertedProductCount, 10) || 0)
                : 0;

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
                            <span>Counter: ${displayedCounter} Pcs</span>
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
                    <span class="icon" style="color:var(--accent-warning); opacity:0.8;">⌛</span>
                    <span style="font-size:1rem; font-weight:600; color:var(--text-secondary);">Carousel ${i}</span>
                    <span style="font-weight:700; color:var(--accent-warning); letter-spacing:1px; margin-top:5px; margin-bottom:15px;">Waiting for Packing Order</span>
                    <div class="weight-section" style="width: 100%; padding: 0 14px;">
                        <div class="weight-label">Gross Weight</div>
                        <div class="weight-display bg-warning">0.00 Kg</div>
                    </div>
                </div>
            `;
            col.style.borderColor = "var(--accent-warning)";
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
    const controlModal = document.getElementById('control-modal');
    const opcEditModal = document.getElementById('opcua-edit-modal');
    if (event.target === controlModal) {
        closeControlModal();
    }
    if (event.target === opcEditModal) {
        closeOpcUaEditModal();
    }
}

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const opcEditModal = document.getElementById('opcua-edit-modal');
    if (opcEditModal && opcEditModal.style.display === 'flex') {
        closeOpcUaEditModal();
    }
});

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
            btn.innerHTML = originalHtml || '<span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rotate-ccw"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></span> RESET';
        }
    }
}

// ==========================================================
// OPC-UA Configuration Functions
// ==========================================================

let opcuaConfig = null;
let opcuaLiveValues = {};

function formatOpcUaValue(value) {
    if (value === null || value === undefined) return '—';
    // Preserve booleans as-is
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    // Try numeric conversion for numeric-like values
    const num = Number(value);
    if (!Number.isNaN(num) && Number.isFinite(num)) {
        // If non-integer, show 2 decimal places; otherwise show integer
        return (num % 1 !== 0) ? num.toFixed(2) : String(num);
    }
    return String(value);
}

function getOpcUaNodeMachineId(node) {
    if (!node) return '';
    if (node.machineId !== undefined && node.machineId !== null && node.machineId !== '') {
        return String(node.machineId);
    }
    const fromName = (node.name || '').match(/^(?:CR|S)([1-5])$/i);
    if (fromName) return fromName[1];
    const fromNodeId = (node.nodeId || '').match(/(?:CR0?([1-5])|SENSOR0?([1-5]))/i);
    if (fromNodeId) return String(fromNodeId[1] || fromNodeId[2] || '');
    return '';
}

function getOpcUaNodeSignalType(node) {
    const current = (node && node.signalType ? String(node.signalType) : '').trim().toUpperCase();
    if (current) return current;

    const name = (node && node.name ? String(node.name) : '').trim().toUpperCase();
    const nodeId = (node && node.nodeId ? String(node.nodeId) : '').trim().toUpperCase();

    if (/^CR[1-5]$/.test(name) || /GR_CR0?[1-5]/.test(nodeId) || /GROSS/.test(nodeId)) return 'GROSS_WEIGHT';
    if (/^S[1-5]$/.test(name) || /SENSOR0?[1-5]/.test(nodeId)) return 'PRODUCT_SENSOR';
    if (/^RST$|^RESET$/.test(name) || /RESET/.test(nodeId)) return 'RESET';
    if (/MD[_\s-]?SWITCH/.test(name) || /MD[_\s-]?SWITCH/.test(nodeId)) return 'MD_SWITCH';
    if (/SYSTEM[_\s-]?PAUSED/.test(name) || /SYSTEM[_\s-]?PAUSED/.test(nodeId)) return 'SYSTEM_PAUSED';
    if (/COUNT/.test(name) || /COUNT/.test(nodeId)) return 'COUNTER';
    if (/TOLERANCE[_\s-]?MIN/.test(name) || /TOLERANCE[_\s-]?MIN/.test(nodeId)) return 'TOLERANCE_MIN';
    if (/TOLERANCE[_\s-]?MAX/.test(name) || /TOLERANCE[_\s-]?MAX/.test(nodeId)) return 'TOLERANCE_MAX';
    if (/DEVIATION[_\s-]?TOLERANCE[_\s-]?MIN/.test(name) || /DEVIATION[_\s-]?TOLERANCE[_\s-]?MIN/.test(nodeId)) return 'DEVIATION_TOLERANCE_MIN';
    return '';
}

function getOpcUaNodeScale(node) {
    const parsed = Number(node && node.scale);
    return Number.isFinite(parsed) ? parsed : 0.01;
}

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
    const machineId = document.getElementById('opcua-new-machine').value;
    const signalType = document.getElementById('opcua-new-signal').value;
    const scale = parseFloat(document.getElementById('opcua-new-scale').value) || 0.01;
    const desc = document.getElementById('opcua-new-desc').value.trim();
    if (!nodeId) { showOpcUaToast('Node ID required', 'error'); return; }

    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/opcua/config/nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-access-token': token },
            body: JSON.stringify({ nodeId, name: name || nodeId, machineId, signalType, scale, description: desc })
        });
        const data = await res.json();
        if (data.success) {
            opcuaConfig.nodes = data.nodes;
            renderOpcUaNodes();
            document.getElementById('opcua-new-nodeid').value = '';
            document.getElementById('opcua-new-name').value = '';
            document.getElementById('opcua-new-desc').value = '';
            showOpcUaToast('Node added', 'success');
        } else {
            showOpcUaToast(data.error || 'Add failed', 'error');
        }
    } catch (e) {
        showOpcUaToast('Add error', 'error');
    }
}

async function removeOpcUaNode(index) {
    const targetNode = opcuaConfig && opcuaConfig.nodes ? opcuaConfig.nodes[index] : null;
    if (!confirm(`Delete monitored node "${targetNode ? targetNode.name : index + 1}"?`)) return;

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
        const machineId = getOpcUaNodeMachineId(node);
        const machineLabel = machineId ? `CR${machineId}` : 'Global';
        const signalType = getOpcUaNodeSignalType(node);
        const scale = getOpcUaNodeScale(node);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td style="font-family: var(--font-digital); font-size: 0.8rem;">${node.nodeId}</td>
            <td style="font-weight: 600">${node.name}</td>
            <td>${machineLabel}</td>
            <td><span style="font-size:0.75rem; background:rgba(99,102,241,0.15); color:#818cf8; padding:2px 6px; border-radius:4px;">${signalType || '—'}</span></td>
            <td style="font-family: var(--font-digital)">${scale}</td>
            <td>${node.description || '—'}</td>
            <td style="font-family: var(--font-digital)" id="opcua-live-${idx}">${liveVal !== undefined ? formatOpcUaValue(liveVal.value) : '—'}</td>
            <td>
                <div class="opc-node-actions">
                    <button class="opc-action-btn edit" title="Edit monitored node" onclick="editOpcUaNode(${idx})">
                        <i class='bx bx-edit-alt'></i> Edit
                    </button>
                    <button class="opc-action-btn delete" title="Delete monitored node" onclick="removeOpcUaNode(${idx})">
                        <i class='bx bx-trash'></i> Delete
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
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
        // Always refresh footer sensors
        updateFooterSensors();
    }
}

function updateOpcUaLiveValue(data) {
    if (!data || !data.name) return;
    opcuaLiveValues[data.name] = data;
    console.log('[OPC-UA] Live Value:', data.name, data.value); // Debug log

    // If it's a sensor update, refresh the footer sensor indicators
    if (/^S[1-5]$/.test(data.name)) {
        updateFooterSensors();
    }

    if (opcuaConfig) {
        const idx = opcuaConfig.nodes.findIndex(n => n.name === data.name);
        if (idx >= 0) {
            const cell = document.getElementById(`opcua-live-${idx}`);
                if (cell) {
                    cell.innerText = formatOpcUaValue(data.value);
                    const isGood = data.statusCode && data.statusCode.toString().startsWith('Good');
                cell.style.color = isGood ? '#28a745' : '#ffc107';

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

// --- Edit Node Logic ---
let currentEditingNodeIndex = null;
function setOpcUaEditSaving(isSaving) {
    const saveBtn = document.getElementById('opcua-edit-save-btn');
    if (!saveBtn) return;
    saveBtn.disabled = !!isSaving;
    saveBtn.innerText = isSaving ? 'Saving...' : 'Save Changes';
}

function editOpcUaNode(index) {
    if (!opcuaConfig || !opcuaConfig.nodes[index]) return;
    currentEditingNodeIndex = index;
    const node = opcuaConfig.nodes[index];
    const machineId = getOpcUaNodeMachineId(node);
    const signalType = getOpcUaNodeSignalType(node);
    const scale = getOpcUaNodeScale(node);

    document.getElementById('opcua-edit-index').value = `#${index + 1}`;
    document.getElementById('opcua-edit-nodeid').value = node.nodeId || '';
    document.getElementById('opcua-edit-name').value = node.name || '';
    document.getElementById('opcua-edit-machine').value = machineId || '';
    document.getElementById('opcua-edit-signal').value = signalType || 'GROSS_WEIGHT';
    document.getElementById('opcua-edit-scale').value = scale;
    document.getElementById('opcua-edit-desc').value = node.description || '';

    document.getElementById('opcua-edit-modal').style.display = 'flex';
    setOpcUaEditSaving(false);
    document.getElementById('opcua-edit-nodeid').focus();
}

function closeOpcUaEditModal() {
    document.getElementById('opcua-edit-modal').style.display = 'none';
    currentEditingNodeIndex = null;
    setOpcUaEditSaving(false);
}

async function saveOpcUaNodeEdit() {
    if (currentEditingNodeIndex === null) return;

    const nodeId = document.getElementById('opcua-edit-nodeid').value.trim();
    const name = document.getElementById('opcua-edit-name').value.trim();
    if (!nodeId) { showOpcUaToast('Node ID required', 'error'); return; }
    if (!name) { showOpcUaToast('Tag name required', 'error'); return; }

    const payload = {
        nodeId,
        name,
        machineId: document.getElementById('opcua-edit-machine').value,
        signalType: document.getElementById('opcua-edit-signal').value,
        scale: parseFloat(document.getElementById('opcua-edit-scale').value) || 0.01,
        description: document.getElementById('opcua-edit-desc').value.trim()
    };

    try {
        setOpcUaEditSaving(true);
        const token = currentUser.accessToken;
        const res = await fetch(`/api/opcua/config/nodes/${currentEditingNodeIndex}/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            body: JSON.stringify(payload)
        });

        const raw = await res.text();
        let data = null;
        try {
            data = raw ? JSON.parse(raw) : null;
        } catch (parseErr) {
            const hint = raw && raw.includes('<!DOCTYPE')
                ? 'Server mengembalikan HTML (kemungkinan proxy/reverse proxy).'
                : 'Server response bukan JSON.';
            throw new Error(`${hint} HTTP ${res.status}`);
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
        showOpcUaToast('Update error: ' + e.message, 'error');
    } finally {
        setOpcUaEditSaving(false);
    }
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
    try {
        const token = currentUser?.accessToken;
        if (!token) {
            console.warn('No token available for SQL status check');
            return;
        }
        
        const res = await fetch('/api/scada/status', {
            headers: { 'x-access-token': token }
        });
        const data = await res.json();
        updateSqlStatusUI(data);
    } catch (e) {
        console.error('SQL status poll failed:', e);
        updateSqlStatusUI({ connected: false });
    }
}

// --- History Logic (server-side pagination) ---
let historyTotalCount = 0;
let historyCurrentPage = 1;
let historyPageSize = 50;
let historyLoading = false;

function getHistoryTotalPages() {
    if (!historyTotalCount) return 1;
    return Math.max(1, Math.ceil(historyTotalCount / historyPageSize));
}

function updateHistorySubtitle() {
    const subtitle = document.getElementById('history-subtitle');
    if (!subtitle) return;
    const pages = getHistoryTotalPages();
    subtitle.textContent = `${historyTotalCount.toLocaleString()} record(s) · ${historyPageSize} per page · ${pages} page(s)`;
}

function updateHistoryPaginationUi() {
    const totalPages = getHistoryTotalPages();
    const pageInfo = document.getElementById('history-page-info');
    const rangeInfo = document.getElementById('history-range-info');
    const prevBtn = document.getElementById('history-prev-btn');
    const nextBtn = document.getElementById('history-next-btn');
    const firstBtn = document.getElementById('history-first-btn');
    const lastBtn = document.getElementById('history-last-btn');

    if (pageInfo) pageInfo.textContent = `Page ${historyCurrentPage} of ${totalPages}`;

    if (rangeInfo) {
        if (!historyTotalCount) {
            rangeInfo.textContent = 'No records';
        } else {
            const start = (historyCurrentPage - 1) * historyPageSize + 1;
            const end = Math.min(historyCurrentPage * historyPageSize, historyTotalCount);
            rangeInfo.textContent = `Rows ${start}–${end} of ${historyTotalCount.toLocaleString()}`;
        }
    }

    const atStart = historyCurrentPage <= 1;
    const atEnd = historyCurrentPage >= totalPages;
    [prevBtn, firstBtn].forEach(btn => { if (btn) btn.disabled = atStart; });
    [nextBtn, lastBtn].forEach(btn => { if (btn) btn.disabled = atEnd; });
}

function formatHistoryTimestamp(timestampValue) {
    if (!timestampValue) return '-';

    const date = new Date(timestampValue);
    if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: 'UTC',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(date).replace(',', '');
    }

    const raw = String(timestampValue).trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return raw;

    const [, year, month, day, hour, minute, second = '00'] = match;
    return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
}

function renderHistoryRow(row) {
    const tr = document.createElement('tr');
    const dateStr = formatHistoryTimestamp(row.TIMESTAMP || row.createdAt);
    const grossWeight = row.GROSS_WEIGHT != null ? parseFloat(row.GROSS_WEIGHT).toFixed(2) : '-';
    const nettWeight = row.NETT_WEIGHT != null ? parseFloat(row.NETT_WEIGHT).toFixed(2) : '-';
    const counterValue = row.PRODUCT_COUNT ?? row.COUNTER ?? '-';

    tr.innerHTML = `
        <td>${dateStr}</td>
        <td>${row.CAROUSEL}</td>
        <td>${row.PRODUCT_NAME} <span style="font-size:0.8em; color:#888;">(${row.PRODUCT_ID})</span></td>
        <td>${row.TARGET_COUNT || '-'}</td>
        <td>${counterValue}</td>
        <td>${grossWeight}</td>
        <td>${nettWeight}</td>
        <td><span class="status-badge status-${(row.STATUS || '').toLowerCase()}">${row.STATUS}</span></td>
    `;
    return tr;
}

function renderHistoryRows(rows) {
    const tbody = document.getElementById('history-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No records found</td></tr>';
        updateHistoryPaginationUi();
        return;
    }

    rows.forEach(row => tbody.appendChild(renderHistoryRow(row)));
    updateHistoryPaginationUi();
}

function historyChangePage(delta) {
    const totalPages = getHistoryTotalPages();
    const next = historyCurrentPage + delta;
    if (next < 1 || next > totalPages || historyLoading) return;
    fetchHistoryPage(next);
}

function historyGoToPage(target) {
    const totalPages = getHistoryTotalPages();
    const page = target === 'last' ? totalPages : Math.max(1, parseInt(target, 10) || 1);
    if (page === historyCurrentPage || historyLoading) return;
    fetchHistoryPage(page);
}

function onHistoryPageSizeChange() {
    const select = document.getElementById('history-page-size');
    historyPageSize = parseInt(select?.value, 10) || 50;
    fetchHistoryPage(1);
}

function onHistoryRefreshChange() {
    if (historyIntervalId) {
        clearInterval(historyIntervalId);
        historyIntervalId = null;
    }

    if (currentView === 'history') {
        const select = document.getElementById('history-refresh-interval');
        const seconds = select ? parseInt(select.value, 10) : 30; // default/fallback 30s

        if (seconds > 0) {
            historyIntervalId = setInterval(() => {
                if (currentView === 'history' && !historyLoading) {
                    fetchHistoryPage(historyCurrentPage);
                }
            }, seconds * 1000);
        }
    }
}

async function fetchHistoryPage(page) {
    const tbody = document.getElementById('history-list-body');
    const carouselFilterEl = document.getElementById('history-carousel-filter');
    if (historyLoading) return;
    historyLoading = true;

    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Loading records...</td></tr>';
    }

    try {
        const token = currentUser.accessToken;
        const params = new URLSearchParams({
            page: String(page),
            pageSize: String(historyPageSize)
        });
        const selectedCarousel = carouselFilterEl ? carouselFilterEl.value : '';
        if (selectedCarousel) {
            params.set('carousel', selectedCarousel);
        }

        const res = await fetch(`/api/scada/history?${params.toString()}`, {
            headers: { 'x-access-token': token }
        });

        if (res.ok) {
            const data = await res.json();
            historyTotalCount = data.total || 0;
            historyCurrentPage = data.page || page;
            historyPageSize = data.pageSize || historyPageSize;
            updateHistorySubtitle();
            renderHistoryRows(data.records || []);
            const wrap = document.querySelector('.history-table-wrap');
            if (wrap) wrap.scrollTop = 0;
        } else if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Failed to load history</td></tr>';
            updateHistoryPaginationUi();
        }
    } catch (e) {
        console.error('History Error', e);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Network Error</td></tr>';
        }
        updateHistoryPaginationUi();
    } finally {
        historyLoading = false;
    }
}

function loadHistory() {
    historyTotalCount = 0;
    historyCurrentPage = 1;
    fetchHistoryPage(1);
}

// ==========================================================
// System Log View Functions
// ==========================================================

let allLogEntries = [];

async function loadLogs() {
    const container = document.getElementById('log-container');
    if (!container) return;
    container.innerHTML = '<div class="log-entry log-level-info"><span class="log-msg">Loading logs...</span></div>';

    try {
        const token = localStorage.getItem('scada_token') || (currentUser && currentUser.accessToken);
        const res = await fetch('/api/logs', {
            headers: { 'x-access-token': token }
        });
        const data = await res.json();
        allLogEntries = data || [];
        renderLogEntries();
    } catch (e) {
        container.innerHTML = '<div class="log-entry log-level-error"><span class="log-msg">Failed to load logs</span></div>';
    }
}

function appendLogEntry(entry) {
    if (!entry) return;
    allLogEntries.push(entry);
    // Keep max 500 in frontend buffer
    if (allLogEntries.length > 500) allLogEntries.shift();

    // Check if filters match
    const levelFilter = document.getElementById('log-level-filter')?.value || '';
    const sourceFilter = document.getElementById('log-source-filter')?.value || '';
    if (levelFilter && entry.level !== levelFilter) return;
    if (sourceFilter && entry.source !== sourceFilter) return;

    const container = document.getElementById('log-container');
    if (!container) return;

    // Remove placeholder
    const placeholder = container.querySelector('.log-msg');
    if (placeholder && placeholder.innerText === 'Waiting for log entries...') {
        container.innerHTML = '';
    }

    const div = createLogEntryElement(entry);
    container.appendChild(div);

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function createLogEntryElement(entry) {
    const div = document.createElement('div');
    const levelClass = `log-level-${(entry.level || 'info').toLowerCase()}`;
    div.className = `log-entry ${levelClass}`;

    const ts = new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = new Date(entry.timestamp).toLocaleDateString('en-GB');

    div.innerHTML = `
        <span class="log-ts">${date} ${ts}</span>
        <span class="log-badge log-badge-${(entry.level || 'info').toLowerCase()}">${entry.level || 'INFO'}</span>
        <span class="log-src">${entry.source || 'SYSTEM'}</span>
        <span class="log-msg">${escapeHtml(entry.message || '')}</span>
    `;
    return div;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function filterLogs() {
    renderLogEntries();
}

function renderLogEntries() {
    const container = document.getElementById('log-container');
    if (!container) return;

    const levelFilter = document.getElementById('log-level-filter')?.value || '';
    const sourceFilter = document.getElementById('log-source-filter')?.value || '';

    let filtered = allLogEntries;
    if (levelFilter) filtered = filtered.filter(e => e.level === levelFilter);
    if (sourceFilter) filtered = filtered.filter(e => e.source === sourceFilter);

    container.innerHTML = '';
    if (filtered.length === 0) {
        container.innerHTML = '<div class="log-entry log-level-info"><span class="log-msg">No log entries found</span></div>';
        return;
    }

    filtered.forEach(entry => {
        container.appendChild(createLogEntryElement(entry));
    });

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function clearLogView() {
    const container = document.getElementById('log-container');
    if (container) {
        container.innerHTML = '<div class="log-entry log-level-info"><span class="log-msg">Log view cleared</span></div>';
    }
    allLogEntries = [];
}
