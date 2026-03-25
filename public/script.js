
const STORAGE_KEY = 'ipt_demo_v1';
const API_BASE = 'http://localhost:3000/api';
let currentUser = null;

// In-memory store for CRUD data
window.db = {
    accounts: [],    // Now stores: { id (email), firstName, lastName, email, role, verified }
    departments: [],
    employees: [],
    requests: []
};

// ─── TOKEN HELPERS (FROM SCRIPT.JS + APP.JS - NO DUPLICATES) ───────────────────

function saveToken(token) {
    sessionStorage.setItem('authToken', token);
}

function getToken() {
    return sessionStorage.getItem('authToken');
}

function clearToken() {
    sessionStorage.removeItem('authToken');
}

function getAuthHeader() {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ─── LOCAL STORAGE ───────────────────────────────────────────

function loadFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            window.db.departments = parsed.departments || [];
            window.db.employees = parsed.employees || [];
            window.db.requests = parsed.requests || [];
            window.db.accounts = parsed.accounts || [];
        }
    } catch (error) {
        console.error('Error loading from storage:', error);
    }
}

function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db));
    } catch (error) {
        console.error('Error saving to storage:', error);
        showToast('Error saving data', 'danger');
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ─── AUTH STATE ───────────────────────────────────────────

function setAuthState(isAuth, user = null) {
    currentUser = user;

    if (isAuth && user) {
        document.body.classList.remove('not-authenticated');
        document.body.classList.add('authenticated');

        if (user.role === 'admin') {
            document.body.classList.add('is-admin');
        } else {
            document.body.classList.remove('is-admin');
        }

        // FIXED: Now using firstName and lastName from localStorage
        const usernameEl = document.getElementById('navbar-username');
        if (usernameEl) {
            usernameEl.textContent = `${user.firstName} ${user.lastName}`;
        }
    } else {
        document.body.classList.remove('authenticated');
        document.body.classList.add('not-authenticated');
        document.body.classList.remove('is-admin');
    }
}

// FIXED: Check auth - now retrieves firstName/lastName from localStorage
function checkAuth() {
    const token = getToken();
    if (!token) {
        setAuthState(false);
        return false;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));

        // Check expiration
        if (payload.exp && Date.now() / 1000 > payload.exp) {
            clearToken();
            setAuthState(false);
            showToast('Session expired. Please log in again.', 'warning');
            return false;
        }

        // FIXED: Get full user data from localStorage instead of JWT
        // JWT only has: id, username, role
        // We need: firstName, lastName from localStorage
        const localAccount = window.db.accounts.find(acc => acc.email === payload.username);

        const user = {
            id: payload.id,
            username: payload.username,
            email: payload.username,
            firstName: localAccount ? localAccount.firstName : payload.username.split('@')[0],  // Fallback to email prefix
            lastName: localAccount ? localAccount.lastName : '',  // Fallback to empty
            role: payload.role === 'admin' ? 'admin' : 'user'
        };

        setAuthState(true, user);
        return true;

    } catch (e) {
        console.error('Auth check error:', e);
        clearToken();
        setAuthState(false);
        return false;
    }
}

function logout() {
    clearToken();
    setAuthState(false);
    showToast('Logged out successfully', 'success');
    navigateTo('#/');
}

// ─── ROUTING ────────────────────────────────────────────

function navigateTo(hash) {
    window.location.hash = hash;
}

function handleRouting() {
    const hash = window.location.hash || '#/';
    const route = hash.substring(2);

    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    const isAuthenticated = checkAuth();

    const protectedRoutes = ['profile', 'requests'];
    const adminRoutes = ['employees', 'departments', 'accounts'];

    if (protectedRoutes.includes(route) && !isAuthenticated) {
        showToast('Please login to access this page', 'warning');
        navigateTo('#/login');
        return;
    }

    if (adminRoutes.includes(route)) {
        if (!isAuthenticated) {
            showToast('Please login to access this page', 'warning');
            navigateTo('#/login');
            return;
        }
        if (currentUser.role !== 'admin') {
            showToast('Admin access required', 'danger');
            navigateTo('#/');
            return;
        }
    }

    let pageId = route ? route + '-page' : 'home-page';
    const pageElement = document.getElementById(pageId);

    if (pageElement) {
        pageElement.classList.add('active');

        switch (route) {
            case 'profile':
                renderProfile();
                break;
            case 'employees':
                renderEmployees();
                break;
            case 'departments':
                renderDepartments();
                break;
            case 'accounts':
                renderAccounts();
                break;
            case 'requests':
                renderRequests();
                break;
        }
    } else {
        document.getElementById('home-page').classList.add('active');
    }
}

// ─── REGISTRATION ────────────────────────────────────────────

async function handleRegistration(e) {
    e.preventDefault();

    const firstName = document.getElementById('reg-firstname').value.trim();
    const lastName = document.getElementById('reg-lastname').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const password = document.getElementById('reg-password').value;

    try {
        // Send to backend (server.js expects username, not firstName/lastName)
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: email,  // server.js expects 'username' field
                password,
                role: 'user'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.message || 'Registration failed', 'danger');
            return;
        }

        // FIXED: Save firstName and lastName to localStorage
        // Server doesn't store these, so we handle it on frontend
        const localAccount = {
            id: email,  // Use email as unique ID
            firstName: firstName,
            lastName: lastName,
            email: email,
            role: 'user',
            verified: true
        };
        window.db.accounts.push(localAccount);
        saveToStorage();

        // For verify email simulation
        localStorage.setItem('unverified_email', email);

        showToast('Registration successful! You can now login.', 'success');
        navigateTo('#/login');

    } catch (error) {
        console.error('Registration error:', error);
        showToast('Network error. Make sure the server is running.', 'danger');
    }
}

// ─── EMAIL VERIFICATION ────────────────────────────────────────────

function handleEmailVerification() {
    const email = localStorage.getItem('unverified_email');

    if (email) {
        document.getElementById('verify-email-display').textContent = email;
    }

    const verifyBtn = document.getElementById('simulate-verify-btn');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', function () {
            const email = localStorage.getItem('unverified_email');
            const account = window.db.accounts.find(acc => acc.email === email);

            if (account) {
                account.verified = true;
                saveToStorage();
                localStorage.removeItem('unverified_email');
                showToast('Email verified! You can now login.', 'success');

                navigateTo('#/login');
                setTimeout(() => {
                    const successMsg = document.getElementById('login-success-msg');
                    if (successMsg) {
                        successMsg.style.display = 'block';
                    }
                }, 100);
            }
        });
    }
}

// ─── LOGIN ────────────────────────────────────────────

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    try {
        // Send to backend
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.message || 'Invalid credentials', 'danger');
            return;
        }

        // Save JWT token from backend
        saveToken(data.token);

        // Decode token and set auth state
        // This will also fetch firstName/lastName from localStorage
        checkAuth();

        showToast('Login successful!', 'success');
        navigateTo('#/profile');

    } catch (error) {
        console.error('Login error:', error);
        showToast('Network error. Make sure the server is running.', 'danger');
    }
}

// ─── PROFILE PAGE ────────────────────────────────────────────

function renderProfile() {
    if (!currentUser) return;

    const profileContent = document.getElementById('profile-content');
    profileContent.innerHTML = `
        <p><strong>Name:</strong> ${currentUser.firstName} ${currentUser.lastName}</p>
        <p><strong>Email:</strong> ${currentUser.email}</p>
        <p><strong>Role:</strong> <span class="badge bg-${currentUser.role === 'admin' ? 'danger' : 'primary'}">${currentUser.role}</span></p>
        <button class="btn btn-outline-primary mt-3" onclick="openEditProfileModal()">Edit Profile</button>
    `;
}

// ─── EDIT PROFILE ────────────────────────────────────────────

function openEditProfileModal() {
    if (!currentUser) return;

    document.getElementById('edit-profile-firstname').value = currentUser.firstName;
    document.getElementById('edit-profile-lastname').value = currentUser.lastName;
    document.getElementById('edit-profile-email').value = currentUser.email;
    document.getElementById('edit-profile-password').value = '';

    const modal = new bootstrap.Modal(document.getElementById('editProfileModal'));
    modal.show();
}

function handleEditProfileForm(e) {
    e.preventDefault();

    const firstName = document.getElementById('edit-profile-firstname').value.trim();
    const lastName = document.getElementById('edit-profile-lastname').value.trim();

    // FIXED: Update localStorage account (server.js has no PUT endpoint)
    const account = window.db.accounts.find(acc => acc.email === currentUser.email);
    if (!account) {
        showToast('Account not found', 'danger');
        return;
    }

    // Update localStorage
    account.firstName = firstName;
    account.lastName = lastName;
    saveToStorage();

    // Update currentUser in memory
    currentUser.firstName = firstName;
    currentUser.lastName = lastName;
    setAuthState(true, currentUser);

    // Re-render profile
    renderProfile();

    showToast('Profile updated successfully!', 'success');

    const modal = bootstrap.Modal.getInstance(document.getElementById('editProfileModal'));
    modal.hide();
}

// ─── EMPLOYEES ────────────────────────────────────────────

function renderEmployees() {
    const tbody = document.getElementById('employees-table-body');

    if (window.db.employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No employees yet.</td></tr>';
        return;
    }

    tbody.innerHTML = window.db.employees.map(emp => {
        // FIXED: Use email as the unique identifier
        const account = window.db.accounts.find(acc => acc.id === emp.userEmail);
        const dept = window.db.departments.find(d => d.id === emp.departmentId);
        const userName = account ? `${account.firstName} ${account.lastName}` : emp.userEmail;

        return `
            <tr>
                <td>${emp.employeeId}</td>
                <td>${userName}</td>
                <td>${emp.position}</td>
                <td>${dept ? dept.name : 'N/A'}</td>
                <td class="action-buttons">
                    <button class="btn btn-sm btn-outline-primary" onclick="editEmployee('${emp.id}')">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteEmployee('${emp.id}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function editEmployee(id) {
    const emp = window.db.employees.find(e => e.id === id);
    if (!emp) return;
    document.getElementById('employee-id').value = emp.employeeId;
    document.getElementById('employee-email').value = emp.userEmail;
    document.getElementById('employee-position').value = emp.position;
    document.getElementById('employee-department').value = emp.departmentId;
    document.getElementById('employee-hire-date').value = emp.hireDate;
    document.getElementById('employee-edit-id').value = id;
    const modal = new bootstrap.Modal(document.getElementById('addEmployeeModal'));
    modal.show();
}

function deleteEmployee(id) {
    if (confirm('Delete this employee?')) {
        window.db.employees = window.db.employees.filter(e => e.id !== id);
        saveToStorage();
        renderEmployees();
        showToast('Employee deleted', 'success');
    }
}

// ─── DEPARTMENTS ────────────────────────────────────────────

function renderDepartments() {
    const tbody = document.getElementById('departments-table-body');
    if (window.db.departments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No departments yet.</td></tr>';
        return;
    }
    tbody.innerHTML = window.db.departments.map(dept => `
        <tr>
            <td>${dept.name}</td>
            <td>${dept.description}</td>
            <td class="action-buttons">
                <button class="btn btn-sm btn-outline-primary" onclick="editDepartment('${dept.id}')">Edit</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteDepartment('${dept.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function editDepartment(id) {
    const dept = window.db.departments.find(d => d.id === id);
    if (!dept) return;
    document.getElementById('department-name').value = dept.name;
    document.getElementById('department-description').value = dept.description;
    document.getElementById('department-edit-id').value = id;
    const modal = new bootstrap.Modal(document.getElementById('addDepartmentModal'));
    modal.show();
}

function deleteDepartment(id) {
    if (confirm('Delete this department?')) {
        window.db.departments = window.db.departments.filter(d => d.id !== id);
        saveToStorage();
        renderDepartments();
        showToast('Department deleted', 'success');
    }
}

// ─── ACCOUNTS ────────────────────────────────────────────

function renderAccounts() {
    const tbody = document.getElementById('accounts-table-body');
    if (window.db.accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No accounts yet.</td></tr>';
        return;
    }
    tbody.innerHTML = window.db.accounts.map(acc => `
        <tr>
            <td>${acc.email}</td>
            <td>${acc.firstName}</td>
            <td>${acc.lastName}</td>
            <td><span class="badge bg-${acc.role === 'admin' ? 'danger' : 'primary'}">${acc.role}</span></td>
            <td><span class="badge ${acc.verified ? 'bg-success' : 'bg-warning'}">${acc.verified ? 'Verified' : 'Pending'}</span></td>
            <td class="action-buttons">
                <button class="btn btn-sm btn-outline-primary" onclick="editAccount('${acc.id}')">Edit</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteAccount('${acc.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function editAccount(id) {
    const acc = window.db.accounts.find(a => a.id === id);
    if (!acc) return;
    document.getElementById('account-firstname').value = acc.firstName;
    document.getElementById('account-lastname').value = acc.lastName;
    document.getElementById('account-email').value = acc.email;
    document.getElementById('account-role').value = acc.role === 'admin' ? 'Admin' : 'User';
    document.getElementById('account-verified').checked = acc.verified;
    document.getElementById('account-edit-id').value = id;
    const modal = new bootstrap.Modal(document.getElementById('addAccountModal'));
    modal.show();
}

function deleteAccount(id) {
    if (confirm('Delete this account?')) {
        window.db.accounts = window.db.accounts.filter(a => a.id !== id);
        saveToStorage();
        renderAccounts();
        showToast('Account deleted', 'success');
    }
}

function resetPassword(id) {
    showToast('Reset password feature would send email', 'info');
}

// ─── REQUESTS ────────────────────────────────────────────

function renderRequests() {
    const container = document.getElementById('requests-content'); // ✅ correct ID
    if (window.db.requests.length === 0) {
        container.innerHTML = '<p class="text-muted text-center mt-4">No requests yet.</p>';
        return;
    }

    container.innerHTML = `
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>ID</th><th>Type</th><th>Status</th><th>Date</th><th>Items</th><th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${window.db.requests.map(req => `
                    <tr>
                        <td>${req.id}</td>
                        <td>${req.type}</td>
                        <td><span class="badge status-${req.status.toLowerCase()}">${req.status}</span></td>
                        <td>${new Date(req.createdAt).toLocaleDateString()}</td>
                        <td>${req.items.map(i => `${i.name} (${i.qty})`).join(', ')}</td>
                        <td><button class="btn btn-sm btn-outline-primary" onclick="showRequest('${req.id}')">View</button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function showRequest(id) {
    const req = window.db.requests.find(r => r.id === id);
    if (!req) return;
    showToast(`Request ${req.id} - Status: ${req.status}`, 'info');
}

// ─── FORM HANDLERS ────────────────────────────────────────────

function handleEmployeeForm(e) {
    e.preventDefault();

    const employeeId = document.getElementById('employee-id').value.trim();
    const userEmail = document.getElementById('employee-email').value.trim().toLowerCase();
    const position = document.getElementById('employee-position').value.trim();
    const departmentValue = document.getElementById('employee-department').value;
    const hireDate = document.getElementById('employee-hire-date').value;
    const editId = document.getElementById('employee-edit-id').value;

    if (!employeeId || !userEmail || !position || !departmentValue || !hireDate) {
        showToast('Please fill in all fields', 'danger');
        return;
    }

    if (editId) {
        const emp = window.db.employees.find(e => e.id === editId);
        if (emp) {
            emp.employeeId = employeeId;
            emp.userEmail = userEmail;
            emp.position = position;
            emp.departmentId = departmentValue;
            emp.hireDate = hireDate;
        }
    } else {
        window.db.employees.push({
            id: generateId(),
            employeeId,
            userEmail,
            position,
            departmentId: departmentValue,
            hireDate
        });
    }

    saveToStorage();
    renderEmployees();

    const modal = bootstrap.Modal.getInstance(document.getElementById('addEmployeeModal'));
    modal.hide();
    showToast('Employee saved successfully!', 'success');
}

function handleDepartmentForm(e) {
    e.preventDefault();
    const editId = document.getElementById('department-edit-id').value;
    const name = document.getElementById('department-name').value;
    const description = document.getElementById('department-description').value;

    if (editId) {
        const dept = window.db.departments.find(d => d.id === editId);
        if (dept) {
            dept.name = name;
            dept.description = description;
        }
    } else {
        window.db.departments.push({
            id: generateId(),
            name,
            description
        });
    }

    saveToStorage();
    renderDepartments();
    const modal = bootstrap.Modal.getInstance(document.getElementById('addDepartmentModal'));
    modal.hide();
    showToast('Department saved', 'success');
}

function handleAccountForm(e) {
    e.preventDefault();

    const firstName = document.getElementById('account-firstname').value.trim();
    const lastName = document.getElementById('account-lastname').value.trim();
    const email = document.getElementById('account-email').value.trim().toLowerCase();
    const password = document.getElementById('account-password').value;
    const role = document.getElementById('account-role').value.toLowerCase(); // 'admin' or 'user'
    const verified = document.getElementById('account-verified').checked;
    const editId = document.getElementById('account-edit-id').value;

    if (editId) {
        const acc = window.db.accounts.find(a => a.id === editId);
        if (acc) {
            acc.firstName = firstName;
            acc.lastName = lastName;
            acc.email = email;
            acc.role = role;
            acc.verified = verified;
        }
    } else {
        if (!password || password.length < 6) {
            showToast('Password must be at least 6 characters', 'danger');
            return;
        }
        window.db.accounts.push({
            id: email,
            firstName,
            lastName,
            email,
            role,
            verified
        });
    }

    saveToStorage();
    renderAccounts();

    const modal = bootstrap.Modal.getInstance(document.getElementById('addAccountModal'));
    modal.hide();
    showToast('Account saved successfully!', 'success');
}

function handleRequestForm(e) {
    e.preventDefault();
    if (!currentUser) return;

    const type = document.getElementById('request-type').value;
    const itemRows = document.querySelectorAll('.request-item-row');
    const items = [];

    itemRows.forEach(row => {
        const name = row.querySelector('.item-name').value.trim();
        const qty = parseInt(row.querySelector('.item-qty').value);
        if (name) items.push({ name, qty });
    });

    if (items.length === 0) {
        showToast('Please add at least one item', 'danger');
        return;
    }

    window.db.requests.push({
        id: generateId(),
        type,
        status: 'Pending',
        createdAt: new Date().toISOString(),
        userEmail: currentUser.email,
        items
    });

    saveToStorage();
    renderRequests();

    const modal = bootstrap.Modal.getInstance(document.getElementById('addRequestModal'));
    modal.hide();
    showToast('Request submitted!', 'success');
}

function addRequestItem() {
    const container = document.getElementById('request-items-container');
    const newItem = document.createElement('div');
    newItem.className = 'input-group mb-2 request-item-row';
    newItem.innerHTML = `
        <input type="text" class="form-control item-name" placeholder="Item name" required>
        <input type="number" class="form-control item-qty" placeholder="Qty" min="1" value="1" style="max-width: 80px;" required>
        <button type="button" class="btn btn-danger remove-item-btn" onclick="removeRequestItem(this)">×</button>
    `;
    container.appendChild(newItem);
}

function removeRequestItem(btn) {
    btn.parentElement.remove();
}

// ─── TOAST NOTIFICATIONS ────────────────────────────────────────────

function showToast(message, type = 'info') {
    const toastHtml = `
        <div class="toast align-items-center text-white bg-${type}" role="alert">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    const container = document.getElementById('toast-container');
    container.insertAdjacentHTML('beforeend', toastHtml);

    const toastElement = container.lastElementChild;
    const toast = new bootstrap.Toast(toastElement);
    toast.show();

    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// ─── MODAL RESET (FIXED: Only add listeners once) ────────────────────────────────────────────

let modalsInitialized = false;

function resetModals() {
    if (modalsInitialized) return; // FIXED: Prevent duplicate listeners

    document.getElementById('addEmployeeModal')?.addEventListener('hidden.bs.modal', function () {
        document.getElementById('employee-form').reset();
        document.getElementById('employee-edit-id').value = '';
    });

    document.getElementById('addDepartmentModal')?.addEventListener('hidden.bs.modal', function () {
        document.getElementById('department-form').reset();
        document.getElementById('department-edit-id').value = '';
    });

    document.getElementById('addAccountModal')?.addEventListener('hidden.bs.modal', function () {
        document.getElementById('account-form').reset();
        document.getElementById('account-edit-id').value = '';
    });

    document.getElementById('addRequestModal')?.addEventListener('hidden.bs.modal', function () {
        document.getElementById('request-form').reset();
        const container = document.getElementById('request-items-container');
        container.innerHTML = `
            <div class="input-group mb-2 request-item-row">
                <input type="text" class="form-control item-name" placeholder="Item name" required>
                <input type="number" class="form-control item-qty" placeholder="Qty" min="1" value="1" style="max-width: 80px;" required>
                <button type="button" class="btn btn-danger remove-item-btn" style="display: none;">×</button>
            </div>
        `;
    });

    document.getElementById('editProfileModal')?.addEventListener('hidden.bs.modal', function () {
        document.getElementById('edit-profile-form').reset();
    });

    modalsInitialized = true;
}

// ─── INITIALIZATION ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    loadFromStorage();

    window.addEventListener('hashchange', handleRouting);

    if (!window.location.hash) {
        window.location.hash = '#/';
    }
    handleRouting();

    // Form listeners
    document.getElementById('register-form')?.addEventListener('submit', handleRegistration);
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('employee-form')?.addEventListener('submit', handleEmployeeForm);
    document.getElementById('department-form')?.addEventListener('submit', handleDepartmentForm);
    document.getElementById('account-form')?.addEventListener('submit', handleAccountForm);
    document.getElementById('request-form')?.addEventListener('submit', handleRequestForm);
    document.getElementById('edit-profile-form')?.addEventListener('submit', handleEditProfileForm);

    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', function (e) {
        e.preventDefault();
        logout();
    });

    // Add item button
    document.getElementById('add-item-btn')?.addEventListener('click', addRequestItem);

    // Verify email
    handleEmailVerification();

    // Modal reset
    resetModals();
});

// ─── GLOBAL EXPORTS ────────────────────────────────────────────

window.navigateTo = navigateTo;
window.editEmployee = editEmployee;
window.deleteEmployee = deleteEmployee;
window.editDepartment = editDepartment;
window.deleteDepartment = deleteDepartment;
window.editAccount = editAccount;
window.resetPassword = resetPassword;
window.deleteAccount = deleteAccount;
window.removeRequestItem = removeRequestItem;
window.openEditProfileModal = openEditProfileModal;
window.showRequest = showRequest;