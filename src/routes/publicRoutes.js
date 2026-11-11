const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dashboardService = require('../services/dashboardService');
const s3Service = require('../services/s3Service');

// Short-lived streaming token configuration
const STREAM_SECRET = process.env.SESSION_SECRET || 'audioflow-secure-stream-key-2026';
const TOKEN_TTL_SECONDS = 900; // 15 minutes short-lived access

/**
 * Generates a tamper-proof short-lived streaming token for an audio track.
 */
function generateStreamToken(audioId, ttlSeconds = TOKEN_TTL_SECONDS) {
  const expiresAt = Date.now() + (ttlSeconds * 1000);
  const payload = `${audioId}.${expiresAt}`;
  const hmac = crypto.createHmac('sha256', STREAM_SECRET).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

/**
 * Verifies a short-lived streaming token.
 */
function verifyStreamToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Missing stream token.' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed stream token.' };
  }
  const [audioId, expiresAtStr, signature] = parts;
  const expiresAt = Number(expiresAtStr);
  if (isNaN(expiresAt)) {
    return { valid: false, error: 'Invalid token timestamp.' };
  }
  if (Date.now() > expiresAt) {
    return { valid: false, error: 'Stream access token has expired. Please refresh audio stream.' };
  }
  const payload = `${audioId}.${expiresAtStr}`;
  const expectedHmac = crypto.createHmac('sha256', STREAM_SECRET).update(payload).digest('hex');

  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedHmac, 'hex');
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, error: 'Invalid or forged stream token.' };
  }
  return { valid: true, audioId };
}

/**
 * GET /api/public/audios
 * Returns the public audio catalog for anyone to listen without login.
 * Never exposes Filebase S3 credentials, buckets, or permanent URLs.
 */
router.get('/api/public/audios', (req, res) => {
  const allAudios = dashboardService.getAudios();

  const publicAudios = allAudios.map(audio => {
    const token = generateStreamToken(audio.id);
    return {
      id: audio.id,
      title: audio.title,
      genre: audio.genre || 'General',
      format: audio.format || 'MP3 128k',
      duration: audio.duration || '00:00',
      durationSeconds: audio.durationSeconds || 0,
      description: audio.description || '',
      createdAt: audio.createdAt,
      hasStream: Boolean(audio.s3Key),
      streamUrl: `/api/public/stream/${token}`
    };
  });

  return res.status(200).json({
    success: true,
    count: publicAudios.length,
    audios: publicAudios,
    protection: {
      downloadDisabled: true,
      streamingEngine: 'Filebase S3 HTTP Range Streaming',
      notice: 'Audio download options are hidden and direct download endpoints are disabled. While browser downloads are disabled, standard web audio playback cannot be made 100% mathematically impossible to record by client-side recording tools.'
    }
  });
});

/**
 * GET /api/public/audios/:id/stream-token
 * Generates an updated short-lived stream token for a specific audio track.
 */
router.get('/api/public/audios/:id/stream-token', (req, res) => {
  const { id } = req.params;
  const audio = dashboardService.getAudioById(id);

  if (!audio) {
    return res.status(404).json({ error: 'Audio track not found.' });
  }

  const token = generateStreamToken(audio.id);
  return res.status(200).json({
    success: true,
    token,
    streamUrl: `/api/public/stream/${token}`,
    expiresInSeconds: TOKEN_TTL_SECONDS
  });
});

/**
 * GET /api/public/stream/:token
 * Streams audio directly through secure backend using short-lived access URLs.
 * Fully supports HTTP Range requests for smooth playback, scrubbing, and replaying.
 * Never exposes permanent Filebase or S3 URLs.
 */
router.get('/api/public/stream/:token', async (req, res) => {
  const { token } = req.params;
  const verification = verifyStreamToken(token);

  if (!verification.valid) {
    return res.status(403).json({
      error: 'Access Denied',
      message: verification.error
    });
  }

  const audio = dashboardService.getAudioById(verification.audioId);
  if (!audio) {
    return res.status(404).json({ error: 'Audio track not found.' });
  }

  if (!audio.s3Key) {
    return res.status(404).json({ error: 'Audio stream source not available.' });
  }

  try {
    const range = req.headers.range;
    const s3StreamResult = await s3Service.getAudioStream({
      key: audio.s3Key,
      range
    });

    // Enforce security & download protection headers
    res.status(s3StreamResult.statusCode || 200);
    res.setHeader('Content-Type', s3StreamResult.contentType || 'audio/mpeg');
    res.setHeader('Accept-Ranges', s3StreamResult.acceptRanges || 'bytes');
    res.setHeader('Content-Disposition', 'inline'); // Explicitly prevents browser "Save File" dialogs
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    if (s3StreamResult.contentRange) {
      res.setHeader('Content-Range', s3StreamResult.contentRange);
    }
    if (s3StreamResult.contentLength !== undefined) {
      res.setHeader('Content-Length', s3StreamResult.contentLength);
    }

    s3StreamResult.stream.pipe(res);
  } catch (err) {
    console.error(`Streaming error for public audio [${audio.id}]:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Could not stream audio track.' });
    }
  }
});

/**
 * GET /api/public/audios/:id/download
 * Explicitly rejects direct download attempts by public users.
 */
router.get('/api/public/audios/:id/download', (req, res) => {
  return res.status(403).json({
    error: 'Download Disabled',
    message: 'Direct file downloads are disabled for this platform. Please stream through the official AudioFlow audio player.'
  });
});

/**
 * GET /api/public/welcome-settings
 * Returns public-facing presentation settings for the welcome section.
 */
router.get('/api/public/welcome-settings', (req, res) => {
  const ws = dashboardService.getWelcomeSettings();
  return res.status(200).json({
    success: true,
    settings: {
      enabled: ws.enabled !== false,
      heading: ws.heading || 'Welcome to AudioFlow',
      description: ws.description || 'Immerse yourself in our audio lessons and curated recordings. Listen attentively to deepen your understanding.',
      thankYouMessage: ws.thankYouMessage || 'Thank you for listening! We appreciate your engagement.',
      imageUrl: ws.imageKey ? `/api/public/welcome-image?v=${new Date(ws.updatedAt).getTime() || Date.now()}` : '/api/public/welcome-image',
      updatedAt: ws.updatedAt
    }
  });
});

/**
 * GET /api/public/welcome-image
 * Streams the saved welcome/profile image from Filebase S3 or local fallback/default SVG.
 */
router.get('/api/public/welcome-image', async (req, res) => {
  const ws = dashboardService.getWelcomeSettings();

  // 1. Stream from Filebase S3 if key exists
  if (ws && ws.imageKey) {
    try {
      const streamResult = await s3Service.getFileStream({ key: ws.imageKey });
      res.status(streamResult.statusCode || 200);
      res.setHeader('Content-Type', streamResult.contentType || ws.imageContentType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return streamResult.stream.pipe(res);
    } catch (err) {
      console.warn('Could not stream welcome image from Filebase S3:', err.message);
    }
  }

  // 2. Stream from local fallback copy if available
  if (ws && ws.localFallbackPath && fs.existsSync(ws.localFallbackPath)) {
    res.setHeader('Content-Type', ws.imageContentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return fs.createReadStream(ws.localFallbackPath).pipe(res);
  }

  // 3. Fallback to clean, responsive SVG avatar
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
    <defs>
      <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#4f46e5" />
        <stop offset="100%" stop-color="#7c3aed" />
      </linearGradient>
    </defs>
    <rect width="240" height="240" rx="48" fill="url(#avatarGrad)" />
    <circle cx="120" cy="90" r="38" fill="#ffffff" fill-opacity="0.95" />
    <path d="M52 196 C52 152, 84 140, 120 140 C156 140, 188 152, 188 196 Z" fill="#ffffff" fill-opacity="0.95" />
    <circle cx="120" cy="120" r="105" stroke="#ffffff" stroke-width="4" stroke-opacity="0.25" fill="none" />
  </svg>`;
  return res.status(200).send(defaultSvg);
});

/**
 * ---------------------------------------------------------------------------
 * Public Homepage Sequential Audio & Response APIs
 * ---------------------------------------------------------------------------
 */

/**
 * GET /api/public/sequence
 * Retrieves sequential audio parts and welcome settings for homepage visitors.
 */
router.get('/api/public/sequence', (req, res) => {
  if (req.session) req.session.visited = true;
  const sessionId = req.query.sessionId || req.sessionID || 'anonymous';
  const sequence = dashboardService.getAudioSequence(sessionId);
  const ws = dashboardService.getWelcomeSettings();
  const publicWelcomeSettings = {
    enabled: ws.enabled !== false,
    heading: ws.heading || 'A Message Especially for You',
    description: ws.description || 'I have something important and personal that I would like to share with you. Please take a moment to read this message before continuing.',
    letterBody: ws.letterBody || 'Dear Friend,\n\nI have prepared this personal digital letter and voice recordings especially for you. Some thoughts and feelings are too meaningful to be lost in hasty text messages, so I wanted to speak to you directly in my own voice.\n\nTake your time, read through the words below, and listen when you are in a quiet, comfortable space where you can reflect in peace.\n\nWarmly,\nYour Friend',
    disclaimer: ws.disclaimer || 'This space is private and created solely for you. Anything you write in response will be delivered directly and privately to me. Please take your time to listen sequentially.',
    listeningInstructions: ws.listeningInstructions || '1. Find a calm and quiet space.\n2. Headphones are recommended for clear listening.\n3. Recordings are presented in sequence—finish each part and write your reflection to unlock the next chapter.',
    thankYouMessage: ws.thankYouMessage || 'Thank you for your time, care, and attentive listening.',
    imageUrl: ws.imageKey ? `/api/public/welcome-image?v=${new Date(ws.updatedAt).getTime() || Date.now()}` : '/api/public/welcome-image'
  };
  res.status(200).json({ success: true, sequence, welcomeSettings: publicWelcomeSettings });
});

/**
 * POST /api/public/progress
 * Records playback progress for a recording on the public homepage.
 */
router.post('/api/public/progress', (req, res) => {
  if (req.session) req.session.lastProgressAt = Date.now();
  const { audioId, currentTime, durationSeconds, playbackSpeed, wallClockElapsed, ended, forceEnd, audioCompleted } = req.body;
  const speed = Number(playbackSpeed) || 1.0;
  if (speed > 2.01) {
    return res.status(400).json({
      error: 'Invalid Playback Speed',
      message: 'Maximum allowable playback speed is 2x. Speeds above 2x are rejected.'
    });
  }
  if (!audioId) {
    return res.status(400).json({ error: 'Audio ID is required.' });
  }
  const sessionId = req.body.sessionId || req.query.sessionId || req.sessionID || 'anonymous';
  try {
    const result = dashboardService.recordListeningProgress({
      audioId,
      sessionId,
      linkSlug: 'home',
      currentTime: Number(currentTime) || 0,
      durationSeconds: Number(durationSeconds) || 0,
      playbackSpeed: speed,
      wallClockElapsed: wallClockElapsed !== undefined ? Number(wallClockElapsed) : undefined,
      ended: Boolean(ended || forceEnd || audioCompleted)
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/public/response
 * Retrieves listener response for a specific recording on homepage.
 */
router.get('/api/public/response', (req, res) => {
  const sessionId = req.query.sessionId || req.sessionID || 'anonymous';
  const audioId = req.query.audioId;
  if (!audioId) return res.status(400).json({ error: 'Audio ID required.' });
  const response = dashboardService.getListenerResponseBySession(audioId, sessionId);
  let nextAudio = null;
  if (response) {
    nextAudio = dashboardService.getNextAudioFor(audioId);
  }
  return res.status(200).json({
    success: true,
    hasResponse: !!response,
    response: response ? {
      id: response.id,
      audioId: response.audioId,
      audioTitle: response.audioTitle,
      partNumber: response.partNumber,
      responseText: response.responseText,
      updatedAt: response.updatedAt,
      status: response.status
    } : null,
    nextAudio
  });
});

/**
 * POST /api/public/response
 * Submits listener reflection from the homepage and unlocks next part.
 */
router.post('/api/public/response', async (req, res) => {
  const { audioId, responseText, listenerName, audioCompleted, ended, currentTime, durationSeconds, playbackSpeed } = req.body;
  if (!audioId) return res.status(400).json({ error: 'Audio ID is required.' });
  const cleanText = String(responseText || '').trim();
  if (!cleanText) {
    return res.status(400).json({ error: 'Please explain what you understood in your own words before submitting.' });
  }
  const sessionId = req.body.sessionId || req.query.sessionId || req.sessionID || 'anonymous';

  // Immediate sync if audio reached completion or user finishes
  if (audioCompleted || ended || (currentTime && durationSeconds && currentTime >= durationSeconds * 0.85)) {
    try {
      dashboardService.recordListeningProgress({
        audioId,
        sessionId,
        linkSlug: 'home',
        currentTime: Number(currentTime) || Number(durationSeconds) || 0,
        durationSeconds: Number(durationSeconds) || 0,
        playbackSpeed: Number(playbackSpeed) || 1.0,
        ended: true
      });
    } catch (e) {
      // Continue to verification
    }
  }

  const isVerified = dashboardService.isPlaybackVerified(audioId, sessionId);
  if (!isVerified) {
    return res.status(403).json({
      error: 'Playback Verification Incomplete',
      message: 'You must listen to the complete recording before submitting your understanding. Seeking to the end does not qualify as completed listening.'
    });
  }
  try {
    const result = await dashboardService.saveListenerResponse({
      audioId,
      linkSlug: 'home',
      sessionId,
      responseText: cleanText,
      listenerName: listenerName || 'Website Listener'
    });
    if (!req.session.completedLessons) req.session.completedLessons = {};
    req.session.completedLessons[audioId] = true;
    const sequence = dashboardService.getAudioSequence(sessionId);
    return res.status(201).json({
      success: true,
      message: 'Your understanding has been recorded successfully! The next part of the message is now unlocked.',
      response: result.response,
      nextAudio: result.nextAudio,
      sequence
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /listen/:slug
 * Public page entry point for recipients.
 * Automatically logs click telemetry for active links.
 */
router.get('/listen/:slug', (req, res) => {
  const { slug } = req.params;
  const link = dashboardService.getSharedLinkBySlug(slug);

  if (link && link.isActive) {
    // Record link click telemetry for dashboard
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Browser';
    const referrer = req.headers.referer || 'Direct';
    dashboardService.recordClick({ linkId: link.id, ip, userAgent, referrer });
  }

  res.sendFile(path.join(__dirname, '..', '..', 'public', 'listen.html'));
});

/**
 * GET /api/listen/:slug
 * Returns shared audio track and recipient information.
 */
router.get('/api/listen/:slug', (req, res) => {
  const { slug } = req.params;
  const link = dashboardService.getSharedLinkBySlug(slug);

  if (!link) {
    return res.status(404).json({
      success: false,
      error: 'Not Found',
      message: 'This shared audio link does not exist.'
    });
  }

  if (!link.isActive) {
    let msg = 'This audio link is no longer accessible.';
    if (link.isRevoked) msg = 'This audio link has been revoked by the sender.';
    else if (link.isDisabled) msg = 'This audio link is temporarily disabled.';
    else if (link.isExpired) msg = 'This audio link has expired.';

    return res.status(200).json({
      success: false,
      status: link.computedStatus,
      isExpired: link.isExpired,
      isDisabled: link.isDisabled,
      isRevoked: link.isRevoked,
      message: msg
    });
  }

  // Check if link is password-protected and whether the current session has unlocked it
  const isUnlocked = !link.isPasswordProtected || Boolean(req.session?.unlockedLinks?.[slug]);

  const ws = dashboardService.getWelcomeSettings();
  const publicWelcomeSettings = {
    enabled: ws.enabled !== false,
    heading: ws.heading || 'A Message Especially for You',
    description: ws.description || 'I have something important and personal that I would like to share with you. Please take a moment to read this message before continuing.',
    letterBody: ws.letterBody || 'Dear Friend,\n\nI have prepared this personal digital letter and voice recordings especially for you. Some thoughts and feelings are too meaningful to be lost in hasty text messages, so I wanted to speak to you directly in my own voice.\n\nTake your time, read through the words below, and listen when you are in a quiet, comfortable space where you can reflect in peace.\n\nWarmly,\nYour Friend',
    disclaimer: ws.disclaimer || 'This space is private and created solely for you. Anything you write in response will be delivered directly and privately to me. Please take your time to listen sequentially.',
    listeningInstructions: ws.listeningInstructions || '1. Find a calm and quiet space.\n2. Headphones are recommended for clear listening.\n3. Recordings are presented in sequence—finish each part and write your reflection to unlock the next chapter.',
    thankYouMessage: ws.thankYouMessage || 'Thank you for your time, care, and attentive listening.',
    imageUrl: ws.imageKey ? `/api/public/welcome-image?v=${new Date(ws.updatedAt).getTime() || Date.now()}` : '/api/public/welcome-image'
  };

  if (link.isPasswordProtected && !isUnlocked) {
    return res.status(200).json({
      success: true,
      requiresPassword: true,
      isUnlocked: false,
      welcomeSettings: publicWelcomeSettings,
      link: {
        slug: link.slug,
        status: link.computedStatus,
        expiresAt: link.expiresAt
      },
      audio: link.audio ? {
        id: link.audio.id,
        title: link.audio.title,
        genre: link.audio.genre,
        format: link.audio.format,
        duration: link.audio.duration
      } : null,
      recipient: link.recipient
    });
  }

  const sessionId = req.query.sessionId || req.sessionID || 'anonymous';
  const sequence = dashboardService.getAudioSequence(sessionId);
  const savedProgress = dashboardService.getPlaybackProgress(link.audioId, sessionId);

  return res.status(200).json({
    success: true,
    requiresPassword: false,
    isUnlocked: true,
    welcomeSettings: publicWelcomeSettings,
    sequence,
    savedProgress,
    link: {
      slug: link.slug,
      status: link.computedStatus,
      expiresAt: link.expiresAt
    },
    audio: link.audio,
    recipient: link.recipient
  });
});

/**
 * POST /api/listen/:slug/verify-password
 * Verifies password for protected shared link and stores unlock in session.
 */
router.post('/api/listen/:slug/verify-password', async (req, res) => {
  const { slug } = req.params;
  const { password } = req.body;

  const link = dashboardService.getSharedLinkBySlug(slug);
  if (!link || !link.isActive) {
    return res.status(404).json({ error: 'Active shared link not found.' });
  }

  const result = await dashboardService.verifyLinkPassword(slug, password);
  if (!result.valid) {
    return res.status(401).json({ success: false, error: result.message || 'Incorrect password.' });
  }

  // Remember unlock in visitor's session
  if (!req.session.unlockedLinks) {
    req.session.unlockedLinks = {};
  }
  req.session.unlockedLinks[slug] = true;

  return res.status(200).json({
    success: true,
    message: 'Password verified successfully.',
    audio: link.audio
  });
});

/**
 * GET /api/listen/:slug/stream
 * Streams the shared audio directly from Filebase S3 for the recipient.
 */
router.get('/api/listen/:slug/stream', async (req, res) => {
  const { slug } = req.params;
  const link = dashboardService.getSharedLinkBySlug(slug);

  if (!link || !link.isActive) {
    return res.status(403).json({ error: 'Access forbidden: Link is inactive, disabled or expired.' });
  }

  // If password protected, check session unlock or query password
  if (link.isPasswordProtected) {
    const isSessionUnlocked = Boolean(req.session?.unlockedLinks?.[slug]);
    let queryAuthorized = false;
    if (req.query.pwd) {
      const authCheck = await dashboardService.verifyLinkPassword(slug, req.query.pwd);
      queryAuthorized = authCheck.valid;
    }

    if (!isSessionUnlocked && !queryAuthorized) {
      return res.status(401).json({ error: 'Password authentication required to stream this track.' });
    }
  }

  const audio = dashboardService.getAudioById(link.audioId);
  if (!audio || !audio.s3Key) {
    return res.status(404).json({ error: 'Audio file not found in storage.' });
  }

  try {
    const rangeHeader = req.headers.range;
    const s3StreamResult = await s3Service.getAudioStream({
      key: audio.s3Key,
      range: rangeHeader
    });

    res.status(s3StreamResult.statusCode);
    res.setHeader('Content-Type', s3StreamResult.contentType);
    res.setHeader('Accept-Ranges', 'bytes');

    if (s3StreamResult.contentRange) {
      res.setHeader('Content-Range', s3StreamResult.contentRange);
    }
    if (s3StreamResult.contentLength !== undefined) {
      res.setHeader('Content-Length', s3StreamResult.contentLength);
    }

    s3StreamResult.stream.pipe(res);
  } catch (err) {
    console.error(`Streaming error for shared link [${slug}]:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Could not stream audio.' });
    }
  }
});

/**
 * GET /api/listen/:slug/sequence
 * Returns the sequential parts of the personal audio message with completion & locked statuses.
 */
router.get('/api/listen/:slug/sequence', (req, res) => {
  const { slug } = req.params;
  const link = dashboardService.getSharedLinkBySlug(slug);

  if (!link || !link.isActive) {
    return res.status(403).json({ error: 'This audio link is no longer accessible.' });
  }

  const sessionId = req.query.sessionId || req.sessionID || 'anonymous';
  const sequence = dashboardService.getAudioSequence(sessionId);
  res.status(200).json({ success: true, sequence });
});

/**
 * POST /api/listen/:slug/progress
 * Telemetry endpoint recording listening progress, anti-seeking verification, and speed compliance.
 */
router.post('/api/listen/:slug/progress', (req, res) => {
  const { slug } = req.params;
  const link = dashboardService.getSharedLinkBySlug(slug);

  if (!link || !link.isActive) {
    return res.status(403).json({ error: 'Link is inactive.' });
  }

  const { audioId, currentTime, durationSeconds, playbackSpeed, wallClockElapsed, ended, forceEnd, audioCompleted } = req.body;
  const speed = Number(playbackSpeed) || 1.0;

  if (speed > 2.01) {
    return res.status(400).json({
      error: 'Invalid Playback Speed',
      message: 'Maximum allowable playback speed is 2x. Speeds above 2x are rejected.'
    });
  }

  const targetAudioId = audioId || link.audioId;
  const sessionId = req.body.sessionId || req.query.sessionId || req.sessionID || 'anonymous';
  if (req.session) {
    req.session.lastProgressAt = Date.now();
  }

  try {
    const result = dashboardService.recordListeningProgress({
      audioId: targetAudioId,
      recipientId: link.recipientId,
      sessionId,
      linkSlug: slug,
      currentTime: Number(currentTime) || 0,
      durationSeconds: Number(durationSeconds) || 0,
      playbackSpeed: speed,
      wallClockElapsed: wallClockElapsed !== undefined ? Number(wallClockElapsed) : undefined,
      ended: Boolean(ended || forceEnd || audioCompleted)
    });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/listen/:slug/response
 * Retrieves the response previously submitted by the current listener session (protects privacy).
 */
router.get('/api/listen/:slug/response', (req, res) => {
  const { slug } = req.params;
  const link = dashboardService.getSharedLinkBySlug(slug);
  const sessionId = req.query.sessionId || req.sessionID || 'anonymous';
  const audioId = req.query.audioId || (link ? link.audioId : null);
  const response = dashboardService.getListenerResponseBySession(audioId || slug, sessionId);

  let nextAudio = null;
  if (response && link) {
    nextAudio = dashboardService.getNextAudioFor(audioId || link.audioId, link.recipientId);
  }

  return res.status(200).json({
    success: true,
    hasResponse: !!response,
    response: response ? {
      id: response.id,
      audioId: response.audioId,
      audioTitle: response.audioTitle,
      partNumber: response.partNumber,
      responseText: response.responseText,
      updatedAt: response.updatedAt,
      status: response.status
    } : null,
    nextAudio
  });
});

/**
 * POST /api/listen/:slug/response
 * Saves or updates listener reflection/understanding in MongoDB and unlocks next recording.
 * Strictly verifies backend playback completion before allowing submission!
 */
router.post('/api/listen/:slug/response', async (req, res) => {
  const { slug } = req.params;
  const link = dashboardService.getSharedLinkBySlug(slug);

  if (!link || !link.isActive) {
    return res.status(403).json({ error: 'This audio link is no longer accessible.' });
  }

  const { audioId, responseText, listenerName, audioCompleted, ended, currentTime, durationSeconds, playbackSpeed } = req.body;
  const targetAudioId = audioId || link.audioId;
  const sessionId = req.body.sessionId || req.query.sessionId || req.sessionID || 'anonymous';

  const cleanText = String(responseText || '').trim();
  if (!cleanText) {
    return res.status(400).json({ error: 'Please explain what you understood in your own words before submitting.' });
  }

  // Immediate sync if audio reached completion or user finishes
  if (audioCompleted || ended || (currentTime && durationSeconds && currentTime >= durationSeconds * 0.85)) {
    try {
      dashboardService.recordListeningProgress({
        audioId: targetAudioId,
        recipientId: link.recipientId,
        sessionId,
        linkSlug: slug,
        currentTime: Number(currentTime) || Number(durationSeconds) || 0,
        durationSeconds: Number(durationSeconds) || 0,
        playbackSpeed: Number(playbackSpeed) || 1.0,
        ended: true
      });
    } catch (e) {
      // Continue to verification
    }
  }

  const isVerified = dashboardService.isPlaybackVerified(targetAudioId, sessionId);
  if (!isVerified) {
    return res.status(403).json({
      error: 'Playback Verification Incomplete',
      message: 'You must listen to the complete recording before submitting your understanding. Seeking to the end does not qualify as completed listening.'
    });
  }

  try {
    const result = await dashboardService.saveListenerResponse({
      audioId: targetAudioId,
      linkSlug: slug,
      sessionId,
      responseText: cleanText,
      listenerName: listenerName || (link.recipient ? link.recipient.name : 'Anonymous Listener')
    });

    // Mark completed in session
    if (!req.session.completedLessons) {
      req.session.completedLessons = {};
    }
    req.session.completedLessons[slug] = true;
    req.session.completedLessons[targetAudioId] = true;

    const sequence = dashboardService.getAudioSequence(sessionId);

    return res.status(201).json({
      success: true,
      message: 'Your understanding has been recorded successfully! The next part of the message is now unlocked.',
      response: result.response,
      nextAudio: result.nextAudio,
      sequence
    });
  } catch (err) {
    console.error('Error saving listener response:', err);
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/public/sequence-stream/:audioId
 * Streams an audio in the sequential message ONLY IF it is currently unlocked for the listener.
 */
router.get('/api/public/sequence-stream/:audioId', async (req, res) => {
  const { audioId } = req.params;
  const sessionId = req.query.sessionId || req.sessionID || 'anonymous';

  // Verify that the requested recording is unlocked or completed for this session
  const isUnlocked = dashboardService.isAudioUnlocked(audioId, sessionId);
  if (!isUnlocked) {
    return res.status(403).json({
      error: 'Locked Recording',
      message: 'This recording is locked. Complete the previous recording and submit your reflection first.'
    });
  }

  const audio = dashboardService.getAudioById(audioId);
  if (!audio) {
    return res.status(404).json({ error: 'Audio recording not found.' });
  }

  if (!audio.s3Key) {
    return res.status(404).json({ error: 'Audio stream source not available.' });
  }

  try {
    const range = req.headers.range;
    const s3StreamResult = await s3Service.getAudioStream({
      key: audio.s3Key,
      range
    });

    res.status(s3StreamResult.statusCode || 200);
    res.setHeader('Content-Type', s3StreamResult.contentType || 'audio/mpeg');
    res.setHeader('Accept-Ranges', s3StreamResult.acceptRanges || 'bytes');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    if (s3StreamResult.contentRange) {
      res.setHeader('Content-Range', s3StreamResult.contentRange);
    }
    if (s3StreamResult.contentLength !== undefined) {
      res.setHeader('Content-Length', s3StreamResult.contentLength);
    }

    s3StreamResult.stream.pipe(res);
  } catch (err) {
    console.error(`Streaming error for sequence audio [${audioId}]:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Could not stream audio track.' });
    }
  }
});

module.exports = router;

