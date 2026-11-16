/**
 * AudioFlow - Public Recipient Listening Page Controller
 * Powers the Premium Personal Message & Voice Recording Experience for Shared Links.
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
  // Extract slug from URL path: /listen/:slug
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const slug = pathParts[pathParts.length - 1];

  if (!slug || slug === 'listen') {
    showError('Invalid Link', 'No sharing slug was provided in the URL.');
    return;
  }

  // DOM Elements - Views
  const loadingView = document.getElementById('loadingView');
  const errorView = document.getElementById('errorView');
  const errorTitle = document.getElementById('errorTitle');
  const errorDesc = document.getElementById('errorDesc');
  const passwordView = document.getElementById('passwordView');
  const passwordForm = document.getElementById('passwordForm');
  const linkPasswordInput = document.getElementById('linkPasswordInput');
  const passwordErrorMsg = document.getElementById('passwordErrorMsg');
  const unlockBtn = document.getElementById('unlockBtn');
  const playerView = document.getElementById('playerView');

  // DOM Elements - Recipient & Letter
  const recipientBanner = document.getElementById('recipientBanner');
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

  // DOM Elements - Recording Meta
  const trackPartBadge = document.getElementById('trackPartBadge');
  const trackTitle = document.getElementById('trackTitle');

  // DOM Elements - Player
  const audio = document.getElementById('audioStream') || document.getElementById('audio');
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

  // Speed pills
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
  let currentLinkData = null;
  let currentSequence = [];
  let activeAudioId = null;
  let activePartNumber = 1;
  let currentSpeed = 1.0;
  let progressInterval = null;
  let isPlaybackVerified = false;
  let hasRevealedUnderstanding = false;
  let hasConfirmedRead = false;

  // Language Translations (English <-> हिन्दी)
  let currentLanguage = localStorage.getItem('audioflow_language') || 'en';

  const i18n = {
    en: {
      mastheadTitle: '<span class="masthead-sub">Website Design &bull;</span> Developed by <span class="masthead-highlight">Wasim Khan</span>',
      mastheadPill: "Private Delivery",
      welcomeHeading: "A Message Especially for You",
      welcomeDesc: "I have something important and personal that I would like to share with you. Please take a moment to read this message before continuing.",
      letterBody: "Dear Friend,\n\nI have prepared this personal digital letter and voice recordings especially for you. Some thoughts and feelings are too meaningful to be lost in hasty text messages, so I wanted to speak to you directly in my own voice.\n\nTake your time, read through the words below, and listen when you are in a quiet, comfortable space where you can reflect in peace.\n\nWarmly,\nYour Friend",
      disclaimerHeader: "Important Information & Disclaimer",
      disclaimerText: "<strong>Private &amp; Confidential:</strong> This space is completely private between us. Anything you write in response will be delivered directly and securely to me.",
      instructionsText: "<strong>Listening Instructions:</strong> Find a calm space without distractions. Headphones are recommended for optimal clarity. Recordings are delivered sequentially—finish each part to unlock the next chapter.",
      confirmLabel: "Bhai aap yahan click karke recording sun lijiye please...",
      confirmSub: '<span class="confirmation-disclaimer-badge">⚠️ Disclaimer</span> Kripya shaant mahol me headphones lagakar poori recording dhyan se sunein taaki koi zaroori baat miss na ho.',
      proceedBtn: "Proceed to Voice Recordings",
      thankYou: "Thank you for your time, care, and attentive listening.",
      speedLabel: "Speed",
      trackBadge: "Recording",
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
      playingNow: "● Playing Now",
      completedReplay: "✓ Completed &bull; Replay",
      unlocked: "▶ Unlocked",
      locked: "🔒 Locked"
    },
    hi: {
      mastheadTitle: '<span class="masthead-sub">Website Design &bull;</span> Developed by <span class="masthead-highlight">Wasim Khan</span>',
      mastheadPill: "गोपनीय संदेश",
      welcomeHeading: "विशेष रूप से आपके लिए एक संदेश",
      welcomeDesc: "मेरे पास आपके साथ साझा करने के लिए कुछ महत्वपूर्ण और व्यक्तिगत बातें हैं। आगे बढ़ने से पहले कृपया इस संदेश को ध्यान से पढ़ें।",
      letterBody: "प्रिय मित्र,\n\nमैंने यह व्यक्तिगत डिजिटल पत्र और वॉयस रिकॉर्डिंग विशेष रूप से आपके लिए तैयार की हैं। कुछ विचार और भावनाएं इतनी महत्वपूर्ण होती हैं कि उन्हें जल्दबाजी में भेजे गए टेक्स्ट मैसेज में बयां नहीं किया जा सकता, इसलिए मैं आपसे सीधे अपनी आवाज़ में बात करना चाहता था।\n\nकृपया अपना समय लें, नीचे लिखे शब्दों को पढ़ें, और जब आप किसी शांत और एकांत स्थान पर हों तब इसे सुनें ताकि आप सुकून से इस पर विचार कर सकें।\n\nसस्नेह,\nआपका मित्र",
      disclaimerHeader: "महत्वपूर्ण जानकारी एवं निर्देश",
      disclaimerText: "<strong>निजी एवं गोपनीय:</strong> यह स्थान पूरी तरह से निजी है। आपके द्वारा लिखा गया कोई भी जवाब सीधे और सुरक्षित रूप से केवल मुझ तक पहुंचेगा।",
      instructionsText: "<strong>सुनने के निर्देश:</strong> बिना किसी शोर-शराबे वाले शांत स्थान पर बैठें। स्पष्ट आवाज़ के लिए हेडफ़ोन की सलाह दी जाती है। रिकॉर्डिंग को ध्यान से सुनें और अपनी समझ साझा करें।",
      confirmLabel: "भाई आप यहाँ क्लिक करके रिकॉर्डिंग सुन लीजिए प्लीज...",
      confirmSub: '<span class="confirmation-disclaimer-badge">⚠️ Disclaimer</span> कृपया शांत माहौल में हेडफ़ोन लगाकर पूरी रिकॉर्डिंग ध्यान से सुनें ताकि कोई ज़रूरी बात मिस न हो।',
      proceedBtn: "आवाज़ रिकॉर्डिंग सुनने के लिए आगे बढ़ें",
      thankYou: "अपना कीमती समय, परवाह और ध्यान से सुनने के लिए आपका बहुत-बहुत धन्यवाद।",
      speedLabel: "स्पीड",
      trackBadge: "रिकॉर्डिंग",
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
      playingNow: "● अभी चल रहा है",
      completedReplay: "✓ पूर्ण &bull; दोबारा सुनें",
      unlocked: "▶ खुला हुआ है",
      locked: "🔒 लॉक है"
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
    if (mTitle) mTitle.innerHTML = t.mastheadTitle;
    if (recipientBanner) recipientBanner.textContent = t.mastheadPill;

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
    if (cSub) cSub.innerHTML = t.confirmSub;
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
  fetchLinkMetadata();

  /**
   * 1. Welcome Presentation Rendering
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
    if (readConfirmCheckbox && startListeningBtn) {
      readConfirmCheckbox.addEventListener('change', () => {
        hasConfirmedRead = readConfirmCheckbox.checked;
        startListeningBtn.disabled = !hasConfirmedRead;
      });

      startListeningBtn.addEventListener('click', () => {
        if (!hasConfirmedRead) {
          alert('Bhai kripya pehle checkbox par click karke confirm kar lijiye fir recording shuru hogi.');
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
  }

  /**
   * 2. Dedicated Playback Speed Controls (Strict Max 2x)
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
   * 3. Fetch Link Metadata & Audio Sequence
   */
  async function fetchLinkMetadata() {
    try {
      const sid = getClientSessionId();
      const res = await fetch(`/api/listen/${slug}?sessionId=${encodeURIComponent(sid)}`);
      const data = await res.json();

      if (loadingView) loadingView.classList.add('hidden');

      if (data && data.welcomeSettings) {
        renderWelcomePresentation(data.welcomeSettings);
      }

      if (!res.ok || !data.success) {
        showError(
          data.status ? `${data.status} Link` : 'Link Unavailable',
          data.message || 'This shared audio link does not exist or has expired.'
        );
        return;
      }

      currentLinkData = data;
      currentSequence = data.sequence || [];

      // Check password protection
      if (data.requiresPassword && !data.isUnlocked) {
        if (passwordView) passwordView.classList.remove('hidden');
        initPasswordChallenge();
        return;
      }

      // Initialize player
      initPlayer(data);
    } catch (err) {
      console.error('Failed to load shared link:', err);
      if (loadingView) loadingView.classList.add('hidden');
      showError('Connection Error', 'Could not establish connection to servers. Please refresh.');
    }
  }

  /**
   * 4. Password Challenge
   */
  function initPasswordChallenge() {
    if (!passwordForm) return;

    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = linkPasswordInput.value.trim();
      if (!pwd) return;

      unlockBtn.disabled = true;
      unlockBtn.textContent = 'Verifying...';
      passwordErrorMsg.classList.add('hidden');

      try {
        const res = await fetch(`/api/listen/${slug}/verify-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd })
        });

        const result = await res.json();

        if (res.ok && result.success) {
          passwordView.classList.add('hidden');
          fetchLinkMetadata();
        } else {
          passwordErrorMsg.textContent = result.error || 'Incorrect password.';
          passwordErrorMsg.classList.remove('hidden');
          linkPasswordInput.focus();
        }
      } catch (err) {
        passwordErrorMsg.textContent = 'Network error verifying password.';
        passwordErrorMsg.classList.remove('hidden');
      } finally {
        unlockBtn.disabled = false;
        unlockBtn.textContent = 'Unlock & Read Message';
      }
    });
  }

  /**
   * 5. Initialize Player
   */
  function initPlayer(data) {
    const audioData = data.audio || {};
    const recipientData = data.recipient;

    if (recipientBanner) {
      if (recipientData && recipientData.name) {
        recipientBanner.textContent = `Prepared for ${recipientData.name}`;
      } else {
        recipientBanner.textContent = 'Private Delivery';
      }
    }

    const seq = data.sequence || [];
    let initialItem = seq.find(s => s.isUnlocked && !s.hasResponse);
    if (!initialItem) {
      initialItem = seq[0] || { id: audioData.id, title: audioData.title, partNumber: 1 };
    }

    loadActiveTrack(initialItem, data.savedProgress);
    renderSequenceJourney(currentSequence);

    bindPlayerControls();
    startProgressTelemetry();
    initUnderstandingSystem();
  }

  /**
   * 6. Load Active Track
   */
  function loadActiveTrack(item, savedProgress = null) {
    if (!item) return;

    activeAudioId = item.id;
    activePartNumber = item.partNumber || 1;
    isPlaybackVerified = false;
    hasRevealedUnderstanding = false;

    // Reset progress display
    if (timeBarFill) timeBarFill.style.width = '0%';
    if (currentTimeText) currentTimeText.textContent = '0:00';
    if (completionVerifiedTag) completionVerifiedTag.classList.add('hidden');
    if (seekingAlertBanner) seekingAlertBanner.classList.add('hidden');
    if (nextLessonUnlockBanner) nextLessonUnlockBanner.classList.add('hidden');

    // Track metadata
    if (trackPartBadge) {
      trackPartBadge.textContent = `Recording 0${activePartNumber}`;
    }
    if (trackTitle) {
      trackTitle.textContent = item.title || 'Personal Voice Message';
    }

    // Stream source URL
    if (audio) {
      audio.src = `/api/public/sequence-stream/${item.id}`;
      audio.playbackRate = currentSpeed;
    }

    // Question
    const qText = item.understandingQuestion || 'Bhai meri pura baat aur recoding sun ligiye than aapko jo aacha lage aap bata sakte hai, aapko lagta hai hum ushke kabil nhi hai toh... 2 mahine laga isko banane me khuch soch kr hi devlop kiya hai aapko bhi pata hoga mehnat kisko bolte hai.';
    if (understandingQuestionText) {
      understandingQuestionText.textContent = qText;
    }

    // Check existing response
    checkExistingResponseForTrack(item.id);

    // Update sequence highlight
    updateSequenceListHighlight();
  }

  /**
   * 7. Sequence Journey Chapters List & Overall Progress
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

    if (opTitle) opTitle.textContent = t.overallProgressTitle || "Overall Listening Progress";
    if (opPct) opPct.textContent = `${overallPct}%`;
    if (opFill) opFill.style.width = `${overallPct}%`;
    if (opSub) opSub.textContent = `${overallPct}% Completed • ${completedCount} of ${totalAudios} Finished`;

    if (journeyProgressBadge) {
      journeyProgressBadge.textContent = t.journeyProgress(completedCount, totalAudios);
    }
  }

  function renderSequenceJourney(sequence) {
    if (!sequentialJourneyCard || !sequenceListContainer) return;

    currentSequence = sequence || [];

    if (currentSequence.length === 0) {
      sequentialJourneyCard.classList.add('hidden');
      return;
    }

    renderOverallProgress(currentSequence);

    const completedCount = currentSequence.filter(s => s.hasResponse && s.playbackCompleted).length;
    const t = i18n[currentLanguage] || i18n.en;
    if (journeyProgressBadge) {
      journeyProgressBadge.textContent = t.journeyProgress(completedCount, currentSequence.length);
    }

    sequenceListContainer.innerHTML = currentSequence.map((item) => {
      const isCompleted = item.hasResponse && item.playbackCompleted;
      const isCurrent = item.id === activeAudioId;
      const isUnlocked = item.isUnlocked || item.status === 'unlocked' || item.status === 'completed';
      const pct = Math.min(100, Math.max(0, Math.round(item.progressPercent || 0)));

      let statusBadge = '';
      let itemClass = '';
      let clickAttr = '';
      let pctLabel = '';

      if (isCompleted) {
        itemClass = 'completed';
        statusBadge = `
          <span style="font-size: 0.78rem; color: #166534; font-weight: 600;">
            ✓ Completed &bull; Replay
          </span>
        `;
        pctLabel = '100% Completed';
        clickAttr = `onclick="window.switchAudioPart('${item.id}')"`;
      } else if (isCurrent) {
        itemClass = 'active';
        statusBadge = `
          <span style="font-size: 0.78rem; color: #0f172a; font-weight: 700;">
            ● Playing Now
          </span>
        `;
        pctLabel = `${pct}% Listened`;
        clickAttr = `onclick="window.switchAudioPart('${item.id}')"`;
      } else if (isUnlocked) {
        itemClass = 'unlocked';
        statusBadge = `
          <span style="font-size: 0.78rem; color: #8a704c; font-weight: 600;">
            ▶ Unlocked
          </span>
        `;
        pctLabel = `${pct}% Listened`;
        clickAttr = `onclick="window.switchAudioPart('${item.id}')"`;
      } else {
        itemClass = 'locked';
        statusBadge = `
          <span style="font-size: 0.78rem; color: #94a3b8; font-weight: 500;">
            🔒 Locked
          </span>
        `;
        pctLabel = '0% • Complete Part 1 first';
      }

      return `
        <div class="chapter-item ${itemClass}" ${clickAttr} style="cursor: ${isUnlocked || isCompleted ? 'pointer' : 'not-allowed'};">
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

  // Global handler to switch parts
  window.switchAudioPart = function(audioId) {
    const item = currentSequence.find(s => s.id === audioId);
    if (!item) return;

    if (!item.isUnlocked && !item.hasResponse) {
      alert(`Recording 0${item.partNumber} is locked. Please listen through Recording 0${item.partNumber - 1} and submit your reflection first.`);
      return;
    }

    loadActiveTrack(item);
    if (playerView) {
      playerView.classList.remove('hidden');
      playerView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (audio) {
      audio.play().catch(e => console.log('Auto-play note:', e));
    }
  };

  /**
   * 8. Player Controls
   */
  function bindPlayerControls() {
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlay);

    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        if (!audio) return;
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Replay note:', e));
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
        isPlaybackVerified = true;
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

    // Prevent context menu to protect direct stream extraction
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#playerView')) {
        e.preventDefault();
      }
    });
  }

  function togglePlay() {
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(err => console.warn('Playback notice:', err.message));
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
   * 9. Listening Progress Telemetry
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
      const res = await fetch(`/api/listen/${slug}/progress`, {
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
          isPlaybackVerified = true;
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
   * 10. Understanding & Response System
   */
  async function initUnderstandingSystem() {
    if (!understandingSection || !understandingForm) return;

    if (responseTextarea) {
      responseTextarea.addEventListener('input', () => {
        updateWordCount(responseTextarea.value);
        if (seekingAlertBanner) seekingAlertBanner.classList.add('hidden');
      });
    }

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

      await sendTelemetryProgress(true, isCompleted);

      try {
        const res = await fetch(`/api/listen/${slug}/response`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioId: activeAudioId,
            responseText: text,
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

          if (result.sequence) {
            currentSequence = result.sequence;
            renderSequenceJourney(currentSequence);
          }

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

    if (nextLessonBtn) {
      nextLessonBtn.addEventListener('click', () => {
        const nextItem = currentSequence.find(s => s.isUnlocked && !s.hasResponse);
        if (nextItem) {
          window.switchAudioPart(nextItem.id);
        }
      });
    }
  }

  async function checkExistingResponseForTrack(audioId) {
    try {
      const sid = getClientSessionId();
      const res = await fetch(`/api/listen/${slug}/response?audioId=${encodeURIComponent(audioId)}&sessionId=${encodeURIComponent(sid)}`);
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

  function showError(title, msg) {
    if (loadingView) loadingView.classList.add('hidden');
    if (playerView) playerView.classList.add('hidden');
    if (errorView) {
      errorTitle.textContent = title;
      errorDesc.textContent = msg;
      errorView.classList.remove('hidden');
    }
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
