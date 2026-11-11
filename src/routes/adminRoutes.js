const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const { requireAuth } = require('../middleware/auth');
const Audio = require('../models/Audio');
const adminService = require('../services/adminService');
const dashboardService = require('../services/dashboardService');
const s3Service = require('../services/s3Service');
const ffmpegService = require('../services/ffmpegService');
const { uploadAudio, uploadImage, tempUploadDir } = require('../middleware/uploadMiddleware');

// All /api/admin/* endpoints require authenticated admin session
router.use(requireAuth);

/**
 * GET /api/admin/me
 * Returns current admin session info
 */
router.get('/me', (req, res) => {
  res.status(200).json({
    admin: req.session.admin,
    serverTime: new Date().toISOString()
  });
});

/**
 * 1. Overview Stats (Real data counts only, no fake data)
 */
router.get('/dashboard/stats', (req, res) => {
  const stats = dashboardService.getOverviewStats();
  res.status(200).json({ success: true, stats });
});

/**
 * 2. Audio Library Endpoints
 */
router.get('/audios', (req, res) => {
  const audios = dashboardService.getAudios(req.query.q);
  res.status(200).json({ success: true, audios });
});

/**
 * GET /api/admin/audios/:id
 * Retrieve a single audio record by ID
 */
router.get('/audios/:id', async (req, res) => {
  let audio = dashboardService.getAudioById(req.params.id);
  if (!audio && mongoose.connection.readyState === 1) {
    try {
      const orClauses = [{ id: req.params.id }];
      if (mongoose.isValidObjectId(req.params.id)) {
        orClauses.push({ _id: req.params.id });
      }
      const dbAudio = await Audio.findOne({ $or: orClauses }).lean();
      if (dbAudio) {
        audio = { ...dbAudio, streamUrl: `/api/admin/audios/${dbAudio.id}/stream` };
        dashboardService.getAudios().unshift(audio);
      }
    } catch (e) {
      console.warn('DB lookup notice:', e.message);
    }
  }

  if (!audio) {
    return res.status(404).json({ error: 'Audio record not found.' });
  }
  res.status(200).json({ success: true, audio });
});

/**
 * PATCH /api/admin/audios/:id
 * Update audio metadata (title, genre, description, question, sequence)
 */
router.patch('/audios/:id', async (req, res) => {
  let updated = dashboardService.updateAudio(req.params.id, req.body);
  if (!updated && mongoose.connection.readyState === 1) {
    try {
      const orClauses = [{ id: req.params.id }];
      if (mongoose.isValidObjectId(req.params.id)) {
        orClauses.push({ _id: req.params.id });
      }
      const dbUpdated = await Audio.findOneAndUpdate(
        { $or: orClauses },
        { $set: req.body },
        { new: true }
      ).lean();
      if (dbUpdated) {
        updated = { ...dbUpdated, streamUrl: `/api/admin/audios/${dbUpdated.id}/stream` };
        dashboardService.getAudios().unshift(updated);
      }
    } catch (e) {
      console.warn('DB patch notice:', e.message);
    }
  }

  if (!updated) {
    return res.status(404).json({ error: 'Audio record not found.' });
  }
  res.status(200).json({ success: true, audio: updated });
});

/**
 * POST /api/admin/audios/upload
 * 1. Accepts MP3, WAV, or M4A file (supports 12, 15, 30+ minute recordings).
 * 2. Transcodes to standard MP3 at 128 kbps using FFmpeg.
 * 3. Uploads processed MP3 to Filebase S3 bucket.
 * 4. Saves metadata in dashboard store.
 * 5. Cleans up temporary files.
 */
router.post('/audios/upload', (req, res, next) => {
  uploadAudio.single('audioFile')(req, res, (err) => {
    if (err) {
      console.warn('Multer audio upload error:', err.message);
      let errMsg = err.message || 'Audio upload error.';
      if (err.code === 'LIMIT_FILE_SIZE') {
        errMsg = 'Audio file exceeds the 500 MB limit.';
      }
      return res.status(400).json({
        success: false,
        error: errMsg
      });
    }
    next();
  });
}, async (req, res) => {
  // Allow long processing time for 15-30 minute audio conversions
  req.setTimeout(15 * 60 * 1000);

  if (!req.file) {
    return res.status(400).json({ error: 'Audio file is required (MP3, WAV, or M4A).' });
  }

  const inputPath = req.file.path;
  const originalExt = path.extname(req.file.originalname).toLowerCase().replace('.', '').toUpperCase();
  const title = (req.body.title || path.basename(req.file.originalname, path.extname(req.file.originalname))).trim();
  const genre = (req.body.genre || 'General').trim();
  const description = (req.body.description || '').trim();
  const understandingQuestion = (req.body.understandingQuestion || '').trim();

  const convertedMp3Path = path.join(tempUploadDir, `converted_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp3`);

  try {
    // Step 1: Transcode input audio to MP3 at 128 kbps using FFmpeg
    console.log(`🎵 Converting [${req.file.originalname}] to 128 kbps MP3 via FFmpeg...`);
    const conversionResult = await ffmpegService.convertToMp3128k(inputPath, convertedMp3Path);
    console.log(`✅ Conversion complete. Duration: ${conversionResult.durationFormatted}, Size: ${(conversionResult.fileSize / 1024 / 1024).toFixed(2)} MB`);

    // Step 2: Upload processed MP3 to Filebase S3
    const safeTitle = title.toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 40);
    const s3Key = `audio/${Date.now()}-${safeTitle}.mp3`;

    console.log(`☁️ Uploading to Filebase S3: ${s3Key}...`);
    const uploadResult = await s3Service.uploadAudioFile({
      filePath: convertedMp3Path,
      key: s3Key,
      contentType: 'audio/mpeg'
    });
    console.log(`✅ S3 upload successful. Key: ${uploadResult.key}`);

    // Step 3: Clean up temporary files from disk
    safeUnlink(inputPath);
    safeUnlink(convertedMp3Path);

    // Step 4: Save metadata to dashboard database
    const newAudio = dashboardService.addAudio({
      title,
      genre,
      format: 'MP3 128k',
      duration: conversionResult.durationFormatted,
      durationSeconds: conversionResult.durationSeconds,
      sizeBytes: conversionResult.fileSize,
      description,
      understandingQuestion: understandingQuestion || undefined,
      s3Key: uploadResult.key,
      s3Bucket: uploadResult.bucket,
      cid: uploadResult.cid,
      originalFilename: req.file.originalname,
      originalFormat: originalExt
    });

    return res.status(201).json({
      success: true,
      message: 'Audio converted to 128kbps MP3 and uploaded to Filebase S3 successfully.',
      audio: newAudio
    });
  } catch (err) {
    console.error('Audio processing/upload error:', err.message);
    safeUnlink(inputPath);
    safeUnlink(convertedMp3Path);

    return res.status(500).json({
      error: `Audio upload failed: ${err.message}`
    });
  }
});

/**
 * Standard manual audio record creation (without file upload)
 */
router.post('/audios', (req, res) => {
  const { title, genre, format, duration, description } = req.body;
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Audio title is required.' });
  }

  const audio = dashboardService.addAudio({ title, genre, format, duration, description });
  res.status(201).json({ success: true, audio });
});

/**
 * GET /api/admin/audios/:id/stream
 * Streams the audio file directly from Filebase S3 with HTTP Range support for audio player seeking.
 */
router.get('/audios/:id/stream', async (req, res) => {
  const audio = dashboardService.getAudioById(req.params.id);
  if (!audio) {
    return res.status(404).json({ error: 'Audio not found.' });
  }

  if (!audio.s3Key) {
    return res.status(400).json({ error: 'No S3 audio stream available for this record.' });
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

    // Pipe the S3 readable stream to the Express response
    s3StreamResult.stream.pipe(res);
  } catch (err) {
    console.error('Streaming error from Filebase S3:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Could not stream audio from storage.' });
    }
  }
});

/**
 * DELETE /api/admin/audios/:id
 * Deletes audio record and removes S3 object.
 */
router.delete('/audios/:id', async (req, res) => {
  const audio = dashboardService.getAudioById(req.params.id);
  if (!audio) {
    return res.status(404).json({ error: 'Audio not found.' });
  }

  // If stored in S3, delete from bucket
  if (audio.s3Key) {
    s3Service.deleteAudioFromS3(audio.s3Key).catch(e => console.error(e.message));
  }

  dashboardService.deleteAudio(req.params.id);
  res.status(200).json({ success: true, message: 'Audio removed from library and S3.' });
});

/**
 * 3. Recipients Management Endpoints
 */
router.get('/recipients', (req, res) => {
  const recipients = dashboardService.getRecipients(req.query.q);
  res.status(200).json({ success: true, recipients });
});

router.post('/recipients', (req, res) => {
  const { name, email, group, notes } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Both name and email are required.' });
  }

  const recipient = dashboardService.addRecipient({ name, email, group, notes });
  res.status(201).json({ success: true, recipient });
});

router.delete('/recipients/:id', (req, res) => {
  const success = dashboardService.deleteRecipient(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Recipient not found.' });
  }
  res.status(200).json({ success: true, message: 'Recipient deleted.' });
});

/**
 * 4. Shared Links Endpoints
 */
router.get('/links', (req, res) => {
  const links = dashboardService.getSharedLinks();
  res.status(200).json({ success: true, links });
});

router.post('/links', async (req, res) => {
  const { audioId, recipientId, notes, expiresOption, expiresDays, password } = req.body;
  if (!audioId) {
    return res.status(400).json({ error: 'audioId is required to create a shared link.' });
  }

  try {
    const link = await dashboardService.createSharedLink({ 
      audioId, 
      recipientId: recipientId || null, 
      notes, 
      expiresOption: expiresOption || expiresDays,
      password 
    });
    res.status(201).json({ success: true, link });
  } catch (err) {
    console.error('Error creating shared link:', err);
    res.status(500).json({ error: 'Failed to create shared link.' });
  }
});

router.patch('/links/:id/toggle', (req, res) => {
  const link = dashboardService.toggleSharedLinkStatus(req.params.id);
  if (!link) {
    return res.status(404).json({ error: 'Shared link not found.' });
  }
  res.status(200).json({ 
    success: true, 
    link, 
    message: `Link is now ${link.status}.` 
  });
});

router.delete('/links/:id', (req, res) => {
  const success = dashboardService.revokeSharedLink(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Shared link not found.' });
  }
  res.status(200).json({ success: true, message: 'Shared link revoked.' });
});

router.delete('/links/:id/permanent', (req, res) => {
  const success = dashboardService.deleteSharedLink(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Shared link not found.' });
  }
  res.status(200).json({ success: true, message: 'Shared link permanently removed.' });
});

/**
 * 5. Recent Activity
 */
router.get('/activity', (req, res) => {
  const activities = dashboardService.getRecentActivities();
  res.status(200).json({ success: true, activities });
});

/**
 * 6. Link Click Tracking
 */
router.get('/tracking/clicks', (req, res) => {
  const clicks = dashboardService.getClickLogs();
  res.status(200).json({ success: true, clicks });
});

/**
 * 7. Listening Progress
 */
router.get('/tracking/progress', (req, res) => {
  const progress = dashboardService.getListeningProgress();
  res.status(200).json({ success: true, progress });
});

/**
 * 8. Settings
 */
router.get('/settings', (req, res) => {
  const settings = dashboardService.getSettings();
  res.status(200).json({ success: true, settings });
});

router.put('/settings', (req, res) => {
  const settings = dashboardService.updateSettings(req.body);
  res.status(200).json({ success: true, settings, message: 'Settings saved successfully.' });
});

/**
 * POST /api/admin/settings/password
 * Secure admin password update with bcrypt validation
 */
router.post('/settings/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await adminService.changePassword(currentPassword, newPassword);

  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  res.status(200).json({ success: true, message: result.message });
});

/**
 * 9. Listener Understanding Responses & Review Endpoints
 */
router.get('/responses', (req, res) => {
  const responses = dashboardService.getAllListenerResponses();
  res.status(200).json({ success: true, responses });
});

router.get('/responses/:id', (req, res) => {
  const response = dashboardService.getListenerResponseById(req.params.id);
  if (!response) {
    return res.status(404).json({ error: 'Response not found.' });
  }
  dashboardService.markResponseAsRead(req.params.id);
  res.status(200).json({ success: true, response });
});

router.patch('/responses/:id/read', (req, res) => {
  const response = dashboardService.markResponseAsRead(req.params.id);
  if (!response) {
    return res.status(404).json({ error: 'Response not found.' });
  }
  res.status(200).json({ success: true, message: 'Response marked as read.' });
});

router.patch('/responses/:id', (req, res) => {
  const { adminNotes, status } = req.body;
  const updated = dashboardService.updateResponseReview(req.params.id, { adminNotes, status });
  if (!updated) {
    return res.status(404).json({ error: 'Response not found.' });
  }
  res.status(200).json({ success: true, response: updated, message: 'Response review updated.' });
});

router.delete('/responses/:id', (req, res) => {
  const success = dashboardService.deleteListenerResponse(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Response not found.' });
  }
  res.status(200).json({ success: true, message: 'Response removed.' });
});

/**
 * 10. Welcome Page Presentation Settings
 */
router.get('/welcome-settings', (req, res) => {
  const settings = dashboardService.getWelcomeSettings();
  res.status(200).json({ success: true, settings });
});

router.post('/welcome-settings', async (req, res) => {
  try {
    const { heading, description, thankYouMessage, enabled, letterBody, disclaimer, listeningInstructions } = req.body;
    const updates = {};
    if (typeof heading === 'string') updates.heading = heading.trim();
    if (typeof description === 'string') updates.description = description.trim();
    if (typeof thankYouMessage === 'string') updates.thankYouMessage = thankYouMessage.trim();
    if (typeof letterBody === 'string') updates.letterBody = letterBody.trim();
    if (typeof disclaimer === 'string') updates.disclaimer = disclaimer.trim();
    if (typeof listeningInstructions === 'string') updates.listeningInstructions = listeningInstructions.trim();
    if (typeof enabled !== 'undefined') updates.enabled = Boolean(enabled);

    const updated = await dashboardService.updateWelcomeSettings(updates);
    res.status(200).json({
      success: true,
      settings: updated,
      message: 'Welcome page settings saved successfully.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update welcome settings: ' + err.message });
  }
});

router.post('/welcome-settings/image', (req, res, next) => {
  uploadImage.single('welcomeImage')(req, res, (err) => {
    if (err) {
      console.warn('Multer image upload error:', err.message);
      let errMsg = err.message || 'Image upload error.';
      if (err.code === 'LIMIT_FILE_SIZE') {
        errMsg = 'The selected image is too large. Maximum allowed size is 25 MB.';
      }
      return res.status(400).json({
        success: false,
        error: errMsg
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided. Please choose a valid image (JPG, PNG, WEBP).' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const s3Key = `welcome/welcome-profile-${Date.now()}${ext}`;
    const contentType = req.file.mimetype || 'image/jpeg';

    let s3Result = null;
    try {
      s3Result = await s3Service.uploadFile({
        filePath: req.file.path,
        key: s3Key,
        contentType
      });
    } catch (s3Err) {
      console.warn('Filebase S3 welcome image upload notice:', s3Err.message);
    }

    // Keep local fallback file so image loads seamlessly even if network has latency
    const welcomeDir = path.join(__dirname, '..', '..', 'uploads', 'welcome');
    if (!fs.existsSync(welcomeDir)) {
      fs.mkdirSync(welcomeDir, { recursive: true });
    }
    const localFallbackPath = path.join(welcomeDir, `current_welcome${ext}`);
    try {
      fs.copyFileSync(req.file.path, localFallbackPath);
    } catch (copyErr) {
      console.warn('Local fallback copy notice:', copyErr.message);
    }

    // Remove temp upload file
    safeUnlink(req.file.path);

    const updated = await dashboardService.updateWelcomeSettings({
      imageKey: s3Result ? s3Result.key : s3Key,
      imageBucket: s3Result ? s3Result.bucket : (process.env.S3_BUCKET || 'audioflow-storage'),
      imageContentType: contentType,
      imageUrl: `/api/public/welcome-image?v=${Date.now()}`,
      localFallbackPath
    });

    res.status(200).json({
      success: true,
      settings: updated,
      message: 'Welcome profile image uploaded and stored in Filebase successfully.'
    });
  } catch (err) {
    if (req.file && req.file.path) safeUnlink(req.file.path);
    console.error('Failed to upload welcome image:', err);
    res.status(500).json({ success: false, error: 'Failed to upload welcome image: ' + err.message });
  }
});

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`Could not remove temp file ${filePath}:`, err.message);
  }
}

module.exports = router;
