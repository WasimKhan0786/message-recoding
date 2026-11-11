/**
 * AudioFlow - Phase 1 Foundation JavaScript
 * Handles responsive navigation, health-check polling, and UI micro-interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initMobileMenu();
  initPublicAudioCatalog();
  initPlayerPreview();
  initHealthCheck();
  initCurrentYear();
});

/**
 * Navbar scroll behavior & active link management
 */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const navLinks = document.querySelectorAll('.nav-link, .mobile-link');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }, { passive: true });

  // Smooth scroll and active states
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId && targetId.startsWith('#')) {
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Close mobile menu if open
        closeMobileMenu();
      }
    });
  });
}

/**
 * Mobile navigation menu drawer toggle
 */
let isMenuOpen = false;

function initMobileMenu() {
  const menuToggle = document.getElementById('menuToggle');
  const mobileDrawer = document.getElementById('mobileDrawer');

  if (!menuToggle || !mobileDrawer) return;

  menuToggle.addEventListener('click', () => {
    isMenuOpen = !isMenuOpen;
    updateMobileMenuState();
  });

  // Close drawer on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isMenuOpen) {
      closeMobileMenu();
    }
  });

  // Close drawer when clicking outside
  document.addEventListener('click', (e) => {
    if (isMenuOpen && !mobileDrawer.contains(e.target) && !menuToggle.contains(e.target)) {
      closeMobileMenu();
    }
  });
}

function updateMobileMenuState() {
  const menuToggle = document.getElementById('menuToggle');
  const mobileDrawer = document.getElementById('mobileDrawer');

  if (!menuToggle || !mobileDrawer) return;

  if (isMenuOpen) {
    menuToggle.classList.add('open');
    menuToggle.setAttribute('aria-expanded', 'true');
    mobileDrawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  } else {
    menuToggle.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    mobileDrawer.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function closeMobileMenu() {
  isMenuOpen = false;
  updateMobileMenuState();
}

/**
 * Interactive Hero Player Preview Toggle & Integration
 */
function initPlayerPreview() {
  const playBtn = document.getElementById('previewPlayBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const waveform = document.getElementById('waveformGraphic');
  const heroPrev = document.getElementById('heroPrevBtn');
  const heroNext = document.getElementById('heroNextBtn');
  const heroTitle = document.getElementById('heroTrackTitle');
  const heroArtist = document.getElementById('heroTrackArtist');

  if (!playBtn || !playIcon || !pauseIcon || !waveform) return;

  playBtn.addEventListener('click', () => {
    // If public audios are loaded and we have tracks
    if (publicAudiosCache && publicAudiosCache.length > 0) {
      if (!currentPlayingId) {
        // Start streaming first track
        const firstTrack = publicAudiosCache[0];
        if (heroTitle) heroTitle.textContent = firstTrack.title;
        if (heroArtist) heroArtist.textContent = `${firstTrack.genre || 'General'} • AudioFlow Stream`;
        window.playPublicAudio(firstTrack.id);
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        waveform.classList.remove('paused');
      } else {
        // Toggle play/pause on active track
        if (globalAudio && globalAudio.paused) {
          globalAudio.play();
          playIcon.classList.add('hidden');
          pauseIcon.classList.remove('hidden');
          waveform.classList.remove('paused');
        } else if (globalAudio) {
          globalAudio.pause();
          playIcon.classList.remove('hidden');
          pauseIcon.classList.add('hidden');
          waveform.classList.add('paused');
        }
      }
      return;
    }

    // Fallback animation toggle
    const isPaused = waveform.classList.contains('paused');
    if (isPaused) {
      playIcon.classList.add('hidden');
      pauseIcon.classList.remove('hidden');
      waveform.classList.remove('paused');
    } else {
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
      waveform.classList.add('paused');
    }
  });

  if (heroNext) {
    heroNext.addEventListener('click', () => {
      if (!publicAudiosCache || publicAudiosCache.length === 0) return;
      const currentIndex = publicAudiosCache.findIndex(a => a.id === currentPlayingId);
      const nextIndex = (currentIndex + 1) % publicAudiosCache.length;
      const nextTrack = publicAudiosCache[nextIndex];
      if (heroTitle) heroTitle.textContent = nextTrack.title;
      if (heroArtist) heroArtist.textContent = `${nextTrack.genre || 'General'} • AudioFlow Stream`;
      window.playPublicAudio(nextTrack.id);
    });
  }

  if (heroPrev) {
    heroPrev.addEventListener('click', () => {
      if (!publicAudiosCache || publicAudiosCache.length === 0) return;
      const currentIndex = publicAudiosCache.findIndex(a => a.id === currentPlayingId);
      const prevIndex = (currentIndex - 1 + publicAudiosCache.length) % publicAudiosCache.length;
      const prevTrack = publicAudiosCache[prevIndex];
      if (heroTitle) heroTitle.textContent = prevTrack.title;
      if (heroArtist) heroArtist.textContent = `${prevTrack.genre || 'General'} • AudioFlow Stream`;
      window.playPublicAudio(prevTrack.id);
    });
  }
}

/**
 * Fetch and display API health status in the footer
 */
async function initHealthCheck() {
  const dot = document.getElementById('healthStatusDot');
  const text = document.getElementById('healthStatusText');

  if (!dot || !text) return;

  try {
    const response = await fetch('/api/health');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'healthy') {
      dot.className = 'health-dot online';
      text.textContent = `API: Operational (Uptime: ${data.uptime})`;
      text.title = `Service: ${data.service} - Phase: ${data.phase}`;
    } else {
      dot.className = 'health-dot offline';
      text.textContent = 'API: Degraded';
    }
  } catch (error) {
    dot.className = 'health-dot offline';
    text.textContent = 'API: Offline (Local Mode)';
    console.warn('AudioFlow Health Check Warning:', error.message);
  }
}

/**
 * Populate current year dynamically
 */
function initCurrentYear() {
  const yearElement = document.getElementById('currentYear');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
}

/**
 * Public Audio Catalog & Secure Stream Controller
 * Anyone can listen without login. Downloads disabled and S3 protected.
 */
let publicAudiosCache = [];
let currentPlayingId = null;

async function initPublicAudioCatalog() {
  const grid = document.getElementById('publicAudioGrid');
  const emptyState = document.getElementById('publicAudioEmpty');
  const countBadge = document.getElementById('publicAudioCountBadge');
  const searchInput = document.getElementById('publicAudioSearch');

  if (!grid || !emptyState) return;

  // Initialize Dock Player Controls
  setupGlobalPlayerDock();

  try {
    const res = await fetch('/api/public/audios');
    if (!res.ok) throw new Error('Could not fetch public audio recordings');
    const data = await res.json();
    publicAudiosCache = data.audios || [];

    renderPublicAudios(publicAudiosCache);

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = publicAudiosCache.filter(a => 
          (a.title && a.title.toLowerCase().includes(query)) ||
          (a.genre && a.genre.toLowerCase().includes(query)) ||
          (a.description && a.description.toLowerCase().includes(query))
        );
        renderPublicAudios(filtered);
      });
    }
  } catch (err) {
    console.warn('Could not load public audios:', err.message);
    if (countBadge) countBadge.textContent = 'Unable to load recordings';
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
  }
}

function renderPublicAudios(audios) {
  const grid = document.getElementById('publicAudioGrid');
  const emptyState = document.getElementById('publicAudioEmpty');
  const countBadge = document.getElementById('publicAudioCountBadge');

  if (!grid || !emptyState) return;

  if (!audios || audios.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    if (countBadge) countBadge.textContent = '0 recordings available';
    return;
  }

  emptyState.classList.add('hidden');
  if (countBadge) {
    countBadge.textContent = `${audios.length} recording${audios.length === 1 ? '' : 's'} available to stream`;
  }

  grid.innerHTML = audios.map(audio => {
    const isCurrentPlaying = currentPlayingId === audio.id;
    return `
      <div class="public-audio-card ${isCurrentPlaying ? 'active-playing' : ''}" id="card-${audio.id}" oncontextmenu="return false;">
        <div class="public-card-meta">
          <span class="public-card-genre">${escapeHtml(audio.genre || 'General')}</span>
          <span class="public-card-format">${escapeHtml(audio.format || 'MP3 128k')}</span>
        </div>

        <h3 class="public-card-title">${escapeHtml(audio.title || 'Untitled Recording')}</h3>
        <p class="public-card-desc">${escapeHtml(audio.description || 'Studio recorded audio track available for public streaming.')}</p>

        <div class="public-card-footer">
          <div style="font-size: 0.82rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>${escapeHtml(audio.duration || '00:00')}</span>
          </div>

          <button class="public-play-btn ${isCurrentPlaying ? 'playing' : ''}" onclick="playPublicAudio('${audio.id}')" title="Stream this recording">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4"></polygon>
            </svg>
            <span>${isCurrentPlaying ? 'Now Playing' : 'Listen'}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Global Sticky Player Dock Controller
 */
let globalAudio = null;
let currentActiveTrack = null;

function setupGlobalPlayerDock() {
  globalAudio = document.getElementById('globalAudioStream');
  const dock = document.getElementById('globalPlayerDock');
  const playPauseBtn = document.getElementById('dockPlayPauseBtn');
  const playIcon = document.getElementById('dockPlayIcon');
  const pauseIcon = document.getElementById('dockPauseIcon');
  const replayBtn = document.getElementById('dockReplayBtn');
  const visualizer = document.getElementById('dockVisualizer');
  const timeBarWrapper = document.getElementById('dockTimeBarWrapper');
  const timeBarFill = document.getElementById('dockTimeBarFill');
  const currentTimeText = document.getElementById('dockCurrentTime');
  const durationText = document.getElementById('dockDuration');
  const muteBtn = document.getElementById('dockMuteBtn');
  const volIcon = document.getElementById('dockVolIcon');
  const volumeSlider = document.getElementById('dockVolumeSlider');

  if (!globalAudio || !dock) return;

  // Play / Pause toggle
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      if (globalAudio.paused) {
        globalAudio.play().catch(err => console.warn('Play error:', err.message));
      } else {
        globalAudio.pause();
      }
    });
  }

  // Replay from start (Range: bytes=0-)
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      globalAudio.currentTime = 0;
      globalAudio.play().catch(err => console.warn('Replay error:', err.message));
    });
  }

  // Audio Events
  globalAudio.addEventListener('play', () => {
    if (playIcon) playIcon.classList.add('hidden');
    if (pauseIcon) pauseIcon.classList.remove('hidden');
    if (visualizer) visualizer.classList.add('active');
    updateCardPlayingState(currentPlayingId, true);
  });

  globalAudio.addEventListener('pause', () => {
    if (playIcon) playIcon.classList.remove('hidden');
    if (pauseIcon) pauseIcon.classList.add('hidden');
    if (visualizer) visualizer.classList.remove('active');
    updateCardPlayingState(currentPlayingId, false);
  });

  globalAudio.addEventListener('ended', () => {
    if (playIcon) playIcon.classList.remove('hidden');
    if (pauseIcon) pauseIcon.classList.add('hidden');
    if (visualizer) visualizer.classList.remove('active');
    if (timeBarFill) timeBarFill.style.width = '100%';
    updateCardPlayingState(currentPlayingId, false);
  });

  // Time & Progress Updates
  globalAudio.addEventListener('timeupdate', () => {
    if (!globalAudio.duration) return;
    const progress = (globalAudio.currentTime / globalAudio.duration) * 100;
    if (timeBarFill) timeBarFill.style.width = `${progress}%`;
    if (currentTimeText) currentTimeText.textContent = formatTime(globalAudio.currentTime);
  });

  globalAudio.addEventListener('loadedmetadata', () => {
    if (durationText) durationText.textContent = formatTime(globalAudio.duration);
  });

  // Interactive Timeline Seeking (HTTP Range request)
  if (timeBarWrapper) {
    timeBarWrapper.addEventListener('click', (e) => {
      if (!globalAudio.duration) return;
      const rect = timeBarWrapper.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const percentage = Math.max(0, Math.min(1, clickX / width));
      globalAudio.currentTime = percentage * globalAudio.duration;
    });
  }

  // Volume & Mute Controls
  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      globalAudio.volume = parseFloat(e.target.value);
      globalAudio.muted = globalAudio.volume === 0;
      updateVolIcon(volIcon, globalAudio.volume, globalAudio.muted);
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      globalAudio.muted = !globalAudio.muted;
      updateVolIcon(volIcon, globalAudio.volume, globalAudio.muted);
    });
  }

  // Suppress context menu on dock
  dock.addEventListener('contextmenu', (e) => e.preventDefault());
}

function updateVolIcon(volIcon, volume, isMuted) {
  if (!volIcon) return;
  if (isMuted || volume === 0) {
    volIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
  } else {
    volIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
  }
}

window.playPublicAudio = async function(audioId) {
  const track = publicAudiosCache.find(a => a.id === audioId);
  if (!track) return;

  const dock = document.getElementById('globalPlayerDock');
  const trackTitle = document.getElementById('dockTrackTitle');
  const trackMeta = document.getElementById('dockTrackMeta');

  if (!globalAudio || !dock) return;

  // If clicked currently playing track, toggle play/pause
  if (currentPlayingId === audioId && !globalAudio.paused) {
    globalAudio.pause();
    return;
  }

  currentPlayingId = audioId;
  currentActiveTrack = track;

  // Reveal dock
  dock.classList.remove('hidden');

  if (trackTitle) trackTitle.textContent = track.title || 'Audio Recording';
  if (trackMeta) trackMeta.textContent = `${track.genre || 'General'} &bull; ${track.format || 'MP3 128k'}`;

  // Fetch fresh short-lived stream token
  try {
    const tokenRes = await fetch(`/api/public/audios/${audioId}/stream-token`);
    const tokenData = await tokenRes.json();
    const streamUrl = tokenData.streamUrl || track.streamUrl;

    globalAudio.src = streamUrl;
    globalAudio.play().catch(err => {
      console.warn('Playback notice:', err.message);
    });
  } catch (err) {
    globalAudio.src = track.streamUrl;
    globalAudio.play().catch(() => {});
  }

  updateCardPlayingState(audioId, true);
};

function updateCardPlayingState(playingId, isPlaying) {
  document.querySelectorAll('.public-audio-card').forEach(card => {
    const btn = card.querySelector('.public-play-btn');
    const span = btn ? btn.querySelector('span') : null;

    if (card.id === `card-${playingId}` && isPlaying) {
      card.classList.add('active-playing');
      if (btn) btn.classList.add('playing');
      if (span) span.textContent = 'Pause';
    } else {
      card.classList.remove('active-playing');
      if (btn) btn.classList.remove('playing');
      if (span) span.textContent = 'Listen';
    }
  });
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

