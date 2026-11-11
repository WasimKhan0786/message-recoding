/**
 * AudioFlow - Admin Dashboard Client Controller
 * Manages sidebar navigation, real backend data fetching, modals, and secure logout.
 */

document.addEventListener('DOMContentLoaded', () => {
  initSession();
  initNavigation();
  initModals();
  initForms();
  initLogout();
  loadCurrentSection();
});

// Current active section state
let activeSection = 'overview';

/**
 * 1. Session Verification
 */
async function initSession() {
  try {
    const res = await fetch('/api/admin/me', {
      headers: { 'Accept': 'application/json' }
    });

    if (res.status === 401 || !res.ok) {
      window.location.replace('/login.html?redirect=%2Fadmin');
      return;
    }

    const data = await res.json();
    if (data && data.admin && data.admin.email) {
      const emailEl = document.getElementById('sidebarAdminEmail');
      if (emailEl) emailEl.textContent = data.admin.email;
      const profileEl = document.getElementById('adminProfileEmail');
      if (profileEl) profileEl.textContent = data.admin.email;
    }
  } catch (err) {
    console.error('Session verification failed:', err);
    window.location.replace('/login.html?redirect=%2Fadmin');
  }
}

/**
 * 2. Navigation & Section Switching
 */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const sidebar = document.getElementById('dashboardSidebar');
  const toggleBtn = document.getElementById('sidebarToggle');
  const backdrop = document.getElementById('sidebarBackdrop');

  // Mobile sidebar drawer toggle
  if (toggleBtn && sidebar && backdrop) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('active');
    });

    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
    });
  }

  // Nav item click
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const section = item.getAttribute('data-section');
      if (section) {
        switchSection(section);
        if (sidebar && backdrop && window.innerWidth <= 992) {
          sidebar.classList.remove('open');
          backdrop.classList.remove('active');
        }
      }
    });
  });

  // Listen to hash changes
  window.addEventListener('hashchange', () => {
    loadCurrentSection();
  });

  // Quick jump buttons on overview
  bindClick('taskAddAudio', () => openModal('modalAddAudio'));
  bindClick('taskAddRecipient', () => openModal('modalAddRecipient'));
  bindClick('taskCreateLink', () => openModal('modalCreateLink'));
  bindClick('quickAddAudioBtn', () => openModal('modalAddAudio'));
  bindClick('refreshStatsBtn', () => loadOverviewData());
  bindClick('refreshActivityBtn', () => loadActivityData());
  bindClick('refreshClicksBtn', () => loadClickTrackingData());
  bindClick('refreshProgressBtn', () => loadProgressData());
  bindClick('refreshResponsesBtn', () => loadResponsesData());

  // Search input listeners
  const audioSearch = document.getElementById('audioSearchInput');
  if (audioSearch) {
    audioSearch.addEventListener('input', debounce(() => loadAudioData(audioSearch.value), 300));
  }

  const recipSearch = document.getElementById('recipientSearchInput');
  if (recipSearch) {
    recipSearch.addEventListener('input', debounce(() => loadRecipientsData(recipSearch.value), 300));
  }

  // Click delegation for audio action buttons
  const audioTbody = document.getElementById('audioTableBody');
  if (audioTbody) {
    audioTbody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.action-btn-edit');
      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        if (id) {
          openEditAudioModal(id);
        }
      }
    });
  }
}

function loadCurrentSection() {
  const hash = window.location.hash.replace('#', '') || 'overview';
  switchSection(hash);
}

const sectionTitles = {
  'overview': 'Dashboard Overview',
  'audio-library': 'Audio Library',
  'recipients': 'Recipients Management',
  'shared-links': 'Shared Links',
  'responses': 'Listener Understanding & Responses',
  'welcome-settings': 'Welcome Page Settings',
  'activity': 'Recent Activity',
  'click-tracking': 'Link Click Tracking',
  'listening-progress': 'Listening Progress',
  'settings': 'System Settings'
};

function switchSection(sectionId) {
  if (!sectionTitles[sectionId]) sectionId = 'overview';
  activeSection = sectionId;

  // Update nav item active states
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-section') === sectionId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Show corresponding section
  document.querySelectorAll('.dashboard-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const targetSec = document.getElementById(`section-${sectionId}`);
  if (targetSec) {
    targetSec.classList.add('active');
  }

  // Update topbar title
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) {
    titleEl.textContent = sectionTitles[sectionId] || 'Dashboard';
  }

  // Load data for specific section
  switch (sectionId) {
    case 'overview':
      loadOverviewData();
      break;
    case 'audio-library':
      loadAudioData();
      break;
    case 'recipients':
      loadRecipientsData();
      break;
    case 'shared-links':
      loadSharedLinksData();
      break;
    case 'responses':
      loadResponsesData();
      break;
    case 'welcome-settings':
      loadWelcomeSettingsData();
      break;
    case 'activity':
      loadActivityData();
      break;
    case 'click-tracking':
      loadClickTrackingData();
      break;
    case 'listening-progress':
      loadProgressData();
      break;
    case 'settings':
      loadSettingsData();
      break;
  }
}

/**
 * 3. Real Backend Data Fetching & Rendering
 */

// 1. Overview Stats (Real Data Only)
async function loadOverviewData() {
  try {
    const res = await fetch('/api/admin/dashboard/stats');
    if (!res.ok) throw new Error('Failed to fetch stats');
    const data = await res.json();
    const stats = data.stats || {};

    // Update 6 KPI Cards with real counts
    setStatText('statTotalAudios', stats.totalAudios || 0);
    setStatText('statTotalStorage', stats.totalStorageFormatted || '0 MB');
    setStatText('statTotalLinks', stats.totalLinks || 0);
    setStatText('statActiveLinks', stats.activeLinks || 0);
    setStatText('statInactiveLinks', (stats.expiredLinks || 0) + (stats.disabledLinks || 0));
    setStatText('statTotalClicks', stats.totalClicks || 0);

    // Sidebar counter badges
    setStatText('audioCountBadge', stats.totalAudios || 0);
    setStatText('recipientCountBadge', stats.totalRecipients || 0);
    setStatText('linksCountBadge', stats.activeLinks || 0);
    setStatText('responsesCountBadge', stats.totalResponses || 0);

    // Unread responses notification indicator
    const alertBadge = document.getElementById('unreadResponsesAlertBadge');
    if (alertBadge) {
      if (stats.unreadResponses && stats.unreadResponses > 0) {
        alertBadge.textContent = `● ${stats.unreadResponses} Unread`;
        alertBadge.classList.remove('hidden');
      } else {
        alertBadge.classList.add('hidden');
      }
    }

    // Recent Uploads in Overview
    loadOverviewRecentUploads(stats.recentUploads || []);

    // Quick Mini Activity Feed
    loadMiniActivity();
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

function loadOverviewRecentUploads(uploads) {
  const tbody = document.getElementById('overviewRecentUploads');
  if (!tbody) return;

  if (!uploads || uploads.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-dim); padding: 16px;">No audio uploads found yet.</td></tr>';
    return;
  }

  tbody.innerHTML = uploads.map(audio => {
    const streamUrl = audio.streamUrl || `/api/admin/audios/${audio.id}/stream`;
    return `
      <tr>
        <td>
          <strong style="color: #fff;">${escapeHtml(audio.title)}</strong>
        </td>
        <td>${escapeHtml(audio.duration || '00:00')}</td>
        <td>${escapeHtml(audio.fileSize || '-')}</td>
        <td>
          <div class="table-actions">
            <button class="action-btn-play" onclick="playAudioPreview('${audio.id}', '${escapeHtml(audio.title)}', '${streamUrl}')">▶ Play</button>
            <button class="action-btn-copy" onclick="openShareModalForAudio('${audio.id}')">🔗 Share</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadMiniActivity() {
  const container = document.getElementById('overviewActivityList');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/activity');
    const data = await res.json();
    const list = data.activities || [];

    if (list.length === 0) {
      container.innerHTML = '<p style="color: var(--text-dim); font-size: 0.88rem; padding: 12px 0;">No activity recorded yet.</p>';
      return;
    }

    container.innerHTML = list.slice(0, 4).map(item => `
      <div class="activity-item" style="padding: 10px 12px;">
        <div class="activity-dot"></div>
        <div class="activity-body">
          <div class="activity-header-line">
            <span class="activity-title">${escapeHtml(item.action)}</span>
            <span class="activity-time">${formatDate(item.timestamp)}</span>
          </div>
          <span class="activity-detail">${escapeHtml(item.details)}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p style="color: var(--text-dim);">Could not load activity.</p>';
  }
}

// 2. Audio Library Data
async function loadAudioData(query = '') {
  const tbody = document.getElementById('audioTableBody');
  const emptyState = document.getElementById('audioEmptyState');
  if (!tbody || !emptyState) return;

  try {
    const res = await fetch(`/api/admin/audios?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    const audios = data.audios || [];

    // Cache audios globally for instant access
    window.audiosCache = audios;

    // Update sidebar counter
    setStatText('audioCountBadge', audios.length);

    if (audios.length === 0) {
      tbody.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    tbody.innerHTML = audios.map(audio => {
      const streamUrl = audio.streamUrl || `/api/admin/audios/${audio.id}/stream`;
      const isS3 = !!audio.s3Key;
      const fileName = audio.originalFilename || (audio.s3Key ? audio.s3Key.split('/').pop() : 'recording.mp3');
      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: #ffffff;">${escapeHtml(audio.title)}</div>
            <small style="color: var(--text-dim);">${escapeHtml(audio.description || 'No description')}</small>
          </td>
          <td><code style="color: var(--text-dim); font-size: 0.8rem;">${escapeHtml(fileName)}</code></td>
          <td><span class="pill-badge pill-format">${escapeHtml(audio.format || 'MP3 128k')}</span></td>
          <td>${escapeHtml(audio.duration || '00:00')}</td>
          <td><span style="color: #cbd5e1; font-size: 0.85rem;">${escapeHtml(audio.fileSize || '-')}</span></td>
          <td>${formatDate(audio.createdAt)}</td>
          <td>
            <div class="table-actions">
              ${isS3 ? `<button class="action-btn-play" onclick="playAudioPreview('${audio.id}', '${escapeHtml(audio.title)}', '${streamUrl}')">▶ Play</button>` : ''}
              <button class="action-btn-copy" onclick="openShareModalForAudio('${audio.id}')">🔗 Share</button>
              <button class="action-btn-edit" data-id="${audio.id}" onclick="openEditAudioModal('${audio.id}')" title="Edit Audio Details">✏️ Edit</button>
              <button class="action-btn-del" onclick="handleDeleteAudio('${audio.id}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading audios:', err);
  }
}

// 3. Recipients Data
async function loadRecipientsData(query = '') {
  const tbody = document.getElementById('recipientsTableBody');
  const emptyState = document.getElementById('recipientsEmptyState');
  if (!tbody || !emptyState) return;

  try {
    const res = await fetch(`/api/admin/recipients?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    const recipients = data.recipients || [];

    setStatText('recipientCountBadge', recipients.length);

    if (recipients.length === 0) {
      tbody.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    tbody.innerHTML = recipients.map(r => `
      <tr>
        <td style="font-weight: 600; color: #ffffff;">${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.email)}</td>
        <td><span class="pill-badge pill-format">${escapeHtml(r.group || 'General')}</span></td>
        <td>${formatDate(r.createdAt)}</td>
        <td>${r.sharedLinksCount || 0} link(s)</td>
        <td>
          <div class="table-actions">
            <button class="action-btn-del" onclick="handleDeleteRecipient('${r.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading recipients:', err);
  }
}

// 4. Shared Links Data
async function loadSharedLinksData() {
  const tbody = document.getElementById('linksTableBody');
  const emptyState = document.getElementById('linksEmptyState');
  if (!tbody || !emptyState) return;

  try {
    const res = await fetch('/api/admin/links');
    const data = await res.json();
    const links = data.links || [];

    setStatText('linksCountBadge', links.filter(l => l.status === 'active' && !l.isExpired).length);

    if (links.length === 0) {
      tbody.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    tbody.innerHTML = links.map(link => {
      const isRevoked = link.status === 'revoked';
      const isDisabled = link.status === 'disabled';
      const isExpired = !!link.isExpired;
      const shareUrl = `${window.location.origin}/listen/${link.slug}`;

      let statusBadgeClass = 'pill-active';
      let statusLabel = 'Active';

      if (isRevoked) {
        statusBadgeClass = 'pill-revoked';
        statusLabel = 'Revoked';
      } else if (isDisabled) {
        statusBadgeClass = 'pill-format';
        statusLabel = 'Disabled';
      } else if (isExpired) {
        statusBadgeClass = 'pill-revoked';
        statusLabel = 'Expired';
      }

      const isPassProtected = !!link.isPasswordProtected;

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <code style="color: var(--accent-secondary); font-size: 0.85rem;">/listen/${escapeHtml(link.slug)}</code>
              <button class="action-btn-copy" onclick="copyLinkUrl('${shareUrl}')" style="padding: 2px 6px; font-size: 0.72rem;" title="Copy public link">📋</button>
            </div>
          </td>
          <td><strong>${escapeHtml(link.audioTitle || 'Audio Track')}</strong></td>
          <td>${escapeHtml(link.recipientName || 'Public Link')}</td>
          <td>
            ${isPassProtected 
              ? '<span class="pill-badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);">🔒 Password</span>' 
              : '<span class="pill-badge pill-format">🌐 Public</span>'}
          </td>
          <td>${link.expiresAt ? formatDate(link.expiresAt) : '<span style="color: #34d399; font-weight: 500;">Permanent</span>'}</td>
          <td>
            <span class="pill-badge ${statusBadgeClass}">
              ${statusLabel}
            </span>
          </td>
          <td><strong>${link.clicks || 0}</strong></td>
          <td>
            <div class="table-actions">
              <button class="action-btn-copy" onclick="copyLinkUrl('${shareUrl}')">Copy</button>
              ${!isRevoked ? `
                <button class="action-btn-copy" onclick="handleToggleLink('${link.id}')" style="background: rgba(255,255,255,0.06); color: #cbd5e1;">
                  ${isDisabled ? '▶ Enable' : '⏸ Disable'}
                </button>
                <button class="action-btn-del" onclick="handleRevokeLink('${link.id}')">Revoke</button>
              ` : `
                <button class="action-btn-del" onclick="handlePermanentDeleteLink('${link.id}')">Delete</button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading shared links:', err);
  }
}

// 4b. Listener Responses & Comprehension Data
async function loadResponsesData() {
  const tbody = document.getElementById('responsesTableBody');
  const emptyState = document.getElementById('responsesEmptyState');
  const alertBadge = document.getElementById('unreadResponsesAlertBadge');
  if (!tbody || !emptyState) return;

  try {
    const res = await fetch('/api/admin/responses');
    const data = await res.json();
    const responses = data.responses || [];

    const unreadCount = responses.filter(r => !r.isRead).length;
    if (alertBadge) {
      if (unreadCount > 0) {
        alertBadge.textContent = `● ${unreadCount} Unread`;
        alertBadge.classList.remove('hidden');
      } else {
        alertBadge.classList.add('hidden');
      }
    }

    setStatText('responsesCountBadge', responses.length);

    if (responses.length === 0) {
      tbody.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    tbody.innerHTML = responses.map(item => {
      const isReviewed = item.status === 'reviewed';
      const statusBadge = isReviewed
        ? '<span class="pill-badge pill-active">Reviewed</span>'
        : '<span class="pill-badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);">Pending Review</span>';

      const excerpt = (item.responseText || '').length > 70 
        ? `${escapeHtml((item.responseText || '').slice(0, 70))}...` 
        : escapeHtml(item.responseText || '');

      const isUnread = !item.isRead;
      const unreadTag = isUnread 
        ? `<span style="background: #ef4444; color: #fff; font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-right: 6px; text-transform: uppercase;">NEW</span>`
        : '';

      const listenerDisplay = item.listenerName || item.recipientName || (item.sessionId ? `Session ${item.sessionId.slice(0, 8)}` : 'Anonymous');
      const partDisplay = `Part ${item.partNumber || 1}`;

      const verifiedBadge = item.playbackCompleted !== false
        ? `<span class="pill-badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.78rem;">✓ Verified (100%)</span>`
        : `<span class="pill-badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 0.78rem;">Unverified</span>`;

      return `
        <tr style="${isUnread ? 'background: rgba(99, 102, 241, 0.05);' : ''}">
          <td>${formatDate(item.createdAt)}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="table-badge badge-active" style="background: rgba(99, 102, 241, 0.2); color: #818cf8; font-size: 0.72rem;">${partDisplay}</span>
              <strong style="color: #fff;">${escapeHtml(item.audioTitle || 'Recording')}</strong>
            </div>
          </td>
          <td>
            <div style="font-weight: 500; color: #fff;">${escapeHtml(listenerDisplay)}</div>
            ${item.recipientEmail ? `<div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(item.recipientEmail)}</div>` : ''}
          </td>
          <td>${verifiedBadge}</td>
          <td style="max-width: 280px; font-size: 0.88rem; color: #cbd5e1; font-style: italic;">
            ${unreadTag}"${excerpt}"
          </td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions">
              <button class="action-btn-copy" onclick="openReviewModal('${item.id}')" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3);">
                Review / Read
              </button>
              <button class="action-btn-del" onclick="handleDeleteResponse('${item.id}')">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading responses:', err);
  }
}

// 5. Activity Log Data
async function loadActivityData() {
  const container = document.getElementById('activityTimelineList');
  const emptyState = document.getElementById('activityEmptyState');
  if (!container || !emptyState) return;

  try {
    const res = await fetch('/api/admin/activity');
    const data = await res.json();
    const activities = data.activities || [];

    if (activities.length === 0) {
      container.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    container.innerHTML = activities.map(item => `
      <div class="activity-item">
        <div class="activity-dot"></div>
        <div class="activity-body">
          <div class="activity-header-line">
            <span class="activity-title">${escapeHtml(item.action)}</span>
            <span class="activity-time">${formatDate(item.timestamp)}</span>
          </div>
          <span class="activity-detail">${escapeHtml(item.details)}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading activity:', err);
  }
}

// 6. Link Click Tracking Data
async function loadClickTrackingData() {
  const tbody = document.getElementById('clicksTableBody');
  const emptyState = document.getElementById('clicksEmptyState');
  if (!tbody || !emptyState) return;

  try {
    const res = await fetch('/api/admin/tracking/clicks');
    const data = await res.json();
    const clicks = data.clicks || [];

    if (clicks.length === 0) {
      tbody.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    tbody.innerHTML = clicks.map(c => `
      <tr>
        <td><code>${escapeHtml(c.id)}</code></td>
        <td><code>${escapeHtml(c.slug)}</code></td>
        <td>${escapeHtml(c.ip)}</td>
        <td><small style="color: var(--text-dim);">${escapeHtml(c.userAgent)}</small></td>
        <td>${escapeHtml(c.referrer || 'Direct')}</td>
        <td>${formatDate(c.timestamp)}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading clicks:', err);
  }
}

// 7. Listening Progress Data
async function loadProgressData() {
  const tbody = document.getElementById('progressTableBody');
  const emptyState = document.getElementById('progressEmptyState');
  if (!tbody || !emptyState) return;

  try {
    const res = await fetch('/api/admin/tracking/progress');
    const data = await res.json();
    const progressList = data.progress || [];

    if (progressList.length === 0) {
      tbody.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    tbody.innerHTML = progressList.map(p => {
      const pct = Math.min(100, Math.max(0, p.progressPercent || 0));
      return `
        <tr>
          <td><strong>${escapeHtml(p.audioId)}</strong></td>
          <td>${escapeHtml(p.recipientId)}</td>
          <td>
            <div class="progress-track-wrapper">
              <div class="progress-track-bg">
                <div class="progress-track-fill" style="width: ${pct}%;"></div>
              </div>
            </div>
          </td>
          <td><strong>${pct}%</strong></td>
          <td>${p.durationSeconds || 0}s</td>
          <td>${formatDate(p.timestamp)}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading progress:', err);
  }
}

// 8. Settings Data
async function loadSettingsData() {
  try {
    const res = await fetch('/api/admin/settings');
    const data = await res.json();
    const s = data.settings || {};

    const nameInput = document.getElementById('settingSiteName');
    const emailInput = document.getElementById('settingAdminEmail');
    const sessionInput = document.getElementById('settingSessionHours');
    const expireInput = document.getElementById('settingDefaultExpireDays');
    const trackBox = document.getElementById('settingTrackLocations');

    if (nameInput && s.siteName) nameInput.value = s.siteName;
    if (emailInput && s.adminEmail) emailInput.value = s.adminEmail;
    if (sessionInput && s.sessionTimeoutHours) sessionInput.value = s.sessionTimeoutHours;
    if (expireInput && s.defaultLinkExpirationDays) expireInput.value = s.defaultLinkExpirationDays;
    if (trackBox && typeof s.trackClickLocations === 'boolean') trackBox.checked = s.trackClickLocations;
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

// 9. Welcome Page Presentation Settings Data
let currentWelcomeSettings = null;

async function loadWelcomeSettingsData() {
  try {
    const res = await fetch('/api/admin/welcome-settings');
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load welcome settings');

    const s = data.settings || {};
    currentWelcomeSettings = s;

    const enabledInput = document.getElementById('welcomeEnabledInput');
    const headingInput = document.getElementById('welcomeHeadingInput');
    const descInput = document.getElementById('welcomeDescInput');
    const letterInput = document.getElementById('welcomeLetterBodyInput');
    const disclaimerInput = document.getElementById('welcomeDisclaimerInput');
    const instructionsInput = document.getElementById('welcomeInstructionsInput');
    const thankYouInput = document.getElementById('welcomeThankYouInput');
    const imgPreview = document.getElementById('welcomeImagePreview');

    if (enabledInput) enabledInput.checked = s.enabled !== false;
    if (headingInput) headingInput.value = s.heading || '';
    if (descInput) descInput.value = s.description || '';
    if (letterInput) letterInput.value = s.letterBody || '';
    if (disclaimerInput) disclaimerInput.value = s.disclaimer || '';
    if (instructionsInput) instructionsInput.value = s.listeningInstructions || '';
    if (thankYouInput) thankYouInput.value = s.thankYouMessage || '';
    if (imgPreview && s.imageUrl) imgPreview.src = s.imageUrl;

    updateWelcomeLivePreview(s);
  } catch (err) {
    console.error('Error loading welcome settings:', err);
    showWelcomeAlert('Could not load current welcome settings: ' + err.message, 'error');
  }
}

function updateWelcomeLivePreview(s = {}) {
  const heading = s.heading || (document.getElementById('welcomeHeadingInput')?.value) || 'Welcome to AudioFlow';
  const desc = s.description || (document.getElementById('welcomeDescInput')?.value) || 'Immerse yourself in our audio lessons and curated recordings. Listen attentively to deepen your understanding.';
  const thankYou = s.thankYouMessage || (document.getElementById('welcomeThankYouInput')?.value) || 'Thank you for listening! We appreciate your engagement.';
  const enabled = typeof s.enabled === 'boolean' ? s.enabled : document.getElementById('welcomeEnabledInput')?.checked;
  const imgUrl = s.imageUrl || document.getElementById('welcomeImagePreview')?.src || '/api/public/welcome-image';

  const mockHeading = document.getElementById('mockPreviewHeading');
  const mockDesc = document.getElementById('mockPreviewDesc');
  const mockThankYou = document.getElementById('mockPreviewThankYou');
  const mockImg = document.getElementById('mockPreviewImg');
  const badge = document.getElementById('previewActiveBadge');

  if (mockHeading) mockHeading.textContent = heading;
  if (mockDesc) mockDesc.textContent = desc;
  if (mockThankYou) mockThankYou.textContent = thankYou;
  if (mockImg && imgUrl) mockImg.src = imgUrl;

  if (badge) {
    if (enabled) {
      badge.className = 'table-badge badge-active';
      badge.textContent = 'Active on Public Page';
    } else {
      badge.className = 'table-badge badge-disabled';
      badge.textContent = 'Disabled on Public Page';
    }
  }
}

function showWelcomeAlert(message, type = 'success') {
  const alertEl = document.getElementById('welcomeSettingsAlert');
  if (!alertEl) return;
  alertEl.textContent = message;
  alertEl.className = '';
  if (type === 'success') {
    alertEl.style.background = 'rgba(16, 185, 129, 0.15)';
    alertEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    alertEl.style.color = '#34d399';
  } else {
    alertEl.style.background = 'rgba(239, 68, 68, 0.15)';
    alertEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    alertEl.style.color = '#ef4444';
  }
  alertEl.classList.remove('hidden');
  setTimeout(() => {
    alertEl.classList.add('hidden');
  }, 5000);
}

/**
 * 4. Modals Management
 */
function initModals() {
  bindClick('openAddAudioModalBtn', () => openModal('modalAddAudio'));
  bindClick('emptyAddAudioBtn', () => openModal('modalAddAudio'));

  bindClick('openAddRecipientModalBtn', () => openModal('modalAddRecipient'));
  bindClick('emptyAddRecipientBtn', () => openModal('modalAddRecipient'));

  bindClick('openCreateLinkModalBtn', () => openLinkModal());
  bindClick('emptyCreateLinkBtn', () => openLinkModal());

  // Close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      closeModal(modalId);
    });
  });

  // Close modal when clicking on backdrop
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('hidden');
}

async function openLinkModal(preselectedAudioId = null) {
  // Populate audio and recipient select dropdowns dynamically
  const audioSelect = document.getElementById('linkAudioSelect');
  const recipSelect = document.getElementById('linkRecipientSelect');

  try {
    const [audioRes, recipRes] = await Promise.all([
      fetch('/api/admin/audios'),
      fetch('/api/admin/recipients')
    ]);

    const audioData = await audioRes.json();
    const recipData = await recipRes.json();

    const audios = audioData.audios || [];
    const recips = recipData.recipients || [];

    if (audios.length === 0) {
      showToast('Please upload at least one audio recording before generating links.', 'error');
      openModal('modalAddAudio');
      return;
    }

    audioSelect.innerHTML = audios.map(a => `
      <option value="${a.id}" ${preselectedAudioId === a.id ? 'selected' : ''}>
        ${escapeHtml(a.title)} (${escapeHtml(a.format || 'MP3')})
      </option>
    `).join('');

    recipSelect.innerHTML = `
      <option value="">-- Public / General Link (No Specific Recipient) --</option>
      ${recips.map(r => `<option value="${r.id}">${escapeHtml(r.name)} (${escapeHtml(r.email)})</option>`).join('')}
    `;

    openModal('modalCreateLink');
  } catch (err) {
    showToast('Failed to prepare shared link modal.', 'error');
  }
}

window.openShareModalForAudio = function(audioId) {
  openLinkModal(audioId);
};

/**
 * 5. Form Submissions (Upload Audio, Recipient, Link, Settings)
 */
function initForms() {
  initDropzone();

  // Add Audio with Multer & S3 processing
  const formAudio = document.getElementById('formAddAudio');
  const fileInput = document.getElementById('audioFileInput');
  const progressBox = document.getElementById('uploadProgressContainer');
  const progressFill = document.getElementById('uploadProgressBarFill');
  const percentText = document.getElementById('uploadPercentText');
  const statusText = document.getElementById('uploadStatusText');
  const stageInfo = document.getElementById('uploadStageInfo');
  const submitBtn = document.getElementById('startAudioUploadBtn');
  const cancelBtn = document.getElementById('cancelAudioUploadBtn');

  if (formAudio) {
    formAudio.addEventListener('submit', (e) => {
      e.preventDefault();

      const file = fileInput.files[0];
      if (!file) {
        showToast('Please select an audio file (MP3, WAV, or M4A).', 'error');
        return;
      }

      const title = document.getElementById('audioTitleInput').value.trim();
      const genre = document.getElementById('audioGenreSelect').value;
      const description = document.getElementById('audioDescInput').value.trim();
      const questionEl = document.getElementById('audioQuestionInput');
      const understandingQuestion = questionEl ? questionEl.value.trim() : '';

      const formData = new FormData();
      formData.append('audioFile', file);
      formData.append('title', title);
      formData.append('genre', genre);
      formData.append('description', description);
      if (understandingQuestion) {
        formData.append('understandingQuestion', understandingQuestion);
      }

      // Show upload progress UI
      progressBox.classList.remove('hidden');
      progressFill.style.width = '0%';
      percentText.textContent = '0%';
      statusText.textContent = 'Uploading audio file...';
      stageInfo.textContent = 'Stage 1: Streaming audio to server';
      submitBtn.disabled = true;
      cancelBtn.disabled = true;

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/audios/upload');

      // Track file upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          progressFill.style.width = `${percent}%`;
          percentText.textContent = `${percent}%`;

          if (percent >= 98) {
            statusText.textContent = 'Transcoding to 128 kbps MP3 via FFmpeg...';
            stageInfo.textContent = 'Stage 2: FFmpeg 128 kbps compression & Filebase S3 store';
          }
        }
      };

      xhr.onload = () => {
        submitBtn.disabled = false;
        cancelBtn.disabled = false;

        if (xhr.status === 201) {
          progressFill.style.width = '100%';
          percentText.textContent = '100%';
          statusText.textContent = 'Upload & Processing Complete!';

          setTimeout(() => {
            formAudio.reset();
            resetDropzone();
            progressBox.classList.add('hidden');
            closeModal('modalAddAudio');
            showToast('Audio converted to 128kbps MP3 and uploaded to Filebase S3!', 'success');
            loadOverviewData();
            loadAudioData();
          }, 600);
        } else {
          progressBox.classList.add('hidden');
          try {
            const err = JSON.parse(xhr.responseText);
            showToast(err.error || 'Upload failed', 'error');
          } catch {
            showToast('Upload or processing failed. Check server log.', 'error');
          }
        }
      };

      xhr.onerror = () => {
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
        progressBox.classList.add('hidden');
        showToast('Network error during audio upload.', 'error');
      };

      xhr.send(formData);
    });
  }

  // Add Recipient
  const formRecip = document.getElementById('formAddRecipient');
  if (formRecip) {
    formRecip.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('recipNameInput').value.trim();
      const email = document.getElementById('recipEmailInput').value.trim();
      const group = document.getElementById('recipGroupInput').value.trim();
      const notes = document.getElementById('recipNotesInput').value.trim();

      try {
        const res = await fetch('/api/admin/recipients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, group, notes })
        });

        if (res.ok) {
          formRecip.reset();
          closeModal('modalAddRecipient');
          showToast('Recipient added successfully!', 'success');
          loadOverviewData();
          loadRecipientsData();
        } else {
          const err = await res.json();
          showToast(err.error || 'Failed to add recipient', 'error');
        }
      } catch (err) {
        showToast('Connection error', 'error');
      }
    });
  }

  // Toggle Password Box in Shared Link Modal
  const enablePassCheck = document.getElementById('linkEnablePassword');
  const passBox = document.getElementById('linkPasswordBox');
  if (enablePassCheck && passBox) {
    enablePassCheck.addEventListener('change', () => {
      if (enablePassCheck.checked) {
        passBox.classList.remove('hidden');
        document.getElementById('linkPasswordInput').focus();
      } else {
        passBox.classList.add('hidden');
        document.getElementById('linkPasswordInput').value = '';
      }
    });
  }

  // Create Shared Link
  const formLink = document.getElementById('formCreateLink');
  if (formLink) {
    formLink.addEventListener('submit', async (e) => {
      e.preventDefault();
      const audioId = document.getElementById('linkAudioSelect').value;
      const recipientId = document.getElementById('linkRecipientSelect').value || null;
      const expiresOption = document.getElementById('linkExpiresOption').value;
      const notes = document.getElementById('linkNotesInput').value.trim();
      const password = (enablePassCheck && enablePassCheck.checked) 
        ? document.getElementById('linkPasswordInput').value.trim() 
        : null;

      try {
        const res = await fetch('/api/admin/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioId, recipientId, expiresOption, notes, password })
        });

        if (res.ok) {
          const data = await res.json();
          const shareUrl = `${window.location.origin}/listen/${data.link.slug}`;
          
          formLink.reset();
          if (passBox) passBox.classList.add('hidden');
          closeModal('modalCreateLink');

          copyLinkUrl(shareUrl);
          showToast('Secure sharing link generated and copied to clipboard!', 'success');
          
          loadOverviewData();
          loadSharedLinksData();
        } else {
          const err = await res.json();
          showToast(err.error || 'Failed to generate link', 'error');
        }
      } catch (err) {
        showToast('Connection error', 'error');
      }
    });
  }

  // Edit Audio Metadata
  const formEditAudio = document.getElementById('formEditAudio');
  if (formEditAudio) {
    formEditAudio.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('editAudioIdInput').value;
      const title = document.getElementById('editAudioTitleInput').value.trim();
      const genre = document.getElementById('editAudioGenreSelect').value;
      const description = document.getElementById('editAudioDescInput').value.trim();
      const questionEl = document.getElementById('editAudioQuestionInput');
      const nextAudioEl = document.getElementById('editNextAudioSelect');
      const understandingQuestion = questionEl ? questionEl.value.trim() : undefined;
      const nextAudioId = nextAudioEl ? (nextAudioEl.value || null) : undefined;
      const saveBtn = document.getElementById('saveEditAudioBtn');

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
      }

      try {
        const res = await fetch(`/api/admin/audios/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, genre, description, understandingQuestion, nextAudioId })
        });

        if (res.ok) {
          closeModal('modalEditAudio');
          showToast('Audio information updated successfully!', 'success');
          loadOverviewData();
          loadAudioData();
        } else {
          const err = await res.json();
          showToast(err.error || 'Failed to update audio', 'error');
        }
      } catch (err) {
        showToast('Connection error', 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
        }
      }
    });
  }

  // Review Response Form
  const formReview = document.getElementById('formReviewResponse');
  if (formReview) {
    formReview.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('reviewResponseId').value;
      const adminNotes = document.getElementById('reviewAdminNotes').value.trim();
      const status = document.getElementById('reviewStatusSelect').value;

      try {
        const res = await fetch(`/api/admin/responses/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminNotes, status })
        });

        if (res.ok) {
          closeModal('modalReviewResponse');
          showToast('Listener reflection review saved successfully!', 'success');
          loadResponsesData();
        } else {
          const err = await res.json();
          showToast(err.error || 'Failed to update review', 'error');
        }
      } catch (err) {
        showToast('Connection error updating review', 'error');
      }
    });
  }

  // Change Admin Password Form
  const formPassword = document.getElementById('changePasswordForm');
  if (formPassword) {
    formPassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('currentPasswordInput').value;
      const newPassword = document.getElementById('newPasswordInput').value;
      const confirmPassword = document.getElementById('confirmPasswordInput').value;

      if (newPassword !== confirmPassword) {
        showToast('New passwords do not match.', 'error');
        return;
      }

      if (newPassword.length < 8) {
        showToast('New password must be at least 8 characters.', 'error');
        return;
      }

      try {
        const res = await fetch('/api/admin/settings/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword })
        });

        const result = await res.json();
        if (res.ok && result.success) {
          formPassword.reset();
          showToast('Admin password changed successfully!', 'success');
          loadActivityData();
        } else {
          showToast(result.error || 'Failed to update password.', 'error');
        }
      } catch (err) {
        showToast('Connection error updating password.', 'error');
      }
    });
  }

  // Save Settings
  const formSettings = document.getElementById('settingsForm');
  if (formSettings) {
    formSettings.addEventListener('submit', async (e) => {
      e.preventDefault();
      const siteName = document.getElementById('settingSiteName').value.trim();
      const adminEmail = document.getElementById('settingAdminEmail').value.trim();
      const sessionTimeoutHours = Number(document.getElementById('settingSessionHours').value) || 24;
      const defaultLinkExpirationDays = Number(document.getElementById('settingDefaultExpireDays').value) || 7;
      const trackClickLocations = document.getElementById('settingTrackLocations').checked;

      try {
        const res = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteName, adminEmail, sessionTimeoutHours, defaultLinkExpirationDays, trackClickLocations })
        });

        if (res.ok) {
          showToast('Settings saved successfully!', 'success');
          loadActivityData();
        } else {
          showToast('Failed to save settings', 'error');
        }
      } catch (err) {
        showToast('Connection error', 'error');
      }
    });
  }

  // Welcome Page Settings Form Listeners & Real-Time Preview
  const formWelcome = document.getElementById('formWelcomeSettings');
  const chooseImageBtn = document.getElementById('chooseImageBtn');
  const welcomeImageFileInput = document.getElementById('welcomeImageFileInput');
  const welcomeHeadingInput = document.getElementById('welcomeHeadingInput');
  const welcomeDescInput = document.getElementById('welcomeDescInput');
  const welcomeLetterInput = document.getElementById('welcomeLetterBodyInput');
  const welcomeDisclaimerInput = document.getElementById('welcomeDisclaimerInput');
  const welcomeInstructionsInput = document.getElementById('welcomeInstructionsInput');
  const welcomeThankYouInput = document.getElementById('welcomeThankYouInput');
  const welcomeEnabledInput = document.getElementById('welcomeEnabledInput');
  const resetWelcomeBtn = document.getElementById('resetWelcomeSettingsBtn');

  // Live preview typing listeners
  [welcomeHeadingInput, welcomeDescInput, welcomeLetterInput, welcomeDisclaimerInput, welcomeInstructionsInput, welcomeThankYouInput].forEach(input => {
    if (input) {
      input.addEventListener('input', () => updateWelcomeLivePreview());
    }
  });
  if (welcomeEnabledInput) {
    welcomeEnabledInput.addEventListener('change', () => updateWelcomeLivePreview());
  }

  // Image file select trigger
  if (chooseImageBtn && welcomeImageFileInput) {
    chooseImageBtn.addEventListener('click', () => welcomeImageFileInput.click());
  }

  // When image file is picked
  if (welcomeImageFileInput) {
    welcomeImageFileInput.addEventListener('change', async () => {
      const file = welcomeImageFileInput.files[0];
      if (!file) return;

      const filenameEl = document.getElementById('selectedImageFilename');
      if (filenameEl) filenameEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

      // Instant local preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewUrl = e.target.result;
        const imgEl = document.getElementById('welcomeImagePreview');
        const mockEl = document.getElementById('mockPreviewImg');
        if (imgEl) imgEl.src = previewUrl;
        if (mockEl) mockEl.src = previewUrl;
      };
      reader.readAsDataURL(file);

      // Client-side quick check: 25 MB limit
      const MAX_SIZE_BYTES = 25 * 1024 * 1024;
      if (file.size > MAX_SIZE_BYTES) {
        showWelcomeAlert(`The selected image (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 25 MB limit. Please select a smaller image.`, 'error');
        showToast('Image file too large (max 25 MB).', 'error');
        return;
      }

      // Upload image to Filebase S3
      const spinner = document.getElementById('imageUploadSpinner');
      if (spinner) spinner.classList.remove('hidden');

      const formData = new FormData();
      formData.append('welcomeImage', file);

      try {
        const res = await fetch('/api/admin/welcome-settings/image', {
          method: 'POST',
          headers: {
            'Accept': 'application/json'
          },
          body: formData
        });

        const contentType = res.headers.get('content-type') || '';
        let result;
        if (contentType.includes('application/json')) {
          result = await res.json();
        } else {
          const rawText = await res.text();
          if (res.status === 401 || rawText.includes('login') || rawText.includes('Unauthorized')) {
            showToast('Admin session expired. Please log in again.', 'error');
            setTimeout(() => { window.location.href = '/login.html'; }, 1500);
            return;
          }
          throw new Error(`Server returned status ${res.status}: ${rawText.replace(/<[^>]*>/g, '').trim().substring(0, 120)}`);
        }

        if (!res.ok || !result.success) {
          throw new Error(result.error || 'Failed to upload image.');
        }

        showWelcomeAlert('Welcome image uploaded and stored in Filebase successfully!', 'success');
        showToast('Image stored securely in Filebase S3.', 'success');
        if (result.settings) {
          currentWelcomeSettings = result.settings;
          const imgPreview = document.getElementById('welcomeImagePreview');
          if (imgPreview && result.settings.imageUrl) {
            imgPreview.src = result.settings.imageUrl;
          }
          updateWelcomeLivePreview(result.settings);
        }
      } catch (uploadErr) {
        console.error('Welcome image upload error:', uploadErr);
        showWelcomeAlert(uploadErr.message, 'error');
        showToast(uploadErr.message, 'error');
      } finally {
        if (spinner) spinner.classList.add('hidden');
      }
    });
  }

  // Save Welcome Settings Form Submit
  if (formWelcome) {
    formWelcome.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('saveWelcomeSettingsBtn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin:0 6px 0 0;vertical-align:middle;"></span> Saving...';
      }

      try {
        const res = await fetch('/api/admin/welcome-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            heading: welcomeHeadingInput ? welcomeHeadingInput.value.trim() : '',
            description: welcomeDescInput ? welcomeDescInput.value.trim() : '',
            letterBody: welcomeLetterInput ? welcomeLetterInput.value.trim() : '',
            disclaimer: welcomeDisclaimerInput ? welcomeDisclaimerInput.value.trim() : '',
            listeningInstructions: welcomeInstructionsInput ? welcomeInstructionsInput.value.trim() : '',
            thankYouMessage: welcomeThankYouInput ? welcomeThankYouInput.value.trim() : '',
            enabled: welcomeEnabledInput ? welcomeEnabledInput.checked : true
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to save welcome settings.');
        }

        currentWelcomeSettings = data.settings;
        updateWelcomeLivePreview(data.settings);
        showWelcomeAlert('Welcome page settings saved persistently in MongoDB!', 'success');
        showToast('Welcome page settings updated successfully.', 'success');
      } catch (err) {
        console.error('Error saving welcome settings:', err);
        showWelcomeAlert(err.message, 'error');
        showToast(err.message, 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
        }
      }
    });
  }

  // Reset button handler
  if (resetWelcomeBtn) {
    resetWelcomeBtn.addEventListener('click', () => {
      if (currentWelcomeSettings) {
        const enabledInput = document.getElementById('welcomeEnabledInput');
        const headingInput = document.getElementById('welcomeHeadingInput');
        const descInput = document.getElementById('welcomeDescInput');
        const letterInput = document.getElementById('welcomeLetterBodyInput');
        const disclaimerInput = document.getElementById('welcomeDisclaimerInput');
        const instructionsInput = document.getElementById('welcomeInstructionsInput');
        const thankYouInput = document.getElementById('welcomeThankYouInput');
        const imgPreview = document.getElementById('welcomeImagePreview');

        if (enabledInput) enabledInput.checked = currentWelcomeSettings.enabled !== false;
        if (headingInput) headingInput.value = currentWelcomeSettings.heading || '';
        if (descInput) descInput.value = currentWelcomeSettings.description || '';
        if (letterInput) letterInput.value = currentWelcomeSettings.letterBody || '';
        if (disclaimerInput) disclaimerInput.value = currentWelcomeSettings.disclaimer || '';
        if (instructionsInput) instructionsInput.value = currentWelcomeSettings.listeningInstructions || '';
        if (thankYouInput) thankYouInput.value = currentWelcomeSettings.thankYouMessage || '';
        if (imgPreview && currentWelcomeSettings.imageUrl) imgPreview.src = currentWelcomeSettings.imageUrl;

        updateWelcomeLivePreview(currentWelcomeSettings);
        showToast('Settings restored to current server values.', 'info');
      }
    });
  }
}

/**
 * 6. Global Delete & Action Handlers
 */
window.openEditAudioModal = async function(id) {
  if (!id) return;

  try {
    // 1. Check in-memory cache first for instant opening
    let audio = null;
    if (window.audiosCache && Array.isArray(window.audiosCache)) {
      audio = window.audiosCache.find(a => a.id === id || a._id === id);
    }

    // 2. Fetch fresh details from backend if not in cache
    if (!audio) {
      const audioRes = await fetch(`/api/admin/audios/${encodeURIComponent(id)}`);
      if (audioRes.ok) {
        const data = await audioRes.json();
        audio = data.audio;
      }
    }

    if (!audio) {
      showToast('Audio record not found.', 'error');
      return;
    }

    // 3. Populate Modal Form Fields
    const idInput = document.getElementById('editAudioIdInput');
    const titleInput = document.getElementById('editAudioTitleInput');
    const genreSelect = document.getElementById('editAudioGenreSelect');
    const descInput = document.getElementById('editAudioDescInput');
    const questionInput = document.getElementById('editAudioQuestionInput');
    const nextAudioSelect = document.getElementById('editNextAudioSelect');

    if (idInput) idInput.value = audio.id;
    if (titleInput) titleInput.value = audio.title || '';
    if (descInput) descInput.value = audio.description || '';
    if (questionInput) {
      questionInput.value = audio.understandingQuestion || 'What did you understand from this audio lesson? Please summarize your key takeaways in your own words.';
    }

    // Populate and select genre safely
    if (genreSelect) {
      const g = (audio.genre || 'General').trim();
      let match = Array.from(genreSelect.options).find(o => o.value.toLowerCase() === g.toLowerCase());
      if (match) {
        genreSelect.value = match.value;
      } else {
        const newOpt = document.createElement('option');
        newOpt.value = g;
        newOpt.textContent = g;
        newOpt.selected = true;
        genreSelect.appendChild(newOpt);
      }
    }

    // 4. Open modal immediately
    openModal('modalEditAudio');

    // 5. Populate next audio sequence list non-blockingly
    if (nextAudioSelect) {
      fetch('/api/admin/audios')
        .then(r => r.json())
        .then(allData => {
          const otherAudios = (allData.audios || []).filter(a => a.id !== audio.id);
          nextAudioSelect.innerHTML = `
            <option value="">-- Automatically Follow Sequential Order --</option>
            ${otherAudios.map(a => `
              <option value="${a.id}" ${audio.nextAudioId === a.id ? 'selected' : ''}>
                ${escapeHtml(a.title)} (${escapeHtml(a.format || 'MP3')})
              </option>
            `).join('')}
          `;
        })
        .catch(() => {});
    }
  } catch (err) {
    console.error('Error opening edit audio modal:', err);
    showToast('Failed to load audio for editing.', 'error');
  }
};

window.openReviewModal = async function(id) {
  try {
    const res = await fetch(`/api/admin/responses/${id}`);
    if (!res.ok) throw new Error('Could not fetch response details');
    const data = await res.json();
    const resp = data.response;

    document.getElementById('reviewResponseId').value = resp.id;
    const partBadge = document.getElementById('reviewPartNumber');
    if (partBadge) partBadge.textContent = `Part ${resp.partNumber || 1}`;
    document.getElementById('reviewAudioTitle').textContent = resp.audioTitle || 'Audio Lesson';
    document.getElementById('reviewSubmittedAt').textContent = formatDate(resp.createdAt);

    const listenerText = resp.listenerName || resp.recipientName || (resp.sessionId ? `Session ${resp.sessionId.slice(0, 10)}` : 'Anonymous');
    document.getElementById('reviewListenerName').textContent = `${listenerText} ${resp.recipientEmail ? `(${resp.recipientEmail})` : ''}`;

    const verifiedEl = document.getElementById('reviewVerifiedStatus');
    if (verifiedEl) {
      verifiedEl.innerHTML = resp.playbackCompleted !== false
        ? '<span class="pill-badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.78rem;">✓ Playback Verified (100%)</span>'
        : '<span class="pill-badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 0.78rem;">Unverified Playback</span>';
    }

    document.getElementById('reviewQuestionAsked').textContent = resp.question || 'What did you understand from this recording?';
    document.getElementById('reviewResponseText').textContent = resp.responseText || '';
    document.getElementById('reviewAdminNotes').value = resp.adminNotes || '';
    document.getElementById('reviewStatusSelect').value = resp.status || 'submitted';

    openModal('modalReviewResponse');

    // Instantly refresh overview stats & responses to reflect unread count drop
    loadOverviewData();
    loadResponsesData();
  } catch (err) {
    showToast('Failed to load response details for review', 'error');
  }
};

window.handleDeleteResponse = async function(id) {
  if (!confirm('Are you sure you want to remove this listener response?')) return;
  try {
    const res = await fetch(`/api/admin/responses/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Listener response removed successfully.', 'success');
      loadResponsesData();
      loadOverviewData();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to delete response', 'error');
    }
  } catch (err) {
    showToast('Connection error deleting response', 'error');
  }
};

window.handleToggleLink = async function(id) {
  try {
    const res = await fetch(`/api/admin/links/${id}/toggle`, { method: 'PATCH' });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Link status updated', 'success');
      loadOverviewData();
      loadSharedLinksData();
    } else {
      showToast(data.error || 'Failed to update link status', 'error');
    }
  } catch (err) {
    showToast('Connection error', 'error');
  }
};

window.handlePermanentDeleteLink = async function(id) {
  if (!confirm('Permanently delete this link from the system?')) return;
  try {
    const res = await fetch(`/api/admin/links/${id}/permanent`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Shared link permanently deleted', 'success');
      loadOverviewData();
      loadSharedLinksData();
    } else {
      showToast('Could not delete link', 'error');
    }
  } catch (err) {
    showToast('Connection error', 'error');
  }
};

window.handleDeleteAudio = async function(id) {
  if (!confirm('Are you sure you want to delete this audio record?')) return;
  try {
    const res = await fetch(`/api/admin/audios/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Audio deleted from library', 'success');
      loadOverviewData();
      loadAudioData();
    } else {
      showToast('Could not delete audio', 'error');
    }
  } catch (err) {
    showToast('Connection error', 'error');
  }
};

window.handleDeleteRecipient = async function(id) {
  if (!confirm('Are you sure you want to remove this recipient?')) return;
  try {
    const res = await fetch(`/api/admin/recipients/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Recipient removed', 'success');
      loadOverviewData();
      loadRecipientsData();
    } else {
      showToast('Could not delete recipient', 'error');
    }
  } catch (err) {
    showToast('Connection error', 'error');
  }
};

window.handleRevokeLink = async function(id) {
  if (!confirm('Are you sure you want to revoke this shared link? Access will be immediately disabled.')) return;
  try {
    const res = await fetch(`/api/admin/links/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Shared link revoked', 'success');
      loadOverviewData();
      loadSharedLinksData();
    } else {
      showToast('Could not revoke link', 'error');
    }
  } catch (err) {
    showToast('Connection error', 'error');
  }
};

window.copyLinkUrl = function(url) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied to clipboard!', 'success');
    }).catch(() => {
      fallbackCopyText(url);
    });
  } else {
    fallbackCopyText(url);
  }
};

function fallbackCopyText(url) {
  try {
    const tempInput = document.createElement('textarea');
    tempInput.value = url;
    tempInput.style.position = 'fixed';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);
    tempInput.focus();
    tempInput.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(tempInput);
    if (successful) {
      showToast('Link copied to clipboard!', 'success');
      return;
    }
  } catch (e) {}
  prompt('Copy this shared link URL:', url);
}

/**
 * 7. Logout Handlers
 */
function initLogout() {
  const sidebarLogout = document.getElementById('logoutSidebarBtn');
  const quickLogout = document.getElementById('quickLogoutBtn');

  const executeLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        window.location.replace('/login.html');
      } else {
        alert('Could not end session. Please refresh.');
      }
    } catch (err) {
      window.location.replace('/login.html');
    }
  };

  if (sidebarLogout) sidebarLogout.addEventListener('click', executeLogout);
  if (quickLogout) quickLogout.addEventListener('click', executeLogout);
}

/**
 * Utilities
 */
function bindClick(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

function setStatText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toastNotification');
  const toastMsg = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');
  if (!toast || !toastMsg) return;

  toast.className = `toast-notification ${type}`;
  toastMsg.textContent = msg;
  if (toastIcon) {
    toastIcon.textContent = type === 'success' ? '✓' : '⚠️';
  }

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

function formatDate(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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

function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}


/**
 * 8. Audio Dropzone & Preview Dock Management
 */
function initDropzone() {
  const dropzone = document.getElementById('audioDropzone');
  const fileInput = document.getElementById('audioFileInput');
  const titleInput = document.getElementById('audioTitleInput');
  const badge = document.getElementById('fileSelectedBadge');
  const nameEl = document.getElementById('selectedFileName');
  const sizeEl = document.getElementById('selectedFileSize');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      fileInput.files = files;
      handleFileSelected(files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  function handleFileSelected(file) {
    if (!badge || !nameEl || !sizeEl) return;
    badge.classList.remove('hidden');
    nameEl.textContent = file.name;
    const mbSize = (file.size / (1024 * 1024)).toFixed(1);
    sizeEl.textContent = `${mbSize} MB`;

    // Auto-fill Title if empty
    if (titleInput && !titleInput.value.trim()) {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      titleInput.value = cleanTitle;
    }
  }

  // Floating dock close button
  const closeDockBtn = document.getElementById('closeDockBtn');
  const audioPlayer = document.getElementById('dashboardAudioPlayer');
  const audioDock = document.getElementById('adminAudioDock');

  if (closeDockBtn && audioPlayer && audioDock) {
    closeDockBtn.addEventListener('click', () => {
      audioPlayer.pause();
      audioPlayer.src = '';
      audioDock.classList.add('hidden');
    });
  }
}

function resetDropzone() {
  const badge = document.getElementById('fileSelectedBadge');
  if (badge) badge.classList.add('hidden');
}

/**
 * Global audio preview playback (streams directly from Filebase S3)
 */
window.playAudioPreview = function(id, title, streamUrl) {
  const audioDock = document.getElementById('adminAudioDock');
  const player = document.getElementById('dashboardAudioPlayer');
  const titleEl = document.getElementById('dockTrackTitle');

  if (!audioDock || !player) return;

  if (titleEl) titleEl.textContent = title || 'Audio Preview';

  audioDock.classList.remove('hidden');
  player.src = streamUrl;
  player.play().catch(err => {
    console.warn('Playback error or blocked by autoplay policy:', err.message);
  });
};
