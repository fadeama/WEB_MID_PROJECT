// Common helper functions for the client-side project

// Replace this with a valid YouTube Data API key to enable search
const API_KEY = 'AIzaSyDRUbxYrmzFQ9awM7NenypUjDtmV99YSV4';

// ----- Storage helpers -----
function getUsers() {
    return JSON.parse(localStorage.getItem('users') || '[]');
}

function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}

function getPlaylists() {
    return JSON.parse(localStorage.getItem('playlists') || '[]');
}

function savePlaylists(playlists) {
    localStorage.setItem('playlists', JSON.stringify(playlists));
}

function getCurrentUser() {
    return sessionStorage.getItem('currentUser');
}

function setCurrentUser(username) {
    sessionStorage.setItem('currentUser', username);
}

// Redirect to login if no user logged in
function ensureLoggedIn() {
    if (!getCurrentUser()) {
        window.location.href = 'login.html';
    }
}

// ----- Registration -----
function registerUser(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;
    const firstName = document.getElementById('firstName').value.trim();
    const picture = document.getElementById('picture').value.trim();
    const error = document.getElementById('error');
    error.textContent = '';
    // Validate inputs
    if (!username || !password || !confirm || !firstName || !picture) {
        error.textContent = 'Please fill out all fields.';
        return;
    }
    if (password !== confirm) {
        error.textContent = 'Passwords do not match.';
        return;
    }
    // Password policy: minimum 6 chars, one letter and one non-alphanumeric
    if (password.length < 6 || !/[A-Za-z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        error.textContent = 'Password must contain at least 6 characters, a letter and a non‑alphanumeric character.';
        return;
    }
    let users = getUsers();
    if (users.find(u => u.username === username)) {
        error.textContent = 'Username already exists.';
        return;
    }
    users.push({ username, password, firstName, picture });
    saveUsers(users);
    alert('Registration successful. Please login.');
    window.location.href = 'login.html';
}

// ----- Login -----
function loginUser(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const error = document.getElementById('error');
    error.textContent = '';
    let users = getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        error.textContent = 'Invalid credentials.';
        return;
    }
    setCurrentUser(username);
    window.location.href = 'search.html';
}

function logout() {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

// Show toast message with optional link
function showToast(message, linkHref) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = '';
    toast.textContent = message;
    if (linkHref) {
        const link = document.createElement('a');
        link.href = linkHref;
        link.textContent = ' View';
        link.style.color = 'lightblue';
        link.style.marginLeft = '0.5rem';
        toast.appendChild(link);
    }
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 4000);
}

// ----- YouTube search -----
async function searchVideos(e) {
    e.preventDefault();
    const query = document.getElementById('query').value.trim();
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '';
    if (!query) return;
    try {
        const resp = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(query)}&key=${API_KEY}`);
        const data = await resp.json();
        const videoIds = data.items.map(item => item.id.videoId).join(',');
        const detailsResp = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${API_KEY}`);
        const detailsData = await detailsResp.json();
        const detailsMap = {};
        detailsData.items.forEach(item => {
            detailsMap[item.id] = item;
        });
        data.items.forEach(item => {
            const id = item.id.videoId;
            const snippet = item.snippet;
            const detail = detailsMap[id] || {};
            const duration = detail.contentDetails ? detail.contentDetails.duration : '';
            const views = detail.statistics ? detail.statistics.viewCount : '';
            createCard({
                id,
                title: snippet.title,
                thumbnail: snippet.thumbnails.medium.url,
                duration,
                views,
                type: 'youtube'
            });
        });
    } catch (err) {
        console.error(err);
        showToast('Failed to fetch videos. Check API key.');
    }
}

// Create a card element for a video and append to results
function createCard(video) {
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) return;
    const card = document.createElement('div');
    card.className = 'card';
    // thumbnail
    if (video.thumbnail) {
        const img = document.createElement('img');
        img.src = video.thumbnail;
        img.alt = video.title;
        img.onclick = () => openVideoModal(video);
        card.appendChild(img);
    }
    // title
    const titleDiv = document.createElement('div');
    titleDiv.className = 'card-title';
    titleDiv.textContent = video.title;
    titleDiv.title = video.title;
    titleDiv.onclick = () => openVideoModal(video);
    card.appendChild(titleDiv);
    // info
    const info = document.createElement('div');
    let infoText = '';
    if (video.views) infoText += `Views: ${video.views}`;
    if (video.duration) infoText += `\nDuration: ${video.duration}`;
    info.textContent = infoText;
    card.appendChild(info);
    // add to favorites button
    const btn = document.createElement('button');
    const exists = isVideoInAnyPlaylist(video.id);
    if (exists) {
        btn.disabled = true;
        btn.textContent = 'Added';
    } else {
        btn.textContent = 'Add to favorites';
        btn.onclick = () => addToFavorites(video, btn);
    }
    card.appendChild(btn);
    resultsContainer.appendChild(card);
}

// Check if a video is already contained in any playlist of current user
function isVideoInAnyPlaylist(videoId) {
    const currentUser = getCurrentUser();
    if (!currentUser) return false;
    const playlists = getPlaylists().filter(p => p.username === currentUser);
    for (const pl of playlists) {
        if (pl.videos && pl.videos.find(v => v.id === videoId)) {
            return true;
        }
    }
    return false;
}

// Add a video or mp3 to a playlist (creating playlist if needed)
function addToFavorites(video, btn) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Please login.');
        return;
    }
    let playlists = getPlaylists();
    const mylists = playlists.filter(p => p.username === currentUser);
    let playlistName = prompt('Enter playlist name (existing or new):');
    if (!playlistName) return;
    // find existing playlist
    let playlist = mylists.find(p => p.name.toLowerCase() === playlistName.toLowerCase());
    if (!playlist) {
        // create new playlist
        const id = Date.now().toString();
        playlist = { id, username: currentUser, name: playlistName, videos: [] };
        playlists.push(playlist);
    }
    // ensure videos array
    playlist.videos = playlist.videos || [];
    if (!playlist.videos.find(v => v.id === video.id)) {
        playlist.videos.push({ ...video, rating: 0 });
    }
    savePlaylists(playlists);
    if (btn && btn instanceof HTMLElement) {
        btn.disabled = true;
        btn.textContent = 'Added';
    }
    // show toast linking to playlist page
    showToast('Added to playlist', `playlists.html?id=${playlist.id}`);
}

// Display video or mp3 in a modal window
function openVideoModal(video) {
    const modal = document.getElementById('modal');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;
    content.innerHTML = '';
    const closeBtn = document.createElement('span');
    closeBtn.className = 'modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };
    content.appendChild(closeBtn);
    if (video.type === 'mp3') {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = video.data;
        content.appendChild(audio);
    } else {
        const iframe = document.createElement('iframe');
        iframe.width = '560';
        iframe.height = '315';
        iframe.src = `https://www.youtube.com/embed/${video.id}`;
        iframe.frameBorder = '0';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        content.appendChild(iframe);
    }
    modal.style.display = 'flex';
}

// ----- Playlist page -----
function loadPlaylistsPage() {
    ensureLoggedIn();
    const currentUser = getCurrentUser();
    const params = new URLSearchParams(window.location.search);
    const selectedId = params.get('id');
    const playlists = getPlaylists().filter(p => p.username === currentUser);
    const sidebarList = document.getElementById('playlist-list');
    if (!sidebarList) return;
    sidebarList.innerHTML = '';
    // draw list and set active item
    playlists.forEach((p, index) => {
        const li = document.createElement('li');
        li.textContent = p.name;
        li.dataset.id = p.id;
        const isActive = (p.id === selectedId) || (!selectedId && index === 0);
        if (isActive) {
            li.classList.add('active');
        }
        li.onclick = () => {
            document.querySelectorAll('#playlist-list li').forEach(item => item.classList.remove('active'));
            li.classList.add('active');
            loadPlaylistContent(p.id);
            const url = new URL(window.location.href);
            url.searchParams.set('id', p.id);
            history.replaceState(null, '', url.toString());
        };
        sidebarList.appendChild(li);
    });
    // load selected playlist content
    if (playlists.length) {
        const firstId = selectedId || playlists[0].id;
        loadPlaylistContent(firstId);
    }
}

// Render playlist songs for the given playlist ID
function loadPlaylistContent(id) {
    const currentUser = getCurrentUser();
    const playlists = getPlaylists();
    const playlist = playlists.find(p => p.id === id && p.username === currentUser);
    const container = document.getElementById('playlist-content');
    if (!container) return;
    container.innerHTML = '';
    if (!playlist) {
        container.textContent = 'No playlist selected.';
        return;
    }
    // Header with playlist name and delete button
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    const h2 = document.createElement('h2');
    h2.textContent = playlist.name;
    header.appendChild(h2);
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete playlist';
    delBtn.onclick = () => {
        if (confirm('Delete this playlist?')) {
            const remaining = playlists.filter(p => !(p.id === id && p.username === currentUser));
            savePlaylists(remaining);
            loadPlaylistsPage();
        }
    };
    header.appendChild(delBtn);
    container.appendChild(header);
    // Controls: search & sort
    const controls = document.createElement('div');
    controls.style.margin = '0.5rem 0';
    const searchInput = document.createElement('input');
    searchInput.placeholder = 'Search in playlist...';
    const sortSelect = document.createElement('select');
    ['Default', 'A-Z', 'Rating'].forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        sortSelect.appendChild(o);
    });
    controls.appendChild(searchInput);
    controls.appendChild(sortSelect);
    container.appendChild(controls);
    // Videos container
    const listDiv = document.createElement('div');
    container.appendChild(listDiv);
    function updatePlaylistsStorage() {
        const idx = playlists.findIndex(p => p.id === playlist.id && p.username === currentUser);
        playlists[idx] = playlist;
        savePlaylists(playlists);
    }
    function render() {
        listDiv.innerHTML = '';
        let videos = playlist.videos ? playlist.videos.slice() : [];
        const query = searchInput.value.trim().toLowerCase();
        if (query) {
            videos = videos.filter(v => v.title.toLowerCase().includes(query));
        }
        const sort = sortSelect.value;
        if (sort === 'A-Z') {
            videos.sort((a, b) => a.title.localeCompare(b.title));
        } else if (sort === 'Rating') {
            videos.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        }
        videos.forEach((v, index) => {
            const row = document.createElement('div');
            row.className = 'video-row';
            const titleSpan = document.createElement('span');
            titleSpan.style.flex = '1';
            titleSpan.textContent = v.title;
            titleSpan.title = v.title;
            titleSpan.style.cursor = 'pointer';
            titleSpan.onclick = () => openVideoModal(v);
            row.appendChild(titleSpan);
            // rating stars
            const ratingDiv = document.createElement('div');
            ratingDiv.className = 'star-rating';
            for (let i = 1; i <= 5; i++) {
                const star = document.createElement('span');
                star.innerHTML = '&#9733;';
                if (v.rating >= i) {
                    star.classList.add('selected');
                }
                star.onclick = () => {
                    v.rating = i;
                    updatePlaylistsStorage();
                    render();
                };
                ratingDiv.appendChild(star);
            }
            row.appendChild(ratingDiv);
            // remove button
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.onclick = () => {
                playlist.videos.splice(index, 1);
                updatePlaylistsStorage();
                render();
            };
            row.appendChild(removeBtn);
            listDiv.appendChild(row);
        });
    }
    searchInput.oninput = render;
    sortSelect.onchange = render;
    render();
}

// ----- Initialization functions per page -----
function initRegister() {
    const form = document.getElementById('register-form');
    if (form) {
        form.onsubmit = registerUser;
    }
}

function initLogin() {
    const form = document.getElementById('login-form');
    if (form) {
        form.onsubmit = loginUser;
    }
}

function initSearch() {
    ensureLoggedIn();
    const currentUser = getCurrentUser();
    const user = getUsers().find(u => u.username === currentUser);
    if (user) {
        document.getElementById('welcome').textContent = `Hello, ${user.firstName}`;
        const img = document.getElementById('user-image');
        if (img) img.src = user.picture;
    }
    const form = document.getElementById('search-form');
    if (form) form.onsubmit = searchVideos;
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.onclick = logout;
    const mp3Input = document.getElementById('mp3-input');
    if (mp3Input) mp3Input.onchange = handleMp3Upload;
}

// Handle MP3 uploads and convert to Base64 for storing in playlists
function handleMp3Upload(e) {
    const files = e.target.files;
    if (!files.length) return;
    const file = files[0];
    if (!file.type.startsWith('audio')) {
        alert('Please upload an audio file (MP3).');
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = reader.result;
        const title = file.name;
        // Create a pseudo video object for MP3
        const video = {
            id: Date.now().toString(),
            title,
            thumbnail: '',
            duration: '',
            views: '',
            type: 'mp3',
            data: dataUrl,
            rating: 0
        };
        addToFavorites(video, null);
        e.target.value = '';
    };
    reader.readAsDataURL(file);
}

function initPlaylists() {
    ensureLoggedIn();
    const newBtn = document.getElementById('new-playlist-btn');
    if (newBtn) {
        newBtn.onclick = () => {
            const name = prompt('Enter new playlist name:');
            if (!name) return;
            const currentUser = getCurrentUser();
            let playlists = getPlaylists();
            const id = Date.now().toString();
            playlists.push({ id, username: currentUser, name, videos: [] });
            savePlaylists(playlists);
            loadPlaylistsPage();
        };
    }
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.onclick = logout;
    loadPlaylistsPage();
}

// Initialize appropriate page on DOM ready
window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('register-form')) initRegister();
    if (document.getElementById('login-form')) initLogin();
    if (document.getElementById('search-form')) initSearch();
    if (document.getElementById('playlist-content')) initPlaylists();
});