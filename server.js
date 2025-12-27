const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PLAYLISTS_FILE = path.join(DATA_DIR, 'playlists.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readJSON(file, defaultValue = []) {
    try {
        if (!fs.existsSync(file)) return defaultValue;
        const data = fs.readFileSync(file, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Failed to read', file, err);
        return defaultValue;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Register a new user
app.post('/api/register', (req, res) => {
    const { username, password, firstName, picture } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    let users = readJSON(USERS_FILE);
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username exists' });
    }
    users.push({ username, password, firstName, picture });
    writeJSON(USERS_FILE, users);
    res.json({ success: true });
});

// Login and return user data
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    let users = readJSON(USERS_FILE);
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ success: true, user });
});

// Get playlists for a given username
app.get('/api/playlists', (req, res) => {
    const username = req.query.username;
    if (!username) return res.json([]);
    const playlists = readJSON(PLAYLISTS_FILE);
    res.json(playlists.filter(p => p.username === username));
});

// Create a new playlist
app.post('/api/playlists', (req, res) => {
    const { username, name } = req.body;
    if (!username || !name) return res.status(400).json({ error: 'Missing parameters' });
    let playlists = readJSON(PLAYLISTS_FILE);
    const id = Date.now().toString();
    playlists.push({ id, username, name, videos: [] });
    writeJSON(PLAYLISTS_FILE, playlists);
    res.json({ success: true, id });
});

// Update an existing playlist (replace fields)
app.put('/api/playlists/:id', (req, res) => {
    const id = req.params.id;
    let playlists = readJSON(PLAYLISTS_FILE);
    const idx = playlists.findIndex(p => p.id === id);
    if (idx < 0) {
        return res.status(404).json({ error: 'Playlist not found' });
    }
    playlists[idx] = { ...playlists[idx], ...req.body };
    writeJSON(PLAYLISTS_FILE, playlists);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Server running on port', PORT);
});