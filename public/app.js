async function login(username, password) {
    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (response.ok) {
            sessionStorage.setItem('authToken', data.token);
            showDashboard(data.user);
        } else {
            alert('Login failed:' + data.error);
        }

    } catch (error) {
        alert('Network error');
    }
}

function getAuthHeader() {
    const token = sessionStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

//Fetch admin data
async function loadAdminDashboard() {
    const data = await fetch('http://localhost:3000/api/admin/dashboard', {
        headers: getAuthHeader()
    });
    if (res.ok) {
        const result = await data.json();
        document.getElementById('content').innerContent = data.message;

    } else {
        document.getElementById('content').innerContent = 'Access denied';
    }
}