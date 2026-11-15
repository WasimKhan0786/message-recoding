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
  let cachedWelcomeSettings = null;

  // Language Translations (English <-> हिन्दी)
  let currentLanguage = localStorage.getItem('audioflow_language') || 'en';

  const i18n = {
    en: {
      mastheadTitle: "Personal Digital Message",
      mastheadPill: "Private Delivery",
      welcomeHeading: "A Message Especially for You",
      welcomeDesc: "I have something important and personal that I would like to share with you. Please take a moment to read this message before continuing.",
      letterBody: "Dear Friend,\n\nI have prepared this personal digital letter and voice recordings especially for you. Some thoughts and feelings are too meaningful to be lost in hasty text messages, so I wanted to speak to you directly in my own voice.\n\nTake your time, read through the words below, and listen when you are in a quiet, comfortable space where you can reflect in peace.\n\nWarmly,\nYour Friend",
      disclaimerHeader: "Important Information & Disclaimer",
      disclaimerText: "<strong>Private &amp; Confidential:</strong> This space is completely private between us. Anything you write in response will be delivered directly and securely to me.",
      instructionsText: "<strong>Listening Instructions:</strong> Find a calm space without distractions. Headphones are recommended for optimal clarity. Both recordings are available sequentially—listen and share your reflection.",
      confirmLabel: "I Have Read and Understood",
      confirmSub: "Confirm that you have reviewed the written message and are ready to listen attentively.",
      proceedBtn: "Proceed to Voice Recordings",
      thankYou: "Thank you for your time, care, and attentive listening.",
      speedLabel: "Speed",
      trackBadge: "Recording",
      trackTitle01: "Recording 01 - Personal Voice Message",
      trackTitle02: "Recording 02 - Personal Voice Message",
      questionSub: "Please share your thoughts and reflections in your own words. Take as much space as you need.",
      privacyNote: "Your words are private and shared only with me.",
      reviewBtn: "Review Response",
      editBtn: "✏️ Edit Response",
      submitBtn: "Confirm &amp; Send Response",
      previewHeader: "Review Your Reflection Before Submitting:",
      successTitle: "Your reflection has been delivered and saved.",
      successSub: "Thank you for sharing your thoughts. The next chapter is now unlocked.",
      nextUnlockTitle: "Next Chapter Unlocked",
      nextUnlockBtn: "Proceed to Next Recording &rarr;",
      journeyHeaderTitle: "Sequential Recordings",
      journeyProgress: (completed, total) => `${completed} of ${total} Completed`,
      wordCountSuffix: (n) => `${n} word${n === 1 ? '' : 's'}`,
      overallProgressTitle: "Overall Listening Progress",
      overallProgressSummary: (pct, done, total) => `${pct}% Completed • ${done} of ${total} Finished`,
      listenedText: "Listened",
      completedText: "Completed",
      unlockedNotice: "Unlocked",
      lockedNotice: "Locked",
      lockedDesc: "Complete Recording 01 first",
      playingNowNotice: "Playing Now",
      completedNotice: "Completed",
      completedReplay: "✓ Completed &bull; Replay",
      playPart: "▶ Play Part",
      lockedAlert: "Recording 02 is locked. Please listen through Recording 01 completely to unlock it."
    },
    hi: {
      mastheadTitle: "व्यक्तिगत डिजिटल संदेश",
      mastheadPill: "गोपनीय संदेश",
      welcomeHeading: "विशेष रूप से आपके लिए एक संदेश",
      welcomeDesc: "मेरे पास आपके साथ साझा करने के लिए कुछ महत्वपूर्ण और व्यक्तिगत बातें हैं। आगे बढ़ने से पहले कृपया इस संदेश को ध्यान से पढ़ें।",
      letterBody: "प्रिय मित्र,\n\nमैंने यह व्यक्तिगत डिजिटल पत्र और वॉयस रिकॉर्डिंग विशेष रूप से आपके लिए तैयार की हैं। कुछ विचार और भावनाएं इतनी महत्वपूर्ण होती हैं कि उन्हें जल्दबाजी में भेजे गए टेक्स्ट मैसेज में बयां नहीं किया जा सकता, इसलिए मैं आपसे सीधे अपनी आवाज़ में बात करना चाहता था।\n\nकृपया अपना समय लें, नीचे लिखे शब्दों को पढ़ें, और जब आप किसी शांत और एकांत स्थान पर हों तब इसे सुनें ताकि आप सुकून से इस पर विचार कर सकें।\n\nसस्नेह,\nआपका मित्र",
      disclaimerHeader: "महत्वपूर्ण जानकारी एवं निर्देश",
      disclaimerText: "<strong>निजी एवं गोपनीय:</strong> यह स्थान पूरी तरह से निजी है। आपके द्वारा लिखा गया कोई भी जवाब सीधे और सुरक्षित रूप से केवल मुझ तक पहुंचेगा।",
      instructionsText: "<strong>सुनने के निर्देश:</strong> बिना किसी शोर-शराबे वाले शांत स्थान पर बैठें। स्पष्ट आवाज़ के लिए हेडफ़ोन की सलाह दी जाती है। रिकॉर्डिंग को ध्यान से सुनें और अपनी समझ साझा करें।",
      confirmLabel: "मैंने यह संदेश पढ़ और समझ लिया है",
      confirmSub: "पुष्टि करें कि आपने लिखा हुआ पत्र पढ़ लिया है और अब आवाज़ सुनने के लिए तैयार हैं।",
      proceedBtn: "आवाज़ रिकॉर्डिंग सुनने के लिए आगे बढ़ें",
      thankYou: "अपना कीमती समय, परवाह और ध्यान से सुनने के लिए आपका बहुत-बहुत धन्यवाद।",
      speedLabel: "स्पीड",
      trackBadge: "रिकॉर्डिंग",
      trackTitle01: "रिकॉर्डिंग 01 - व्यक्तिगत आवाज़ संदेश",
      trackTitle02: "रिकॉर्डिंग 02 - व्यक्तिगत आवाज़ संदेश",
      questionSub: "कृपया अपनी सोच और विचार अपने शब्दों में साझा करें। आप जितना चाहें उतना लिख सकते हैं।",
      privacyNote: "आपके शब्द पूरी तरह गोपनीय हैं और केवल मेरे साथ साझा होंगे।",
      reviewBtn: "जवाब की समीक्षा करें",
      editBtn: "✏️ जवाब बदलें",
      submitBtn: "पुष्टि करें और जवाब भेजें",
      previewHeader: "अंतिम रूप से भेजने से पहले अपने जवाब की समीक्षा करें:",
      successTitle: "आपका जवाब सफलतापूर्वक भेज दिया गया है।",
      successSub: "अपने विचार साझा करने के लिए धन्यवाद। अब आप अगला भाग सुन सकते हैं।",
      nextUnlockTitle: "अगला भाग अनलॉक हो गया",
      nextUnlockBtn: "अगली रिकॉर्डिंग सुनने के लिए आगे बढ़ें &rarr;",
      journeyHeaderTitle: "क्रमवार रिकॉर्डिंग्स",
      journeyProgress: (completed, total) => `${total} में से ${completed} पूर्ण`,
      wordCountSuffix: (n) => `${n} शब्द`,
      overallProgressTitle: "कुल सुनने की प्रगति",
      overallProgressSummary: (pct, done, total) => `${pct}% पूर्ण • ${total} में से ${done} समाप्त`,
      listenedText: "सुना गया",
      completedText: "पूर्ण",
      unlockedNotice: "अनलॉक",
      lockedNotice: "लॉक है",
      lockedDesc: "पहले रिकॉर्डिंग 01 पूरी सुनें",
      playingNowNotice: "अभी चल रहा है",
      completedNotice: "पूर्ण",
      completedReplay: "✓ पूर्ण &bull; दोबारा सुनें",
      playPart: "▶ सुनें",
      lockedAlert: "रिकॉर्डिंग 02 अभी लॉक है। इसे खोलने के लिए कृपया पहले रिकॉर्डिंग 01 को पूरा सुनें।"
    }
  };

  function applyLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('audioflow_language', lang);

    const t = i18n[lang] || i18n.en;

    // Toggle button styling
    const btnEn = document.getElementById('langBtnEn');
    const btnHi = document.getElementById('langBtnHi');
    if (btnEn && btnHi) {
      if (lang === 'hi') {
        btnHi.classList.add('active');
        btnEn.classList.remove('active');
      } else {
        btnEn.classList.add('active');
        btnHi.classList.remove('active');
      }
    }

    // Masthead
    const mTitle = document.getElementById('mastheadTitle');
    if (mTitle) mTitle.textContent = t.mastheadTitle;
    const mPill = document.getElementById('mastheadPill');
    if (mPill) mPill.textContent = t.mastheadPill;

    // Welcome Card
    if (welcomeHeading) welcomeHeading.textContent = t.welcomeHeading;
    if (welcomeDesc) welcomeDesc.textContent = t.welcomeDesc;
    if (welcomeLetterBody) welcomeLetterBody.textContent = t.letterBody;
    const discTitle = document.getElementById('disclaimerTitleText');
    if (discTitle) discTitle.textContent = t.disclaimerHeader;
    if (welcomeDisclaimerText) welcomeDisclaimerText.innerHTML = t.disclaimerText;
    if (welcomeInstructionsText) welcomeInstructionsText.innerHTML = t.instructionsText;

    const cLabel = document.getElementById('readConfirmLabel');
    if (cLabel) cLabel.textContent = t.confirmLabel;
    const cSub = document.getElementById('readConfirmSub');
    if (cSub) cSub.textContent = t.confirmSub;
    const pBtnText = document.getElementById('startListeningBtnText');
    if (pBtnText) pBtnText.textContent = t.proceedBtn;
    if (welcomeThankYou) welcomeThankYou.textContent = t.thankYou;

    // Player Elements
    const sLabel = document.getElementById('speedPillsLabel');
    if (sLabel) sLabel.textContent = t.speedLabel;
    if (trackPartBadge) {
      trackPartBadge.textContent = `${t.trackBadge} 0${activePartNumber}`;
    }

    // Response Elements
    const qSub = document.getElementById('responseQuestionSub');
    if (qSub) qSub.textContent = t.questionSub;
    const pNote = document.getElementById('responsePrivacyNote');
    if (pNote) pNote.textContent = t.privacyNote;
    const revText = document.getElementById('reviewResponseBtnText');
    if (revText) revText.textContent = t.reviewBtn;
    const editText = document.getElementById('editResponseBtnText');
    if (editText) editText.textContent = t.editBtn;
    const subText = document.getElementById('submitResponseBtnText');
    if (subText) subText.textContent = t.submitBtn;
    const prevHeader = document.getElementById('previewStationeryHeader');
    if (prevHeader) prevHeader.textContent = t.previewHeader;

    const sTitle = document.getElementById('responseSuccessTitle');
    if (sTitle) sTitle.textContent = t.successTitle;
    const sSub = document.getElementById('responseSuccessSub');
    if (sSub) sSub.textContent = t.successSub;
    const nTitle = document.getElementById('nextUnlockTitle');
    if (nTitle) nTitle.textContent = t.nextUnlockTitle;
    const nBtnText = document.getElementById('nextLessonBtnText');
    if (nBtnText) nBtnText.innerHTML = t.nextUnlockBtn;

    const jTitle = document.getElementById('journeyHeaderTitle');
    if (jTitle) jTitle.textContent = t.journeyHeaderTitle;

    // Word count in current language
    if (responseTextarea) {
      updateWordCount(responseTextarea.value || '');
    }

    // Refresh journey list for language updates
    renderSequenceJourney(currentSequence);
  }

  function initLanguageSwitcher() {
    const btnEn = document.getElementById('langBtnEn');
    const btnHi = document.getElementById('langBtnHi');

    if (btnEn) btnEn.addEventListener('click', () => applyLanguage('en'));
    if (btnHi) btnHi.addEventListener('click', () => applyLanguage('hi'));

    applyLanguage(currentLanguage);
  }

  function getClientSessionId() {
    let sid = localStorage.getItem('audioflow_client_sid');
    if (!sid) {
      sid = 'cli-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('audioflow_client_sid', sid);
    }
    return sid;
  }

  // Initialize
  initLanguageSwitcher();
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

    if (!item.isUnlocked) {
      window.showLockedNotice(item.id || item.audioId);
      return;
    }

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
    const t = i18n[currentLanguage] || i18n.en;
    if (trackPartBadge) {
      trackPartBadge.textContent = `${t.trackBadge} 0${activePartNumber}`;
    }
    if (trackTitle) {
      trackTitle.textContent = item.title || 'Personal Voice Message';
    }

    // Update player progress pill
    updatePlayerProgressPill(item.progressPercent || 0, item.isCompleted || item.playbackCompleted);

    // Set stream URL
    if (audio) {
      const sid = getClientSessionId();
      audio.src = `/api/public/sequence-stream/${activeAudioId}?sessionId=${encodeURIComponent(sid)}`;
      audio.playbackRate = currentSpeed;
    }

    // Question text
    const qText = item.understandingQuestion || 'Bhai meri pura baat aur recoding sun ligiye than aapko jo aacha lage aap bata sakte hai, aapko lagta hai hum ushke kabil nhi hai toh... 2 mahine laga isko banane me khuch soch kr hi devlop kiya hai aapko bhi pata hoga mehnat kisko bolte hai.';
    if (understandingQuestionText) {
      understandingQuestionText.textContent = qText;
    }

    // Check existing response
    checkExistingResponseForTrack(activeAudioId);

    // Refresh sequence list highlight
    updateSequenceListHighlight();
  }

  /**
   * 5. Overall Listening Progress Calculation & Rendering
   */
  function renderOverallProgress(sequence) {
    if (!sequence || sequence.length === 0) return;
    const t = i18n[currentLanguage] || i18n.en;

    const totalAudios = sequence.length;
    const totalPct = sequence.reduce((acc, it) => acc + (it.progressPercent || 0), 0);
    const overallPct = Math.min(100, Math.round(totalPct / totalAudios));
    const completedCount = sequence.filter(it => it.isCompleted || it.playbackCompleted || it.progressPercent >= 100).length;

    const opTitle = document.getElementById('overallProgressTitle');
    const opPct = document.getElementById('overallProgressPct');
    const opFill = document.getElementById('overallProgressFill');
    const opSub = document.getElementById('overallProgressSub');

    if (opTitle) opTitle.textContent = t.overallProgressTitle;
    if (opPct) opPct.textContent = `${overallPct}%`;
    if (opFill) opFill.style.width = `${overallPct}%`;
    if (opSub) opSub.textContent = t.overallProgressSummary(overallPct, completedCount, totalAudios);

    if (journeyProgressBadge) {
      journeyProgressBadge.textContent = t.journeyProgress(completedCount, totalAudios);
    }
  }

  function updatePlayerProgressPill(pct, isCompleted) {
    const pill = document.getElementById('playerProgressPill');
    if (!pill) return;
    const t = i18n[currentLanguage] || i18n.en;
    const clamped = Math.min(100, Math.max(0, Math.round(pct || 0)));

    if (isCompleted || clamped >= 100) {
      pill.textContent = `✓ 100% ${t.completedText}`;
      pill.classList.remove('status-progress');
      pill.classList.add('status-completed');
    } else {
      pill.textContent = `${clamped}% ${t.listenedText}`;
      pill.classList.add('status-progress');
      pill.classList.remove('status-completed');
    }
  }

  function updateLiveProgressDisplay(activeItem) {
    if (!activeItem) return;
    const t = i18n[currentLanguage] || i18n.en;
    const pct = Math.min(100, Math.max(0, Math.round(activeItem.progressPercent || 0)));
    const itemId = activeItem.id || activeItem.audioId;

    // Find the specific chapter row on screen
    const row = document.querySelector(`.chapter-item[data-audio-id="${itemId}"]`);
    if (row) {
      const fill = row.querySelector('.chapter-progress-fill');
      const pctText = row.querySelector('.chapter-pct-text');
      if (fill) fill.style.width = `${pct}%`;
      if (pctText) {
        if (activeItem.isCompleted || pct >= 100) {
          pctText.textContent = `100% ${t.completedText}`;
        } else {
          pctText.textContent = `${pct}% ${t.listenedText}`;
        }
      }
    }

    renderOverallProgress(currentSequence);
  }

  /**
   * 6. Sequence Journey Chapters List
   */
  function renderSequenceJourney(sequence) {
    if (!sequentialJourneyCard || !sequenceListContainer) return;

    currentSequence = sequence || [];

    if (currentSequence.length === 0) {
      sequentialJourneyCard.classList.add('hidden');
      return;
    }

    renderOverallProgress(currentSequence);

    const t = i18n[currentLanguage] || i18n.en;

    sequenceListContainer.innerHTML = currentSequence.map((item) => {
      const isCompleted = Boolean(item.isCompleted || item.playbackCompleted || item.progressPercent >= 100);
      const itemId = item.id || item.audioId;
      const isCurrent = itemId === activeAudioId;
      const isUnlocked = Boolean(item.isUnlocked);
      const pct = Math.min(100, Math.max(0, Math.round(item.progressPercent || 0)));

      let statusBadge = '';
      let itemClass = '';
      let clickAttr = '';
      let pctLabel = '';

      if (isCompleted) {
        itemClass = 'completed';
        statusBadge = `
          <span style="font-size: 0.76rem; color: #166534; font-weight: 600; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 4px 10px; border-radius: 14px; white-space: nowrap;">
            ✓ ${t.completedNotice} (100%)
          </span>
        `;
        pctLabel = `100% ${t.completedText}`;
        clickAttr = `onclick="window.switchAudioPart('${itemId}')"`;
      } else if (isCurrent) {
        itemClass = 'active';
        statusBadge = `
          <span style="font-size: 0.76rem; color: #0f172a; font-weight: 700; background: #f1f5f9; border: 1px solid var(--border-accent); padding: 4px 10px; border-radius: 14px; white-space: nowrap;">
            ● ${t.playingNowNotice}
          </span>
        `;
        pctLabel = `${pct}% ${t.listenedText}`;
        clickAttr = `onclick="window.switchAudioPart('${itemId}')"`;
      } else if (isUnlocked) {
        itemClass = 'unlocked';
        statusBadge = `
          <span style="font-size: 0.76rem; color: #8a704c; font-weight: 600; background: var(--accent-warm-light); border: 1px solid var(--border-light); padding: 4px 10px; border-radius: 14px; white-space: nowrap;">
            ▶ ${t.unlockedNotice} (${pct}%)
          </span>
        `;
        pctLabel = `${pct}% ${t.listenedText}`;
        clickAttr = `onclick="window.switchAudioPart('${itemId}')"`;
      } else {
        itemClass = 'locked';
        statusBadge = `
          <span style="font-size: 0.76rem; color: #94a3b8; font-weight: 500; background: #f8fafc; border: 1px solid var(--border-light); padding: 4px 10px; border-radius: 14px; white-space: nowrap;">
            🔒 ${t.lockedNotice}
          </span>
        `;
        pctLabel = `0% &bull; ${t.lockedDesc}`;
        clickAttr = `onclick="window.showLockedNotice('${itemId}')"`;
      }

      return `
        <div class="chapter-item ${itemClass}" data-audio-id="${itemId}" ${clickAttr} style="cursor: ${isUnlocked ? 'pointer' : 'not-allowed'};">
          <div class="chapter-left" style="flex: 1; min-width: 0;">
            <div class="chapter-num">${item.partNumber || 1}</div>
            <div style="flex: 1; min-width: 0;">
              <div class="chapter-name">${escapeHtml(item.title)}</div>
              <div class="chapter-meta">${t.trackBadge} 0${item.partNumber || 1} &bull; ${escapeHtml(item.duration || 'Voice Recording')}</div>
              <div class="chapter-progress-box">
                <div class="chapter-progress-track">
                  <div class="chapter-progress-fill" style="width: ${pct}%;"></div>
                </div>
                <span class="chapter-pct-text">${pctLabel}</span>
              </div>
            </div>
          </div>
          <div style="margin-left: 12px; flex-shrink: 0;">${statusBadge}</div>
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

    if (!item.isUnlocked) {
      window.showLockedNotice(audioId);
      return;
    }

    loadActiveTrack(item);
    if (playerView) {
      playerView.classList.remove('hidden');
      playerView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (audio) {
      audio.play().catch(e => console.log('Playback start notice:', e));
    }
  };

  // Global handler for locked recording notice
  window.showLockedNotice = function(audioId) {
    const t = i18n[currentLanguage] || i18n.en;
    if (seekingAlertBanner) {
      seekingAlertBanner.textContent = `🔒 ${t.lockedAlert}`;
      seekingAlertBanner.classList.remove('hidden');
      seekingAlertBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      alert(t.lockedAlert);
    }
  };

  /**
   * 7. Player Control Bindings
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

        // Mark active recording as completed & 100%
        const activeItem = currentSequence.find(s => (s.id || s.audioId) === activeAudioId);
        if (activeItem) {
          activeItem.isCompleted = true;
          activeItem.playbackCompleted = true;
          activeItem.progressPercent = 100;
        }

        // Automatically unlock Recording 02
        const nextIndex = currentSequence.findIndex(s => (s.id || s.audioId) === activeAudioId) + 1;
        if (nextIndex < currentSequence.length) {
          currentSequence[nextIndex].isUnlocked = true;
          if (currentSequence[nextIndex].status === 'locked') {
            currentSequence[nextIndex].status = 'unlocked';
          }
        }

        renderSequenceJourney(currentSequence);
        updatePlayerProgressPill(100, true);
        sendTelemetryProgress(true, true);
        revealUnderstandingSection();
      });

      audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        const liveCurrentPct = Math.min(100, (audio.currentTime / audio.duration) * 100);
        if (timeBarFill) timeBarFill.style.width = `${liveCurrentPct}%`;
        if (currentTimeText) currentTimeText.textContent = formatTime(audio.currentTime);

        // Update active recording progress in memory
        const activeItem = currentSequence.find(s => (s.id || s.audioId) === activeAudioId);
        if (activeItem) {
          const roundedPct = Math.round(liveCurrentPct);
          if (roundedPct > (activeItem.progressPercent || 0)) {
            activeItem.progressPercent = roundedPct;
          }

          const hasReachedComplete = roundedPct >= 100 || (audio.duration > 0 && audio.currentTime >= audio.duration * 0.96);
          if (hasReachedComplete) {
            activeItem.isCompleted = true;
            activeItem.playbackCompleted = true;
            activeItem.progressPercent = 100;

            // Automatically unlock Recording 02
            const nextIndex = currentSequence.findIndex(s => (s.id || s.audioId) === activeAudioId) + 1;
            if (nextIndex < currentSequence.length && !currentSequence[nextIndex].isUnlocked) {
              currentSequence[nextIndex].isUnlocked = true;
              if (currentSequence[nextIndex].status === 'locked') {
                currentSequence[nextIndex].status = 'unlocked';
              }
              renderSequenceJourney(currentSequence);
            }
          }

          updatePlayerProgressPill(activeItem.progressPercent || 0, activeItem.isCompleted);
          updateLiveProgressDisplay(activeItem);
        }

        if (liveCurrentPct >= 92) {
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
   * 8. Telemetry Progress & Seeking Verification
   */
  function startProgressTelemetry() {
    progressInterval = setInterval(() => {
      if (audio && !audio.paused && audio.duration) {
        sendTelemetryProgress();
      }
    }, 2500);
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

        // If server returns updated sequence, merge unlock state
        if (data.sequence && Array.isArray(data.sequence)) {
          let hasStateChanged = false;
          data.sequence.forEach(srvItem => {
            const local = currentSequence.find(s => (s.id || s.audioId) === (srvItem.id || srvItem.audioId));
            if (local) {
              if (srvItem.isUnlocked && !local.isUnlocked) {
                local.isUnlocked = true;
                hasStateChanged = true;
              }
              if (srvItem.isCompleted && !local.isCompleted) {
                local.isCompleted = true;
                hasStateChanged = true;
              }
              if (srvItem.playbackCompleted && !local.playbackCompleted) {
                local.playbackCompleted = true;
                hasStateChanged = true;
              }
            }
          });
          if (hasStateChanged) {
            renderSequenceJourney(currentSequence);
          }
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
    const t = i18n[currentLanguage] || i18n.en;
    responseWordCount.textContent = t.wordCountSuffix(words);
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
