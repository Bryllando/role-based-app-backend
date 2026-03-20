// server.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your_secret_key';

app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'] // Allow both frontend and backend origins
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-memory user storage (for demonstration purposes)
let users = [
    { id: 1, username: 'admin@gmail.com', password: '$2b$10$...', role: 'admin' },
    { id: 2, username: 'emmang@gmail.com', password: '$2b$10$...', role: 'user' },
];

if (!users[0].password.includes('2b')) {
    users[0].password = bcrypt.hashSync('admin123', 10);
    users[1].password = bcrypt.hashSync('user123', 10);
}


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

//Auth Routes

// POST /api/register
app.post('/api/register', async (req, res) => {
    const { username, password, role = 'user' } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    // Check if user already exists
    const existing = users.find(u => u.username === username)
    if (existing) {
        return res.status(400).json({ message: 'Username already exists' });
    }


    // HASH PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: users.length + 1,
        username,
        password: hashedPassword,
        role
    };
    users.push(newUser);
    res.status(201).json({ message: 'User registered', username, role });
});

//POST /api/login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    const user = users.find(u => u.username === username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }


    //Generate JWT token
    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        SECRET_KEY,
        { expiresIn: '2m' }
    )
    res.json({ message: 'Login successful', token });
});

//PROTECTED ROUTE PROFILE
app.get('/api/profile', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});


//ROLE BASED PROTECTED ROUTE ADMIN-ONLY
app.get('/api/admin/dashboard', authenticateToken, authorizeRole('admin'), (req, res) => {
    res.json({ message: 'welcome to admin dashboard', data: 'Secret admin info' });
});

//PUBLIC ROUTE: GUEST CONTENT
app.get('/api/content/guest', (req, res) => {
    res.json({ message: 'Welcome Guest! This content is for everyone.' });
});

//MIDDLEWARE
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

//ROLE AUTHORIZATION MIDDLEWARE
function authorizeRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }
        next();
    }
}


//Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Try logging in with:`);
    console.log(`    Admin:  username: admin@gmail.com, password: admin123`);
    console.log(`     User: username: emmang@gmail.com, password: user123`);

});