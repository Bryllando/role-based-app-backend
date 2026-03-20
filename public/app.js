// app.js — Frontend API functions that talk to the Express backend (server.js)
// The backend runs on http://localhost:3000

const API_BASE = 'http://localhost:3000/api';


// TOKEN HELPERS


// Save the JWT token after a successful login
function saveToken(token) {
    sessionStorage.setItem('authToken', token);
}

// Get the saved token (returns null if not logged in)
function getToken() {
    return sessionStorage.getItem('authToken');
}

// Remove the token — used when logging out
function clearToken() {
    sessionStorage.removeItem('authToken');
}

// Build the Authorization header using the saved token
// This is attached to every request that needs login
function getAuthHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}


// AUTH: REGISTER


// Send a new user's info to the backend to create an account
async function register(username, password, role = 'user') {
    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, role })
        });

        const data = await response.json();

        if (response.ok) {
            // Registration worked — show a success message
            alert(`Registered successfully! Username: ${data.username}, Role: ${data.role}`);
        } else {
            // Something went wrong (e.g. username taken)
            alert('Registration failed: ' + data.message);
        }

    } catch (error) {
        // Could not reach the server at all
        alert('Network error. Make sure the server is running.');
    }
}



// AUTH: LOGIN


// Send username + password to the backend and get back a JWT token
async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Login worked — save the token so we can use it later
            saveToken(data.token);
            alert(`Welcome! Logged in successfully.`);
            // Optionally load the dashboard after login
            loadAdminDashboard();
        } else {
            // Wrong username or password
            alert('Login failed: ' + data.message);
        }

    } catch (error) {
        // Could not reach the server at all
        alert('Network error. Make sure the server is running.');
    }
}



// AUTH: LOGOUT


// Clear the saved token — the user is now logged out
function logout() {
    clearToken();
    alert('You have been logged out.');
    // Hide the dashboard and show the login section again (update UI as needed)
    document.getElementById('content').innerText = '';
}



// PROTECTED ROUTE: USER PROFILE

// Get the logged-in user's profile from the backend
// This route requires a valid JWT token
async function loadProfile() {
    try {
        const response = await fetch(`${API_BASE}/profile`, {
            headers: {
                ...getAuthHeader()       // Attach the token here
            }
        });

        const data = await response.json();

        if (response.ok) {
            // Show the user info on the page
            document.getElementById('content').innerText =
                `Username: ${data.user.username} | Role: ${data.user.role}`;
        } else {
            // Token missing or expired
            document.getElementById('content').innerText = 'Access denied. Please log in again.';
        }

    } catch (error) {
        document.getElementById('content').innerText = 'Network error. Make sure the server is running.';
    }
}



// PROTECTED ROUTE: ADMIN DASHBOARD

// Load the admin dashboard — only works if logged in as an admin
// Normal users will get a 403 "Access denied" response
async function loadAdminDashboard() {
    try {
        const response = await fetch(`${API_BASE}/admin/dashboard`, {
            headers: {
                ...getAuthHeader()       // Attach the token so the server knows who we are
            }
        });

        const data = await response.json();

        if (response.ok) {
            // Admin access granted — show the dashboard message
            document.getElementById('content').innerText = data.message;
        } else {
            // Either not logged in or not an admin
            document.getElementById('content').innerText = 'Access denied: ' + (data.error || data.message);
        }

    } catch (error) {
        document.getElementById('content').innerText = 'Network error. Make sure the server is running.';
    }
}



// PUBLIC ROUTE: GUEST CONTENT


// Anyone can call this — no login needed
async function loadGuestContent() {
    try {
        const response = await fetch(`${API_BASE}/content/guest`);
        const data = await response.json();

        // Show the public message on the page
        document.getElementById('content').innerText = data.message;

    } catch (error) {
        document.getElementById('content').innerText = 'Network error. Make sure the server is running.';
    }
}