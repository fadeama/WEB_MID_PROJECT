// Common helper functions for the client-side project

// Replace this with a valid YouTube Data API key to enable search
const API_KEY = 'AIzaSyDRUbxYrmzFQ9awM7NenypUjDtmV99YSV4';

// ----- Session helpers (still on client) -----
function getCurrentUser() {
    return sessionStorage.getItem('currentUser');
}

function setCurrentUser(username) {
    sessionStorage.setItem('currentUser', username);
}

// Store extra info (firstName, picture) from server user object
function setCurrentUserInfo(user) {
    sessionStorage.setItem('currentUserInfo', JSON.stringify(user));
}

function getCurrentUserInfo() {
    const raw = sessionStorage.getItem('currentUserInfo');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// Redirect to login if no user logged in
function ensureLoggedIn() {
    if (!getCurrentUser()) {
        window.location.href = 'login.html';
    }
}

// ----- Server API helpers (USERS & PLAYLISTS) -----

// USERS: register & login go directly via fetch; we don't need getUsers/saveUsers anymore

// Get playlists of current user from server
async function getPlaylists() {
    const username = getCurrentUser();
    if (!username) return [];
    const res = await fetch(`/api/playlists?username=${encodeURIComponent(username)}`);
    if (!res.ok) return [];
    const playlists = await res.json();
    // ignore "soft deleted" playlists (see delete handler below)
    return playlists.filter(p => !p._deleted);
}

// Create a new playlist on server, return playlist object {id, username, name, videos: []}
async function createPlaylistOnServer(name) {
    const username = getCurrentUser();
    const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name })
    });
    if (!res.ok) throw new Error('Failed to create playlist');
    const data = await res.json();
    return { id: data.id, username, name, videos: [] };
}

// Update playlist on server (replace its fields)
async function updatePlaylistOnServer(playlist) {
    const res = await fetch(`/api/playlists/${encodeURIComponent(playlist.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playlist)
    });
    if (!res.ok) {
        throw new Error('Failed to update playlist');
    }
}

// ----- Registration -----
// ----- Registration -----
async function registerUser(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;
    const firstName = document.getElementById('firstName').value.trim();
    const picture = document.getElementById('picture').value.trim();
    const error = document.getElementById('error');

    // clear old message
    error.textContent = '';

    // 1) Empty fields
    if (!username || !password || !confirm || !firstName || !picture) {
        error.textContent = 'Please fill out all fields (username, first name, picture, password, confirm password).';
        return;
    }

    // 2) Passwords do not match
    if (password !== confirm) {
        error.textContent = 'Passwords do not match.';
        return;
    }

    // 3) Password policy
    //    - minimum 6 chars
    //    - at least one letter
    //    - at least one non-alphanumeric (symbol) character
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNonAlnum = /[^A-Za-z0-9]/.test(password);
    const isLongEnough = password.length >= 6;

    if (!isLongEnough || !hasLetter || !hasNonAlnum) {
        error.textContent =
            'Password failed: it must be at least 6 characters long, contain at least one letter, and at least one symbol (for example !, @, #, $, %).';
        return;
    }

    // 4) Send to server
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, firstName, picture })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
            // Show the *exact* server error if it exists (e.g. "Username exists")
            if (data.error) {
                error.textContent = data.error;
            } else {
                error.textContent = 'Registration failed: unknown server error.';
            }
            return;
        }

        alert('Registration successful. Please login.');
        window.location.href = 'login.html';
    } catch (err) {
        console.error(err);
        error.textContent = 'Registration failed: cannot reach server.';
    }
}


// ----- Login -----
// ----- Login -----
async function loginUser(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const error = document.getElementById('error');

    error.textContent = '';

    if (!username || !password) {
        error.textContent = 'Please enter both username and password.';
        return;
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
            // From server: "Invalid credentials." or similar
            if (data.error) {
                error.textContent = data.error;
            } else {
                error.textContent = 'Login failed: invalid username or password.';
            }
            return;
        }

        // success
        setCurrentUser(username);
        if (data.user) {
            setCurrentUserInfo(data.user);
        }
        window.location.href = 'search.html';
    } catch (err) {
        console.error(err);
        error.textContent = 'Login failed: cannot reach server.';
    }
}


function logout() {
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUserInfo');
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
        if (!videoIds) return;
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

    // add to favorites button (async check)
    const btn = document.createElement('button');
    btn.textContent = 'Checking...';
    btn.disabled = true;
    card.appendChild(btn);

    // Async: check if video already exists in any playlist
    (async () => {
        const exists = await isVideoInAnyPlaylist(video.id);
        if (exists) {
            btn.disabled = true;
            btn.textContent = 'Added';
        } else {
            btn.disabled = false;
            btn.textContent = 'Add to favorites';
            btn.onclick = () => addToFavorites(video, btn);
        }
    })();

    resultsContainer.appendChild(card);
}

// Check if a video is already contained in any playlist of current user (server-based)
async function isVideoInAnyPlaylist(videoId) {
    const currentUser = getCurrentUser();
    if (!currentUser) return false;
    const playlists = await getPlaylists();
    for (const pl of playlists) {
        if (pl.videos && pl.videos.find(v => v.id === videoId)) {
            return true;
        }
    }
    return false;
}

// Add a video or mp3 to a playlist (creating playlist if needed) - server-based
async function addToFavorites(video, btn) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Please login.');
        return;
    }

    let playlistName = prompt('Enter playlist name (existing or new):');
    if (!playlistName) return;
    playlistName = playlistName.trim();
    if (!playlistName) return;

    try {
        let playlists = await getPlaylists();
        // find existing playlist (case-insensitive)
        let playlist = playlists.find(p => p.name.toLowerCase() === playlistName.toLowerCase());

        // create new playlist if not exists
        if (!playlist) {
            playlist = await createPlaylistOnServer(playlistName);
            playlists.push(playlist);
        }

        playlist.videos = playlist.videos || [];

        // avoid duplicates
        if (!playlist.videos.find(v => v.id === video.id)) {
            playlist.videos.push({ ...video, rating: video.rating || 0 });
            await updatePlaylistOnServer(playlist);
        }

        if (btn && btn instanceof HTMLElement) {
            btn.disabled = true;
            btn.textContent = 'Added';
        }

        // show toast linking to playlist page
        showToast('Added to playlist', `playlists.html?id=${playlist.id}`);
    } catch (err) {
        console.error(err);
        alert('Failed to add to playlist (server error).');
    }
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
async function loadPlaylistsPage() {
    ensureLoggedIn();
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const params = new URLSearchParams(window.location.search);
    const selectedId = params.get('id');

    const playlists = await getPlaylists();
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
            loadPlaylistContent(p.id, playlists);
            const url = new URL(window.location.href);
            url.searchParams.set('id', p.id);
            history.replaceState(null, '', url.toString());
        };
        sidebarList.appendChild(li);
    });

    // load selected playlist content
    if (playlists.length) {
        const firstId = selectedId || playlists[0].id;
        loadPlaylistContent(firstId, playlists);
    } else {
        const container = document.getElementById('playlist-content');
        if (container) {
            container.innerHTML = 'No playlists yet.';
        }
    }
}

// Render playlist songs for the given playlist ID
function loadPlaylistContent(id, playlistsArray) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const playlists = playlistsArray || [];
    const playlist = playlists.find(p => p.id === id);
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
    delBtn.onclick = async () => {
        if (confirm('Delete this playlist?')) {
            try {
                // Soft delete: mark as _deleted and update on server
                playlist._deleted = true;
                await updatePlaylistOnServer(playlist);
                await loadPlaylistsPage();
            } catch (err) {
                console.error(err);
                alert('Failed to delete playlist on server.');
            }
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

    async function saveCurrentPlaylist() {
        try {
            await updatePlaylistOnServer(playlist);
        } catch (err) {
            console.error(err);
            alert('Failed to save playlist changes to server.');
        }
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
                star.onclick = async () => {
                    v.rating = i;
                    await saveCurrentPlaylist();
                    render();
                };
                ratingDiv.appendChild(star);
            }
            row.appendChild(ratingDiv);

            // remove button
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.onclick = async () => {
                playlist.videos.splice(index, 1);
                await saveCurrentPlaylist();
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

async function initSearch() {
    ensureLoggedIn();
    const currentUser = getCurrentUser();
    const user = getCurrentUserInfo();

    if (user) {
        const welcomeSpan = document.getElementById('welcome');
        if (welcomeSpan) welcomeSpan.textContent = `Hello, ${user.firstName}`;
        const img = document.getElementById('user-image');
        if (img) {
            img.src = user.picture;
            img.style.display = 'block';
        }
    }

    const form = document.getElementById('search-form');
    if (form) form.onsubmit = searchVideos;

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.onclick = logout;

    const mp3Input = document.getElementById('mp3-input');
    if (mp3Input) mp3Input.onchange = handleMp3Upload;

    const playlistBtn = document.getElementById('playlist-btn');
    if (playlistBtn) {
        playlistBtn.onclick = () => {
            window.location.href = 'playlists.html';
        };
    }
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

async function initPlaylists() {
    ensureLoggedIn();

    const newBtn = document.getElementById('new-playlist-btn');
    if (newBtn) {
        newBtn.onclick = async () => {
            const name = prompt('Enter new playlist name:');
            if (!name) return;
            try {
                await createPlaylistOnServer(name.trim());
                await loadPlaylistsPage();
            } catch (err) {
                console.error(err);
                alert('Failed to create playlist on server.');
            }
        };
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.onclick = logout;

    await loadPlaylistsPage();
}

// Initialize appropriate page on DOM ready
window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('register-form')) initRegister();
    if (document.getElementById('login-form')) initLogin();
    if (document.getElementById('search-form')) initSearch();
    if (document.getElementById('playlist-content')) initPlaylists();
});
