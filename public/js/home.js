/**
 * AudioFlow - Homepage Controller
 * Powers the Premium Personal Message & Voice Recording Experience.
 * 
 * Features:
 * - Editorial Digital Letter with Admin-Uploaded Photo, Written Letter, Disclaimer & Instructions
 * - "I Have Read and Understood" reading confirmation gate before proceeding to voice recordings
 * - Clean, distraction-free voice recording player (Recording 01, Play/Pause, Replay, Timeline, Speed: 1x, 1.5x, 2x)
 * - Anti-Seeking backend telemetry & playback verification
 * - Understanding Reflection Form with review-before-submit
 * - MongoDB persistence & dynamic next recording unlock
 * - Full sequential journey tracking & replayability
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - Views
  const loadingView = document.getElementById('loadingView');
  const emptyView = document.getElementById('emptyView');
  const playerView = document.getElementById('playerView');

  // DOM Elements - Editorial Welcome Letter
  const welcomeCard = document.getElementById('welcomeIntroCard');
  const welcomeImg = document.getElementById('welcomeIntroImg');
  const welcomeHeading = document.getElementById('welcomeIntroHeading');
  const welcomeDesc = document.getElementById('welcomeIntroDesc');
  const welcomeLetterBody = document.getElementById('welcomeLetterBody');
  const welcomeDisclaimerText = document.getElementById('welcomeDisclaimerText');
  const welcomeInstructionsText = document.getElementById('welcomeInstructionsText');
  const welcomeThankYou = document.getElementById('welcomeIntroThankYou');
  const readConfirmCheckbox = document.getElementById('readConfirmCheckbox');
  const startListeningBtn = document.getElementById('startListeningBtn');

  // DOM Elements - Recording Metadata
  const trackPartBadge = document.getElementById('trackPartBadge');
  const trackTitle = document.getElementById('trackTitle');

  // DOM Elements - Audio Player
  const audio = document.getElementById('audio') || document.getElementById('audioStream');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const replayBtn = document.getElementById('replayBtn');
  const skipBackBtn = document.getElementById('skipBackBtn');
  const skipFwdBtn = document.getElementById('skipFwdBtn');
  const timeBarWrapper = document.getElementById('timeBarWrapper');
  const timeBarFill = document.getElementById('timeBarFill');
  const currentTimeText = document.getElementById('currentTimeText');
  const durationText = document.getElementById('durationText');

  // Speed Pills Group
  const speedPillsGroup = document.getElementById('speedPillsGroup');

  // DOM Elements - Understanding & Response
  const understandingSection = document.getElementById('understandingSection');
  const understandingQuestionText = document.getElementById('understandingQuestionText');
  const completionVerifiedTag = document.getElementById('completionVerifiedTag');
  const seekingAlertBanner = document.getElementById('seekingAlertBanner');
  const responseInputContainer = document.getElementById('responseInputContainer');
  const responseTextarea = document.getElementById('responseTextarea');
  const responseWordCount = document.getElementById('responseWordCount');
  const responsePreviewBox = document.getElementById('responsePreviewBox');
  const previewResponseContent = document.getElementById('previewResponseContent');
  const responseSuccessBanner = document.getElementById('responseSuccessBanner');
  const nextLessonUnlockBanner = document.getElementById('nextLessonUnlockBanner');
  const nextLessonTitle = document.getElementById('nextLessonTitle');
  const nextLessonBtn = document.getElementById('nextLessonBtn');
  const reviewResponseBtn = document.getElementById('reviewResponseBtn');
  const submitResponseBtn = document.getElementById('submitResponseBtn');
  const editResponseBtn = document.getElementById('editResponseBtn');
  const understandingForm = document.getElementById('understandingForm');

  // Sequential Journey Elements
  const sequentialJourneyCard = document.getElementById('sequentialJourneyCard');
  const sequenceListContainer = document.getElementById('sequenceListContainer');
  const journeyProgressBadge = document.getElementById('journeyProgressBadge');

  // State
  let currentSequence = [];
  let activeAudioId = null;
  let activePartNumber = 1;
  let currentSpeed = 1.0;
  let progressInterval = null;
  let hasRevealedUnderstanding = false;
  let hasConfirmedRead = false;

  function getClientSessionId() {
    let sid = localStorage.getItem('audioflow_client_sid');
    if (!sid) {
      sid = 'cli-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('audioflow_client_sid', sid);
    }
    return sid;
  }

  // Initialize
  initWelcomeListeners();
  initSpeedControls();
  fetchHomepageSequence();

  /**
   * 1. Welcome Letter Presentation
   */
  function renderWelcomePresentation(settings) {
    if (!welcomeCard) return;
    if (!settings || settings.enabled === false) {
      welcomeCard.classList.add('hidden');
      return;
    }

    if (welcomeHeading) {
      welcomeHeading.textContent = settings.heading || 'A Message Especially for You';
    }
    if (welcomeDesc) {
      welcomeDesc.textContent = settings.description || 'I have something important and personal that I would like to share with you. Please take a moment to read this message before continuing.';
    }
    if (welcomeLetterBody && settings.letterBody) {
      welcomeLetterBody.textContent = settings.letterBody;
    }
    if (welcomeDisclaimerText && settings.disclaimer) {
      welcomeDisclaimerText.innerHTML = `<strong>Private &amp; Confidential:</strong> ${escapeHtml(settings.disclaimer)}`;
    }
    if (welcomeInstructionsText && settings.listeningInstructions) {
      welcomeInstructionsText.innerHTML = `<strong>Listening Instructions:</strong> ${escapeHtml(settings.listeningInstructions)}`;
    }
    if (welcomeThankYou) {
      welcomeThankYou.textContent = settings.thankYouMessage || 'Thank you for your time, care, and attentive listening.';
    }
    if (welcomeImg && settings.imageUrl) {
      welcomeImg.src = settings.imageUrl;
    }

    welcomeCard.classList.remove('hidden');
  }

  function initWelcomeListeners() {
    // Reading confirmation checkbox
    if (readConfirmCheckbox && startListeningBtn) {
      readConfirmCheckbox.addEventListener('change', () => {
        hasConfirmedRead = readConfirmCheckbox.checked;
        startListeningBtn.disabled = !hasConfirmedRead;
      });

      startListeningBtn.addEventListener('click', () => {
        if (!hasConfirmedRead) {
          alert('Please check "I Have Read and Understood" before continuing to the voice recordings.');
          return;
        }

        if (playerView) {
          playerView.classList.remove('hidden');
          setTimeout(() => {
            playerView.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }

        if (sequentialJourneyCard && currentSequence.length > 0) {
          sequentialJourneyCard.classList.remove('hidden');
        }

        if (audio && audio.paused) {
          audio.play().catch(e => console.log('Playback start notice:', e));
        }
      });
    }

    // Dynamic fetch of latest welcome settings
    fetch('/api/public/welcome-settings')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.settings) {
          renderWelcomePresentation(d.settings);
        }
      })
      .catch(e => console.warn('Welcome settings notice:', e));
  }

  /**
   * 2. Dedicated Playback Speed Controls
   * Options: 1x (Normal), 1.5x, 2x (Maximum strictly enforced)
   */
  function initSpeedControls() {
    if (!speedPillsGroup) return;

    speedPillsGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.speed-pill-btn');
      if (!btn) return;
      const speedVal = parseFloat(btn.getAttribute('data-speed'));
      if (isNaN(speedVal)) return;

      setPlaybackSpeed(speedVal);
    });
  }

  function setPlaybackSpeed(speedVal) {
    const speed = Math.min(2.0, Math.max(0.5, Number(speedVal) || 1.0));
    currentSpeed = speed;

    if (audio) {
      audio.playbackRate = currentSpeed;
    }

    // Update active pill styling
    document.querySelectorAll('.speed-pill-btn').forEach(b => {
      const bSpeed = parseFloat(b.getAttribute('data-speed'));
      if (Math.abs(bSpeed - currentSpeed) < 0.05) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    sendTelemetryProgress();
  }

  /**
   * 3. Fetch Homepage Audio Sequence & Settings
   */
  async function fetchHomepageSequence() {
    try {
      const sid = getClientSessionId();
      const res = await fetch(`/api/public/sequence?sessionId=${encodeURIComponent(sid)}`);
      const data = await res.json();

      if (loadingView) loadingView.classList.add('hidden');

      if (data && data.welcomeSettings) {
        renderWelcomePresentation(data.welcomeSettings);
      }

      currentSequence = data.sequence || [];

      if (currentSequence.length === 0) {
        if (emptyView) emptyView.classList.remove('hidden');
        return;
      }

      // First unlocked recording without response, or first recording
      let initialItem = currentSequence.find(s => s.isUnlocked && !s.hasResponse);
      if (!initialItem) {
        initialItem = currentSequence[0];
      }

      loadActiveTrack(initialItem);
      renderSequenceJourney(currentSequence);

      bindPlayerControls();
      startProgressTelemetry();
      initUnderstandingSystem();
    } catch (err) {
      console.error('Failed to load audio sequence:', err);
      if (loadingView) loadingView.classList.add('hidden');
    }
  }

  /**
   * 4. Load Active Recording Track
   */
  function loadActiveTrack(item) {
    if (!item) return;

    activeAudioId = item.id || item.audioId;
    activePartNumber = item.partNumber || 1;
    hasRevealedUnderstanding = false;

    // Reset progress UI
    if (timeBarFill) timeBarFill.style.width = '0%';
    if (currentTimeText) currentTimeText.textContent = '0:00';
    if (completionVerifiedTag) completionVerifiedTag.classList.add('hidden');
    if (seekingAlertBanner) seekingAlertBanner.classList.add('hidden');
    if (nextLessonUnlockBanner) nextLessonUnlockBanner.classList.add('hidden');

    // Recording metadata (Clean editorial labels)
    if (trackPartBadge) {
      trackPartBadge.textContent = `Recording 0${activePartNumber}`;
    }
    if (trackTitle) {
      trackTitle.textContent = item.title || 'Personal Voice Message';
    }

    // Set stream URL
    if (audio) {
      audio.src = `/api/public/sequence-stream/${activeAudioId}`;
      audio.playbackRate = currentSpeed;
    }

    // Question text
    const qText = item.understandingQuestion || 'What did you understand from my message?';
    if (understandingQuestionText) {
      understandingQuestionText.textContent = qText;
    }

    // Check existing response
    checkExistingResponseForTrack(activeAudioId);

    // Refresh sequence list highlight
    updateSequenceListHighlight();
  }

  /**
   * 5. Sequence Journey Chapters List
   */
  function renderSequenceJourney(sequence) {
    if (!sequentialJourneyCard || !sequenceListContainer) return;

    currentSequence = sequence || [];

    if (currentSequence.length === 0) {
      sequentialJourneyCard.classList.add('hidden');
      return;
    }

    // Counter badge
    const completedCount = currentSequence.filter(s => s.hasResponse && s.playbackCompleted).length;
    if (journeyProgressBadge) {
      journeyProgressBadge.textContent = `${completedCount} of ${currentSequence.length} Completed`;
    }

    sequenceListContainer.innerHTML = currentSequence.map((item) => {
      const isCompleted = item.hasResponse && item.playbackCompleted;
      const itemId = item.id || item.audioId;
      const isCurrent = itemId === activeAudioId;
      const isUnlocked = item.isUnlocked || item.status === 'unlocked' || item.status === 'completed';

      let statusBadge = '';
      let itemClass = '';
      let clickAttr = '';

      if (isCompleted) {
        itemClass = 'completed';
        statusBadge = `
          <span style="font-size: 0.78rem; color: #166534; font-weight: 600;">
            ✓ Completed &bull; Replay
          </span>
        `;
        clickAttr = `onclick="window.switchAudioPart('${itemId}')"`;
      } else if (isCurrent) {
        itemClass = 'active';
        statusBadge = `
          <span style="font-size: 0.78rem; color: #0f172a; font-weight: 700;">
            ● Playing Now
          </span>
        `;
      } else if (isUnlocked) {
        itemClass = 'unlocked';
        statusBadge = `
          <span style="font-size: 0.78rem; color: #8a704c; font-weight: 600;">
            ▶ Unlocked
          </span>
        `;
        clickAttr = `onclick="window.switchAudioPart('${itemId}')"`;
      } else {
        itemClass = 'locked';
        statusBadge = `
          <span style="font-size: 0.78rem; color: #94a3b8; font-weight: 500;">
            🔒 Locked
          </span>
        `;
      }

      return `
        <div class="chapter-item ${itemClass}" ${clickAttr} style="cursor: ${isUnlocked || isCompleted ? 'pointer' : 'not-allowed'};">
          <div class="chapter-left">
            <div class="chapter-num">${item.partNumber || 1}</div>
            <div>
              <div class="chapter-name">${escapeHtml(item.title)}</div>
              <div class="chapter-meta">Recording 0${item.partNumber || 1} &bull; ${escapeHtml(item.duration || 'Voice Recording')}</div>
            </div>
          </div>
          <div>${statusBadge}</div>
        </div>
      `;
    }).join('');
  }

  function updateSequenceListHighlight() {
    renderSequenceJourney(currentSequence);
  }

  // Global handler to switch between parts
  window.switchAudioPart = function(audioId) {
    const item = currentSequence.find(s => (s.id || s.audioId) === audioId);
    if (!item) return;

    const isUnlocked = item.isUnlocked || item.status === 'unlocked' || item.status === 'completed';
    if (!isUnlocked && !item.hasResponse) {
      alert(`Recording 0${item.partNumber} is locked. Please listen through Recording 0${item.partNumber - 1} and submit your reflection first.`);
      return;
    }

    loadActiveTrack(item);
    if (playerView) {
      playerView.classList.remove('hidden');
      playerView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (audio) {
      audio.play().catch(e => console.log('Auto-play notice:', e));
    }
  };

  /**
   * 6. Player Control Bindings
   */
  function bindPlayerControls() {
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlay);

    // Replay from beginning
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        if (!audio) return;
        audio.currentTime = 0;
        audio.play().catch(e => console.warn('Replay error:', e));
      });
    }

    if (skipBackBtn) {
      skipBackBtn.addEventListener('click', () => {
        if (audio) audio.currentTime = Math.max(0, audio.currentTime - 10);
      });
    }

    if (skipFwdBtn) {
      skipFwdBtn.addEventListener('click', () => {
        if (audio) audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);
      });
    }

    if (audio) {
      audio.addEventListener('play', () => {
        if (playIcon) playIcon.classList.add('hidden');
        if (pauseIcon) pauseIcon.classList.remove('hidden');
      });

      audio.addEventListener('pause', () => {
        if (playIcon) playIcon.classList.remove('hidden');
        if (pauseIcon) pauseIcon.classList.add('hidden');
      });

      audio.addEventListener('ended', () => {
        if (playIcon) playIcon.classList.remove('hidden');
        if (pauseIcon) pauseIcon.classList.add('hidden');
        if (timeBarFill) timeBarFill.style.width = '100%';
        if (completionVerifiedTag) completionVerifiedTag.classList.remove('hidden');
        sendTelemetryProgress(true, true);
        revealUnderstandingSection();
      });

      audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        const progress = (audio.currentTime / audio.duration) * 100;
        if (timeBarFill) timeBarFill.style.width = `${progress}%`;
        if (currentTimeText) currentTimeText.textContent = formatTime(audio.currentTime);

        if (progress >= 92) {
          revealUnderstandingSection();
        }
      });

      audio.addEventListener('loadedmetadata', () => {
        if (durationText) durationText.textContent = formatTime(audio.duration);
      });
    }

    // Timeline Scrubbing
    if (timeBarWrapper) {
      timeBarWrapper.addEventListener('click', (e) => {
        const rect = timeBarWrapper.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const percentage = Math.max(0, Math.min(1, clickX / width));
        if (audio && audio.duration) {
          audio.currentTime = percentage * audio.duration;
        }
      });
    }

    // Prevent context menu to protect direct audio extraction
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#playerView')) {
        e.preventDefault();
      }
    });
  }

  function togglePlay() {
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(err => console.warn('Playback error:', err.message));
    } else {
      audio.pause();
    }
  }

  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  /**
   * 7. Telemetry Progress & Seeking Verification
   */
  function startProgressTelemetry() {
    progressInterval = setInterval(() => {
      if (audio && !audio.paused && audio.duration) {
        sendTelemetryProgress();
      }
    }, 3000);
  }

  async function sendTelemetryProgress(forceEnd = false, isEnded = false) {
    if (!audio || !activeAudioId) return;
    const isSongEnded = Boolean(isEnded || forceEnd || audio.ended || (audio.duration && audio.currentTime >= audio.duration * 0.88));

    try {
      const res = await fetch('/api/public/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioId: activeAudioId,
          currentTime: isSongEnded ? (audio.duration || audio.currentTime || 0) : audio.currentTime,
          durationSeconds: audio.duration || 0,
          playbackSpeed: currentSpeed,
          ended: isSongEnded,
          sessionId: getClientSessionId()
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.playbackCompleted) {
          if (completionVerifiedTag) completionVerifiedTag.classList.remove('hidden');
          revealUnderstandingSection();
        }
      }
    } catch (err) {
      // Telemetry background fail-safe
    }
  }

  function revealUnderstandingSection() {
    if (hasRevealedUnderstanding) return;
    hasRevealedUnderstanding = true;

    if (understandingSection) {
      understandingSection.classList.remove('hidden');
      setTimeout(() => {
        understandingSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 300);
    }
  }

  /**
   * 8. Understanding & Response System
   */
  async function initUnderstandingSystem() {
    if (!understandingSection || !understandingForm) return;

    // Word count updater
    if (responseTextarea) {
      responseTextarea.addEventListener('input', () => {
        updateWordCount(responseTextarea.value);
        if (seekingAlertBanner) seekingAlertBanner.classList.add('hidden');
      });
    }

    // "Review Response" Button
    if (reviewResponseBtn) {
      reviewResponseBtn.addEventListener('click', () => {
        const text = (responseTextarea.value || '').trim();
        if (!text || text.length < 3) {
          alert('Please write what you understood from this message before reviewing.');
          responseTextarea.focus();
          return;
        }

        if (previewResponseContent) previewResponseContent.textContent = text;
        if (responsePreviewBox) responsePreviewBox.classList.remove('hidden');
        if (responseInputContainer) responseInputContainer.classList.add('hidden');

        reviewResponseBtn.classList.add('hidden');
        submitResponseBtn.classList.remove('hidden');
        editResponseBtn.classList.remove('hidden');
      });
    }

    // "Edit Response" Button
    if (editResponseBtn) {
      editResponseBtn.addEventListener('click', () => {
        if (responsePreviewBox) responsePreviewBox.classList.add('hidden');
        if (responseInputContainer) responseInputContainer.classList.remove('hidden');
        responseTextarea.disabled = false;
        responseTextarea.focus();

        reviewResponseBtn.classList.remove('hidden');
        submitResponseBtn.classList.add('hidden');
        editResponseBtn.classList.add('hidden');
        if (responseSuccessBanner) responseSuccessBanner.classList.add('hidden');
      });
    }

    // "Confirm & Send Response"
    understandingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = (responseTextarea.value || '').trim();

      if (!text || text.length < 3) {
        alert('Please share your understanding before submitting.');
        return;
      }

      submitResponseBtn.disabled = true;
      submitResponseBtn.textContent = 'Verifying & Saving...';

      const isCompleted = audio.ended || (audio.duration && audio.currentTime >= audio.duration * 0.85);

      // Pre-sync telemetry
      await sendTelemetryProgress(true, isCompleted);

      try {
        const res = await fetch('/api/public/response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioId: activeAudioId,
            responseText: text,
            listenerName: 'Personal Recipient',
            audioCompleted: true,
            ended: isCompleted,
            currentTime: audio.currentTime || audio.duration || 0,
            durationSeconds: audio.duration || 0,
            playbackSpeed: currentSpeed,
            sessionId: getClientSessionId()
          })
        });

        const result = await res.json();

        if (res.ok && result.success) {
          if (responseSuccessBanner) responseSuccessBanner.classList.remove('hidden');
          if (responsePreviewBox) responsePreviewBox.classList.add('hidden');
          if (responseInputContainer) responseInputContainer.classList.remove('hidden');

          responseTextarea.disabled = true;
          reviewResponseBtn.classList.add('hidden');
          submitResponseBtn.classList.add('hidden');
          editResponseBtn.classList.remove('hidden');
          editResponseBtn.textContent = '✏️ Edit Submitted Reflection';

          // Update sequence dynamically from backend
          if (result.sequence) {
            currentSequence = result.sequence;
            renderSequenceJourney(currentSequence);
          }

          // Next lesson unlocked banner
          if (result.nextAudio) {
            displayNextLesson(result.nextAudio);
          }
        } else {
          if (seekingAlertBanner) {
            seekingAlertBanner.textContent = `⚠️ Verification Notice: ${result.error || 'Please listen completely through the recording before submitting your response.'}`;
            seekingAlertBanner.classList.remove('hidden');
            seekingAlertBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            alert(result.error || 'Failed to submit response.');
          }

          if (responsePreviewBox) responsePreviewBox.classList.add('hidden');
          if (responseInputContainer) responseInputContainer.classList.remove('hidden');
          reviewResponseBtn.classList.remove('hidden');
          submitResponseBtn.classList.add('hidden');
          editResponseBtn.classList.add('hidden');
        }
      } catch (err) {
        console.error('Error submitting response:', err);
        alert('Network error submitting response. Please check your connection.');
      } finally {
        submitResponseBtn.disabled = false;
        submitResponseBtn.textContent = 'Confirm & Send Response';
      }
    });

    // Next Recording Button
    if (nextLessonBtn) {
      nextLessonBtn.addEventListener('click', () => {
        const nextItem = currentSequence.find(s => (s.isUnlocked || s.status === 'unlocked') && !s.hasResponse);
        if (nextItem) {
          window.switchAudioPart(nextItem.id || nextItem.audioId);
        }
      });
    }
  }

  async function checkExistingResponseForTrack(audioId) {
    try {
      const sid = getClientSessionId();
      const res = await fetch(`/api/public/response?audioId=${encodeURIComponent(audioId)}&sessionId=${encodeURIComponent(sid)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.hasResponse && data.response) {
          revealUnderstandingSection();
          if (completionVerifiedTag) completionVerifiedTag.classList.remove('hidden');
          responseTextarea.value = data.response.responseText || '';
          updateWordCount(responseTextarea.value);
          responseTextarea.disabled = true;

          if (responseSuccessBanner) responseSuccessBanner.classList.remove('hidden');
          if (reviewResponseBtn) reviewResponseBtn.classList.add('hidden');
          if (submitResponseBtn) submitResponseBtn.classList.add('hidden');
          if (editResponseBtn) {
            editResponseBtn.classList.remove('hidden');
            editResponseBtn.textContent = '✏️ Edit Submitted Reflection';
          }

          if (data.nextAudio) {
            displayNextLesson(data.nextAudio);
          }
        } else {
          responseTextarea.value = '';
          responseTextarea.disabled = false;
          updateWordCount('');
          if (responseSuccessBanner) responseSuccessBanner.classList.add('hidden');
          if (responsePreviewBox) responsePreviewBox.classList.add('hidden');
          if (responseInputContainer) responseInputContainer.classList.remove('hidden');
          if (reviewResponseBtn) reviewResponseBtn.classList.remove('hidden');
          if (submitResponseBtn) submitResponseBtn.classList.add('hidden');
          if (editResponseBtn) editResponseBtn.classList.add('hidden');
        }
      }
    } catch (err) {
      console.warn('Could not check existing response for track:', err);
    }
  }

  function displayNextLesson(nextAudio) {
    if (!nextLessonUnlockBanner || !nextLessonTitle) return;
    nextLessonTitle.textContent = `${nextAudio.title || 'Next Recording'}`;
    nextLessonUnlockBanner.classList.remove('hidden');
    setTimeout(() => {
      nextLessonUnlockBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 400);
  }

  function updateWordCount(str) {
    if (!responseWordCount) return;
    const words = (str || '').trim().split(/\s+/).filter(Boolean).length;
    responseWordCount.textContent = `${words} word${words === 1 ? '' : 's'}`;
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
});
