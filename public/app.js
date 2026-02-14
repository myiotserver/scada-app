const API_URL = '/api';
let currentUser = null;
let socket = null; // Initialize only after login

// Check if already logged in
const storedUser = localStorage.getItem('user');
if (storedUser) {
    currentUser = JSON.parse(storedUser);
    setupApp();
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
}

// Load theme preference
if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-mode');
}

function setupApp() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('main-container').style.display = 'block';

    document.getElementById('login-view').classList.remove('active');
    document.getElementById('navbar').style.display = 'flex';
    document.getElementById('user-display').innerText = `Hello, ${currentUser.username}`;

    console.log("Roles:", currentUser.roles); // Debug

    // Show Admin link if role is admin OR username is 'admin' (fallback)
    if ((currentUser.roles && currentUser.roles.includes('ROLE_ADMIN')) || currentUser.username === 'admin') {
        document.getElementById('admin-link').style.display = 'inline-block';
    }

    showView('dashboard');
    connectSocket();
}

function showView(viewName) {
    // Hide all
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    // Show target
    document.getElementById(`${viewName}-view`).classList.add('active');

    // Update Navbar Active State
    document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
    // Find link calling this view (heuristic match or ID based)
    if (viewName === 'dashboard') document.querySelector('nav a[onclick*="dashboard"]').classList.add('active');
    if (viewName === 'admin') document.querySelector('nav a[onclick*="admin"]').classList.add('active');

    if (viewName === 'admin') {
        loadUsers();
    }
}

async function login() {
    const username = document.getElementById('login-username').value;
    constpassword = document.getElementById('login-password').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_URL}/auth/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok) {
            currentUser = data;
            localStorage.setItem('user', JSON.stringify(data));
            setupApp();
        } else {
            document.getElementById('login-error').innerText = data.message || 'Login failed';
        }
    } catch (err) {
        document.getElementById('login-error').innerText = 'Network error';
    }
}

function logout() {
    localStorage.removeItem('user');
    location.reload();
}

function connectSocket() {
    if (socket) return;
    socket = io();

    socket.on('scada-update', (data) => {
        // Only update if dashboard is active or we want background updates
        if (document.getElementById('pressure')) {
            const pressureEl = document.getElementById('pressure');
            const tempEl = document.getElementById('temperature');
            const flowEl = document.getElementById('flow');

            pressureEl.innerText = data.pressure;
            tempEl.innerText = data.temperature;
            flowEl.innerText = data.flowRate;

            // Status Logic
            const statusEl = document.getElementById('status');
            const statusLight = document.getElementById('status-light');
            const statusCard = document.getElementById('card-status');

            statusEl.innerText = data.status;

            if (data.status === 'WARNING') {
                statusEl.style.color = 'var(--danger)';
                statusLight.className = 'status-indicator off';
                statusCard.classList.add('alarm');
            } else {
                statusEl.style.color = 'var(--success)';
                statusLight.className = 'status-indicator on';
                statusCard.classList.remove('alarm');
            }

            // Pressure Alarm Logic
            const pressureCard = document.getElementById('card-pressure');
            if (parseFloat(data.pressure) > 28) {
                pressureCard.classList.add('alarm');
            } else {
                pressureCard.classList.remove('alarm');
            }
        }
    });
}

// Admin Functions
async function loadUsers() {
    if (!currentUser || !currentUser.accessToken) return;

    try {
        const res = await fetch(`${API_URL}/users`, {
            headers: { 'x-access-token': currentUser.accessToken }
        });
        const users = await res.json();

        const tbody = document.querySelector('#users-table tbody');
        tbody.innerHTML = '';

        users.forEach(user => {
            const tr = document.createElement('tr');
            const roles = user.roles.map(r => r.name).join(', ');
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${roles}</td>
                <td>
                    <button class="warning" onclick="editUser(${user.id}, '${user.username}', '${user.email}', '${roles}')" style="margin-right: 10px;">Edit</button>
                    <button class="danger" onclick="deleteUser(${user.id})">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Failed to load users', err);
    }
}

// Edit User
function editUser(id, username, email, rolesString) {
    document.getElementById('user-id').value = id;
    document.getElementById('user-username').value = username;
    document.getElementById('user-email').value = email;
    document.getElementById('user-password').value = ''; // Don't show password

    // Set role select
    const roleSelect = document.getElementById('user-role');
    if (rolesString.includes('admin')) roleSelect.value = 'admin';
    else if (rolesString.includes('moderator')) roleSelect.value = 'moderator';
    else roleSelect.value = 'user';

    document.getElementById('save-btn').innerText = 'UPDATE USER';
}

function resetForm() {
    document.getElementById('user-id').value = '';
    document.getElementById('user-username').value = '';
    document.getElementById('user-email').value = '';
    document.getElementById('user-password').value = '';
    document.getElementById('user-role').value = 'user';
    document.getElementById('save-btn').innerText = 'GRANT ACCESS';
}

async function saveUser() {
    const id = document.getElementById('user-id').value;
    const username = document.getElementById('user-username').value;
    const email = document.getElementById('user-email').value;
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;

    const payload = { username, email, roles: [role] };
    if (password) payload.password = password;

    try {
        let url = `${API_URL}/users`;
        let method = 'POST';

        if (id) {
            url = `${API_URL}/users/${id}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': currentUser.accessToken
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            alert(data.message || 'Success!');
            loadUsers();
            resetForm();
        } else {
            alert(data.message || 'Operation failed');
        }
    } catch (err) {
        alert('Error saving user');
        console.error(err);
    }
}

async function deleteUser(id) {
    if (!confirm('Are you sure?')) return;

    try {
        const res = await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: { 'x-access-token': currentUser.accessToken }
        });

        if (res.ok) {
            loadUsers();
        } else {
            alert('Failed to delete');
        }
    } catch (err) {
        alert('Error deleting user');
    }
}
