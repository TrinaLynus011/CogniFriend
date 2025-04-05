const apiKey = 'AIzaSyDRa12Dx8JLVUBkrlRsCVtD0TzwuSY84Ys';
let watchedVideos = JSON.parse(localStorage.getItem('watchedVideos')) || [];

// DOM Elements
const searchButton = document.getElementById('searchButton');
const searchQuery = document.getElementById('searchQuery');
const videoResults = document.getElementById('videoResults');
const progressLog = document.getElementById('progressLog');

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
    updateProgressCircle();
    displayWatchedVideos();
    
    // Load default recommendations
    if (window.location.pathname.includes('dashboard.html')) {
        fetchYouTubeVideos('educational technology').then(displayVideos);
    }
});

// Search functionality
searchButton.addEventListener('click', async () => {
    const query = searchQuery.value.trim();
    if (!query) return;
    
    try {
        const videos = await fetchYouTubeVideos(query);
        displayVideos(videos);
    } catch (error) {
        console.error('Error:', error);
        showNotification('Failed to fetch videos. Please try again.', 'error');
    }
});

// Fetch videos from YouTube API
async function fetchYouTubeVideos(query) {
    const searchEndpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&maxResults=10&q=${encodeURIComponent(query)}&key=${apiKey}`;
    const searchResponse = await fetch(searchEndpoint);
    if (!searchResponse.ok) throw new Error('YouTube API Error');
    
    const searchData = await searchResponse.json();
    const videoIds = searchData.items.map(video => video.id.videoId).join(',');
    
    const detailsEndpoint = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`;
    const detailsResponse = await fetch(detailsEndpoint);
    if (!detailsResponse.ok) throw new Error('YouTube Details Error');
    
    const detailsData = await detailsResponse.json();
    
    return searchData.items
        .map((video, index) => ({
            ...video,
            duration: parseISO8601Duration(detailsData.items[index].contentDetails.duration)
        }))
        .filter(video => video.duration > 60);
}

// Parse YouTube duration format
function parseISO8601Duration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    return (parseInt(match[1] || 0) * 3600) +
           (parseInt(match[2] || 0) * 60) +
           parseInt(match[3] || 0);
}

// Display videos in the UI
function displayVideos(videos) {
    videoResults.innerHTML = videos.map(video => `
        <div class="video-card">
            <img src="${video.snippet.thumbnails.medium.url}" class="video-thumbnail" alt="${video.snippet.title}">
            <div class="video-content">
                <h3 class="video-title">${video.snippet.title}</h3>
                <div class="video-actions">
                    <button class="play-btn" onclick="playVideo('${video.id.videoId}', '${escapeHtml(video.snippet.title)}')">
                        <i class="fas fa-play"></i> Play
                    </button>
                    <button class="watched-btn" onclick="trackProgress('${video.id.videoId}', '${escapeHtml(video.snippet.title)}', ${video.duration})">
                        <i class="fas fa-check"></i> Watched
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Play video in modal
function playVideo(videoId, title) {
    const modal = new bootstrap.Modal(document.getElementById('videoModal'));
    const player = document.getElementById('modalVideoPlayer');
    
    document.getElementById('videoModalLabel').textContent = title;
    player.innerHTML = `
        <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
        </iframe>
    `;
    
    // Update the mark as watched button
    const markWatchedBtn = document.querySelector('.btn-mark-watched');
    markWatchedBtn.onclick = () => {
        trackProgress(videoId, title, 0);
        modal.hide();
    };
    
    modal.show();
    
    // Clean up when modal is closed
    document.getElementById('videoModal').addEventListener('hidden.bs.modal', () => {
        player.innerHTML = '';
    });
}

// Track video progress
function trackProgress(videoId, title, duration) {
    // Check if video is already watched
    const alreadyWatched = watchedVideos.some(v => v.id === videoId);
    if (alreadyWatched) {
        showNotification('You already marked this video as watched!', 'info');
        return;
    }
    
    // Add to watched videos
    const percentage = Math.floor(Math.random() * 51) + 50; // 50-100%
    watchedVideos.unshift({
        id: videoId,
        title: title,
        percentage: percentage,
        date: new Date().toLocaleDateString()
    });
    
    // Keep only last 10 watched videos
    if (watchedVideos.length > 10) {
        watchedVideos = watchedVideos.slice(0, 10);
    }
    
    // Save to localStorage
    localStorage.setItem('watchedVideos', JSON.stringify(watchedVideos));
    
    // Update UI
    displayWatchedVideos();
    updateProgressCircle();
    showNotification('Progress updated! Keep learning!', 'success');
}

// Display watched videos in progress log
function displayWatchedVideos() {
    if (watchedVideos.length === 0) {
        progressLog.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-video-slash fa-2x mb-3"></i>
                <p>No videos watched yet. Start learning to track your progress!</p>
            </div>
        `;
        return;
    }
    
    progressLog.innerHTML = watchedVideos.map(video => `
        <div class="progress-item-log">
            <h4>${video.title}</h4>
            <div class="d-flex justify-content-between mb-1">
                <small>${video.date}</small>
                <small>${video.percentage}%</small>
            </div>
            <div class="progress-bar-log">
                <div class="progress-fill-log" style="width: ${video.percentage}%"></div>
            </div>
        </div>
    `).join('');
}

// Update circular progress indicator
function updateProgressCircle() {
    if (watchedVideos.length === 0) return;
    
    const totalPercentage = watchedVideos.reduce((sum, video) => sum + video.percentage, 0);
    const averagePercentage = Math.round(totalPercentage / watchedVideos.length);
    
    const circle = document.querySelector('.progress-ring-circle');
    const percentDisplay = document.querySelector('.progress-percent');
    
    // Calculate new offset
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (averagePercentage / 100) * circumference;
    
    // Animate the progress
    circle.style.strokeDashoffset = offset;
    percentDisplay.textContent = `${averagePercentage}%`;
    
    // Update color based on percentage
    if (averagePercentage < 40) {
        circle.style.stroke = 'var(--danger-color)';
    } else if (averagePercentage < 70) {
        circle.style.stroke = 'var(--warning-color)';
    } else {
        circle.style.stroke = 'var(--success-color)';
    }
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Escape HTML for safe rendering
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Logout function
function logout() {
    showNotification('You have been logged out successfully.', 'success');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1500);
}