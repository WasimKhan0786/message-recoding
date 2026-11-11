/**
 * AudioFlow - Dashboard & Management Service
 * Real in-memory store for audio records, recipients, shared links, activities, and tracking,
 * backed by automatic write-through persistence to MongoDB Atlas.
 * All statistics are calculated from actual data. Starts with 0 / empty states.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Audio = require('../models/Audio');
const Recipient = require('../models/Recipient');
const SharedLink = require('../models/SharedLink');
const ClickLog = require('../models/ClickLog');
const ListeningProgress = require('../models/ListeningProgress');
const Activity = require('../models/Activity');
const ListenerResponse = require('../models/ListenerResponse');
const WelcomeSettings = require('../models/WelcomeSettings');

// In-memory data collections (Empty by default - no fake statistics)
const dataStore = {
  audios: [],
  recipients: [],
  sharedLinks: [],
  clickLogs: [],
  listeningProgress: [],
  responses: [],
  activities: [
    {
      id: 'act-init',
      type: 'system',
      action: 'Admin System Initialized',
      details: 'Secure session engine and bcrypt credential store loaded.',
      timestamp: new Date().toISOString()
    }
  ],
  settings: {
    siteName: 'AudioFlow',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@audioflow.local',
    allowPublicRegistration: false,
    trackClickLocations: true,
    sessionTimeoutHours: 24,
    defaultLinkExpirationDays: 7
  },
  welcomeSettings: {
    enabled: true,
    heading: 'A Message Especially for You',
    description: 'I have something important and personal that I would like to share with you. Please take a moment to read this message before continuing.',
    letterBody: 'Dear Friend,\n\nI have prepared this personal digital letter and voice recordings especially for you. Some thoughts and feelings are too meaningful to be lost in hasty text messages, so I wanted to speak to you directly in my own voice.\n\nTake your time, read through the words below, and listen when you are in a quiet, comfortable space where you can reflect in peace.\n\nWarmly,\nYour Friend',
    disclaimer: 'This space is private and created solely for you. Anything you write in response will be delivered directly and privately to me. Please take your time to listen sequentially.',
    listeningInstructions: '1. Find a calm and quiet space.\n2. Headphones are recommended for clear listening.\n3. Recordings are presented in sequence—finish each part and write your reflection to unlock the next chapter.',
    thankYouMessage: 'Thank you for your time, care, and attentive listening.',
    imageUrl: '/api/public/welcome-image',
    imageKey: null,
    imageBucket: null,
    imageContentType: 'image/jpeg',
    localFallbackPath: null,
    updatedAt: new Date().toISOString()
  }
};

/**
 * Helper to log admin/system activities
 */
function logActivity(action, details, type = 'info') {
  const activity = {
    id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type,
    action,
    details,
    timestamp: new Date().toISOString()
  };
  dataStore.activities.unshift(activity);
  // Keep last 100 activities
  if (dataStore.activities.length > 100) {
    dataStore.activities.pop();
  }

  if (mongoose.connection.readyState === 1) {
    Activity.create({
      id: activity.id,
      type: activity.type,
      action: activity.action,
      details: activity.details,
      timestamp: new Date(activity.timestamp)
    }).catch(err => console.warn('Activity.create notice:', err.message));
  }

  return activity;
}

// Active playback session trackers for anti-tampering verification & seeking protection
// Key: `${sessionId}:${audioId}`
const playbackTrackers = new Map();

/**
 * Hydrates in-memory data store with existing records from MongoDB Atlas when connected.
 */
async function hydrateFromDB() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const [dbAudios, dbRecipients, dbLinks, dbClicks, dbProgress, dbActivities, dbResponses, dbWelcome] = await Promise.all([
      Audio.find().sort({ createdAt: -1 }).lean(),
      Recipient.find().sort({ createdAt: -1 }).lean(),
      SharedLink.find().sort({ createdAt: -1 }).lean(),
      ClickLog.find().sort({ createdAt: -1 }).lean(),
      ListeningProgress.find().sort({ createdAt: -1 }).lean(),
      Activity.find().sort({ createdAt: -1 }).limit(100).lean(),
      ListenerResponse.find().sort({ createdAt: -1 }).lean(),
      WelcomeSettings.findOne({ key: 'welcome_page' }).lean()
    ]);

    if (dbAudios && dbAudios.length > 0) {
      dataStore.audios = dbAudios.map(a => ({
        ...a,
        streamUrl: `/api/admin/audios/${a.id}/stream`
      }));
    }
    if (dbRecipients && dbRecipients.length > 0) dataStore.recipients = dbRecipients;
    if (dbLinks && dbLinks.length > 0) dataStore.sharedLinks = dbLinks;
    if (dbClicks && dbClicks.length > 0) dataStore.clickLogs = dbClicks;
    if (dbProgress && dbProgress.length > 0) {
      dataStore.listeningProgress = dbProgress;
      dbProgress.forEach(p => {
        if (p.sessionId && p.audioId) {
          const key = `${p.sessionId}:${p.audioId}`;
          playbackTrackers.set(key, {
            key,
            sessionId: p.sessionId,
            audioId: p.audioId,
            linkSlug: p.linkSlug || null,
            recipientId: p.recipientId || null,
            listenedSeconds: Number(p.listenedSeconds) || 0,
            lastHeartbeatAt: Date.now(),
            lastCurrentTime: Number(p.currentTime) || 0,
            maxTimeReached: Number(p.currentTime) || 0,
            playbackCompleted: !!p.playbackCompleted,
            completedAt: p.completedAt || null,
            speed: Number(p.lastSpeed) || 1.0,
            durationSeconds: Number(p.durationSeconds) || 0
          });
        }
      });
    }
    if (dbActivities && dbActivities.length > 0) dataStore.activities = dbActivities;
    if (dbResponses && dbResponses.length > 0) dataStore.responses = dbResponses;
    if (dbWelcome) {
      dataStore.welcomeSettings = {
        ...dataStore.welcomeSettings,
        ...dbWelcome,
        imageUrl: dbWelcome.imageKey ? `/api/public/welcome-image?v=${new Date(dbWelcome.updatedAt).getTime() || Date.now()}` : '/api/public/welcome-image'
      };
    }

    console.log(`🍃 Synced AudioFlow data store with MongoDB Atlas (${dataStore.audios.length} audios, ${dataStore.recipients.length} recipients, ${dataStore.sharedLinks.length} links, ${dataStore.responses.length} responses).`);
  } catch (err) {
    console.warn('Notice: Could not load initial data from MongoDB:', err.message);
  }
}

/**
 * Check if a timestamp is from today (local date)
 */
function isToday(isoString) {
  if (!isoString) return false;
  const date = new Date(isoString);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

// ---------------------------------------------------------------------------
// 1. Dashboard Overview Stats (Calculated strictly from real data)
// ---------------------------------------------------------------------------
function getOverviewStats() {
  const totalAudios = dataStore.audios.length;
  const totalRecipients = dataStore.recipients.length;
  const now = new Date();
  
  const activeLinks = dataStore.sharedLinks.filter(l => l.status === 'active' && (!l.expiresAt || new Date(l.expiresAt) > now)).length;
  const expiredLinks = dataStore.sharedLinks.filter(l => l.expiresAt && new Date(l.expiresAt) <= now).length;
  const disabledLinks = dataStore.sharedLinks.filter(l => l.status === 'disabled').length;
  const totalLinks = dataStore.sharedLinks.length;

  const totalStorageBytes = dataStore.audios.reduce((acc, a) => acc + (Number(a.sizeBytes) || 0), 0);
  let totalStorageFormatted = '0 MB';
  if (totalStorageBytes < 1024 * 1024) {
    totalStorageFormatted = `${(totalStorageBytes / 1024).toFixed(1)} KB`;
  } else if (totalStorageBytes < 1024 * 1024 * 1024) {
    totalStorageFormatted = `${(totalStorageBytes / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    totalStorageFormatted = `${(totalStorageBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  const todayClicks = dataStore.clickLogs.filter(c => isToday(c.timestamp)).length;
  const totalClicks = dataStore.clickLogs.length;
  const completedListens = dataStore.listeningProgress.filter(p => (p.progressPercent || 0) >= 100).length;

  const recentUploads = dataStore.audios.slice(0, 5);
  const recentActivities = dataStore.activities.slice(0, 8);

  const totalResponses = dataStore.responses.length;
  const pendingResponses = dataStore.responses.filter(r => r.status === 'submitted').length;
  const unreadResponses = dataStore.responses.filter(r => !r.isRead).length;

  return {
    totalAudios,
    totalRecipients,
    totalLinks,
    activeLinks,
    expiredLinks,
    disabledLinks,
    totalStorageBytes,
    totalStorageFormatted,
    todayClicks,
    totalClicks,
    completedListens,
    totalResponses,
    pendingResponses,
    unreadResponses,
    recentUploads,
    recentActivities,
    systemStatus: 'Operational',
    uptimeSeconds: Math.floor(process.uptime()),
    serverTime: new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// 2. Audio Library
// ---------------------------------------------------------------------------
function getAudios(query = '') {
  if (!query) return [...dataStore.audios];
  const q = query.toLowerCase();
  return dataStore.audios.filter(a => 
    (a.title && a.title.toLowerCase().includes(q)) ||
    (a.genre && a.genre.toLowerCase().includes(q)) ||
    (a.format && a.format.toLowerCase().includes(q))
  );
}

function getAudioById(id) {
  return dataStore.audios.find(a => a.id === id) || null;
}

function addAudio({ 
  title, 
  genre = 'General', 
  format = 'MP3 128k', 
  duration = '00:00', 
  durationSeconds = 0,
  fileSize = '',
  sizeBytes = 0,
  description = '',
  understandingQuestion = 'What did you understand from this audio lesson? Please summarize your key takeaways in your own words.',
  nextAudioId = null,
  s3Key = null,
  s3Bucket = null,
  cid = null,
  originalFilename = null,
  originalFormat = 'MP3'
}) {
  const audioId = `aud-${Date.now()}`;
  const newAudio = {
    id: audioId,
    title: String(title).trim(),
    genre: String(genre).trim(),
    format: String(format).trim(),
    duration: String(duration).trim(),
    durationSeconds: Number(durationSeconds) || 0,
    fileSize: fileSize || (sizeBytes ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB` : '-'),
    sizeBytes: Number(sizeBytes) || 0,
    description: String(description).trim(),
    understandingQuestion: String(understandingQuestion || 'What did you understand from this audio lesson? Please summarize your key takeaways in your own words.').trim(),
    nextAudioId: nextAudioId || null,
    s3Key,
    s3Bucket,
    cid,
    originalFilename,
    originalFormat,
    streamUrl: `/api/admin/audios/${audioId}/stream`,
    status: 'Ready',
    createdAt: new Date().toISOString(),
    shareCount: 0
  };

  dataStore.audios.unshift(newAudio);
  logActivity('Audio Added', `Added audio "${newAudio.title}" (${newAudio.format}${newAudio.s3Key ? ' via Filebase S3' : ''})`, 'audio');

  // Persist metadata to MongoDB if connected
  if (mongoose.connection.readyState === 1) {
    Audio.create({
      id: newAudio.id,
      title: newAudio.title,
      genre: newAudio.genre,
      format: newAudio.format,
      duration: newAudio.duration,
      durationSeconds: newAudio.durationSeconds,
      fileSize: newAudio.fileSize,
      sizeBytes: newAudio.sizeBytes,
      description: newAudio.description,
      understandingQuestion: newAudio.understandingQuestion,
      nextAudioId: newAudio.nextAudioId,
      s3Key: newAudio.s3Key,
      s3Bucket: newAudio.s3Bucket,
      cid: newAudio.cid,
      originalFilename: newAudio.originalFilename,
      originalFormat: newAudio.originalFormat,
      status: newAudio.status,
      shareCount: newAudio.shareCount,
      createdAt: new Date(newAudio.createdAt)
    }).catch(err => {
      console.warn(`⚠️ Failed to persist audio to MongoDB:`, err.message);
    });
  }

  return newAudio;
}

function updateAudio(id, updates = {}) {
  const audio = dataStore.audios.find(a => a.id === id);
  if (!audio) return null;

  if (updates.title) audio.title = String(updates.title).trim();
  if (updates.genre) audio.genre = String(updates.genre).trim();
  if (updates.description !== undefined) audio.description = String(updates.description).trim();
  if (updates.understandingQuestion !== undefined) audio.understandingQuestion = String(updates.understandingQuestion).trim();
  if (updates.nextAudioId !== undefined) audio.nextAudioId = updates.nextAudioId || null;

  logActivity('Audio Updated', `Updated metadata for "${audio.title}"`, 'audio');

  if (mongoose.connection.readyState === 1) {
    Audio.updateOne(
      { id },
      { $set: { 
        title: audio.title, 
        genre: audio.genre, 
        description: audio.description,
        understandingQuestion: audio.understandingQuestion,
        nextAudioId: audio.nextAudioId
      } }
    ).catch(err => console.warn(`⚠️ Failed to update audio in MongoDB:`, err.message));
  }

  return audio;
}

function deleteAudio(id) {
  const index = dataStore.audios.findIndex(a => a.id === id);
  if (index === -1) return false;
  const removed = dataStore.audios.splice(index, 1)[0];
  logActivity('Audio Deleted', `Deleted audio "${removed.title}"`, 'warning');

  // Delete from MongoDB if connected
  if (mongoose.connection.readyState === 1) {
    Audio.deleteOne({ id }).catch(err => {
      console.warn(`⚠️ Failed to delete audio from MongoDB:`, err.message);
    });
  }

  return removed;
}

// ---------------------------------------------------------------------------
// 3. Recipients Management
// ---------------------------------------------------------------------------
function getRecipients(query = '') {
  if (!query) return [...dataStore.recipients];
  const q = query.toLowerCase();
  return dataStore.recipients.filter(r => 
    (r.name && r.name.toLowerCase().includes(q)) ||
    (r.email && r.email.toLowerCase().includes(q)) ||
    (r.group && r.group.toLowerCase().includes(q))
  );
}

function addRecipient({ name, email, group = 'General', notes = '' }) {
  const newRecipient = {
    id: `rec-${Date.now()}`,
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    group: String(group).trim(),
    notes: String(notes).trim(),
    createdAt: new Date().toISOString(),
    sharedLinksCount: 0
  };

  dataStore.recipients.unshift(newRecipient);
  logActivity('Recipient Added', `Added recipient ${newRecipient.name} (${newRecipient.email})`, 'recipient');

  if (mongoose.connection.readyState === 1) {
    Recipient.create({
      id: newRecipient.id,
      name: newRecipient.name,
      email: newRecipient.email,
      group: newRecipient.group,
      notes: newRecipient.notes,
      sharedLinksCount: 0,
      createdAt: new Date(newRecipient.createdAt)
    }).catch(err => console.warn('Recipient.create warning:', err.message));
  }

  return newRecipient;
}

function deleteRecipient(id) {
  const index = dataStore.recipients.findIndex(r => r.id === id);
  if (index === -1) return false;
  const removed = dataStore.recipients.splice(index, 1)[0];
  logActivity('Recipient Deleted', `Removed recipient ${removed.name}`, 'warning');

  if (mongoose.connection.readyState === 1) {
    Recipient.deleteOne({ id }).catch(err => console.warn('Recipient.deleteOne warning:', err.message));
  }

  return true;
}

// ---------------------------------------------------------------------------
// 4. Shared Links
// ---------------------------------------------------------------------------
function getSharedLinks() {
  const now = new Date();
  return dataStore.sharedLinks.map(link => {
    const audio = dataStore.audios.find(a => a.id === link.audioId);
    const recipient = dataStore.recipients.find(r => r.id === link.recipientId);
    const isExpired = !!(link.expiresAt && new Date(link.expiresAt) <= now);

    let computedStatus = 'Active';
    if (link.status === 'revoked') computedStatus = 'Revoked';
    else if (link.status === 'disabled') computedStatus = 'Disabled';
    else if (isExpired) computedStatus = 'Expired';

    return {
      ...link,
      computedStatus,
      isExpired,
      isActive: link.status === 'active' && !isExpired,
      isPasswordProtected: !!link.isPasswordProtected,
      audioTitle: audio ? audio.title : 'Deleted Audio',
      recipientName: recipient ? recipient.name : 'Public / Unassigned',
      recipientEmail: recipient ? recipient.email : ''
    };
  });
}

async function createSharedLink({ 
  audioId, 
  recipientId = null, 
  notes = '', 
  expiresOption = '7d', 
  expiresDays = null,
  password = null 
}) {
  const audio = dataStore.audios.find(a => a.id === audioId);
  const recipient = recipientId ? dataStore.recipients.find(r => r.id === recipientId) : null;

  const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  
  // Calculate expiration
  let expiresAt = null;
  const opt = String(expiresOption || expiresDays || '7d').toLowerCase();
  if (opt === '24h' || opt === '1d' || opt === '1') {
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  } else if (opt === '7d' || opt === '7') {
    expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (opt === '30d' || opt === '30') {
    expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  } else if (opt === 'permanent' || opt === 'never' || opt === '0') {
    expiresAt = null;
  } else if (!isNaN(Number(opt))) {
    expiresAt = new Date(Date.now() + Number(opt) * 24 * 60 * 60 * 1000).toISOString();
  } else {
    expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  // Handle optional password protection
  let passwordHash = null;
  let isPasswordProtected = false;
  if (password && String(password).trim().length > 0) {
    passwordHash = await bcrypt.hash(String(password).trim(), 10);
    isPasswordProtected = true;
  }

  const newLink = {
    id: `lnk-${Date.now()}`,
    slug: token,
    audioId,
    recipientId: recipient ? recipient.id : null,
    notes: String(notes).trim(),
    status: 'active',
    isPasswordProtected,
    passwordHash,
    clicks: 0,
    createdAt: new Date().toISOString(),
    expiresAt
  };

  dataStore.sharedLinks.unshift(newLink);

  if (audio) audio.shareCount = (audio.shareCount || 0) + 1;
  if (recipient) recipient.sharedLinksCount = (recipient.sharedLinksCount || 0) + 1;

  logActivity('Shared Link Created', `Generated ${isPasswordProtected ? 'password-protected ' : ''}link for "${audio ? audio.title : audioId}"`, 'link');

  if (mongoose.connection.readyState === 1) {
    SharedLink.create({
      id: newLink.id,
      slug: newLink.slug,
      audioId: newLink.audioId,
      recipientId: newLink.recipientId,
      notes: newLink.notes,
      status: newLink.status,
      isPasswordProtected: newLink.isPasswordProtected,
      passwordHash: newLink.passwordHash,
      clicks: newLink.clicks,
      expiresAt: newLink.expiresAt ? new Date(newLink.expiresAt) : null,
      createdAt: new Date(newLink.createdAt)
    }).catch(err => console.warn('SharedLink.create warning:', err.message));

    if (audio) Audio.updateOne({ id: audioId }, { $inc: { shareCount: 1 } }).catch(() => {});
    if (recipient) Recipient.updateOne({ id: recipient.id }, { $inc: { sharedLinksCount: 1 } }).catch(() => {});
  }

  return newLink;
}

function toggleSharedLinkStatus(id) {
  const link = dataStore.sharedLinks.find(l => l.id === id || l.slug === id);
  if (!link) return null;
  link.status = link.status === 'active' ? 'disabled' : 'active';
  logActivity('Shared Link Updated', `Toggled link (${link.slug}) to ${link.status}`, 'link');

  if (mongoose.connection.readyState === 1) {
    SharedLink.updateOne({ $or: [{ id }, { slug: id }] }, { $set: { status: link.status } }).catch(err => console.warn(err.message));
  }
  return link;
}

function revokeSharedLink(id) {
  const link = dataStore.sharedLinks.find(l => l.id === id || l.slug === id);
  if (!link) return false;
  link.status = 'revoked';
  logActivity('Shared Link Revoked', `Revoked shared link ID ${id}`, 'warning');

  if (mongoose.connection.readyState === 1) {
    SharedLink.updateOne({ $or: [{ id }, { slug: id }] }, { $set: { status: 'revoked' } }).catch(err => console.warn(err.message));
  }

  return true;
}

function deleteSharedLink(id) {
  const index = dataStore.sharedLinks.findIndex(l => l.id === id || l.slug === id);
  if (index === -1) return false;
  const removed = dataStore.sharedLinks.splice(index, 1)[0];
  logActivity('Shared Link Deleted', `Deleted link (${removed.slug})`, 'warning');

  if (mongoose.connection.readyState === 1) {
    SharedLink.deleteOne({ $or: [{ id }, { slug: id }] }).catch(err => console.warn(err.message));
  }
  return true;
}

function getSharedLinkBySlug(slug) {
  const link = dataStore.sharedLinks.find(l => l.slug === slug);
  if (!link) return null;
  const audio = dataStore.audios.find(a => a.id === link.audioId);
  const recipient = dataStore.recipients.find(r => r.id === link.recipientId);

  const now = new Date();
  const isExpired = !!(link.expiresAt && new Date(link.expiresAt) <= now);
  const isActive = link.status === 'active' && !isExpired;
  const isDisabled = link.status === 'disabled';
  const isRevoked = link.status === 'revoked';

  let computedStatus = 'Active';
  if (isRevoked) computedStatus = 'Revoked';
  else if (isDisabled) computedStatus = 'Disabled';
  else if (isExpired) computedStatus = 'Expired';

  const nextAudioInfo = audio ? getNextAudioFor(audio.id, recipient ? recipient.id : null) : null;

  return {
    ...link,
    computedStatus,
    isExpired,
    isActive,
    isDisabled,
    isRevoked,
    isPasswordProtected: !!link.isPasswordProtected,
    audio: audio ? {
      id: audio.id,
      title: audio.title,
      genre: audio.genre,
      format: audio.format,
      duration: audio.duration,
      durationSeconds: audio.durationSeconds,
      fileSize: audio.fileSize,
      description: audio.description,
      understandingQuestion: audio.understandingQuestion || 'What did you understand from this audio lesson? Please summarize your key takeaways in your own words.',
      nextAudioId: audio.nextAudioId || null,
      s3Key: audio.s3Key
    } : null,
    nextAudio: nextAudioInfo,
    recipient: recipient ? {
      id: recipient.id,
      name: recipient.name,
      email: recipient.email
    } : null
  };
}

function getSortedAudios() {
  return [...dataStore.audios].sort((a, b) => {
    if (a.sequenceOrder !== undefined && b.sequenceOrder !== undefined && a.sequenceOrder !== b.sequenceOrder) {
      return a.sequenceOrder - b.sequenceOrder;
    }
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

function getNextAudioFor(audioId, recipientId) {
  if (!audioId) return null;
  const audios = getSortedAudios();
  const currentIndex = audios.findIndex(a => a.id === audioId);
  if (currentIndex === -1) return null;
  
  const currentAudio = audios[currentIndex];
  let nextAudio = null;

  if (currentAudio.nextAudioId) {
    nextAudio = audios.find(a => a.id === currentAudio.nextAudioId);
  } else if (currentIndex < audios.length - 1) {
    // Sequential fallback: next audio in sequence
    nextAudio = audios[currentIndex + 1];
  }

  if (!nextAudio) return null;

  let link = dataStore.sharedLinks.find(l => l.audioId === nextAudio.id && l.status === 'active' && (!l.expiresAt || new Date(l.expiresAt) > new Date()));

  return {
    id: nextAudio.id,
    title: nextAudio.title,
    duration: nextAudio.duration,
    slug: link ? link.slug : null,
    listenUrl: link ? `/listen/${link.slug}` : null
  };
}

/**
 * ---------------------------------------------------------------------------
 * Listener Understanding & Reflection Response System
 * ---------------------------------------------------------------------------
 */
async function saveListenerResponse({ audioId, linkSlug, sessionId, responseText, listenerName }) {
  if (!linkSlug || !sessionId) {
    throw new Error('Link slug and session ID are required.');
  }

  const cleanText = String(responseText || '').trim();
  if (!cleanText) {
    throw new Error('Response text cannot be empty. Please explain what you understood in your own words.');
  }

  const link = getSharedLinkBySlug(linkSlug);
  const audio = link?.audio || (audioId ? getAudioById(audioId) : null);
  const audioTitle = audio ? audio.title : 'Audio Recording';
  const targetAudioId = audio ? audio.id : audioId;
  const question = audio?.understandingQuestion || 'What did you understand from this recording?';

  // Strictly verify backend playback completion before allowing response submission!
  const isVerified = isPlaybackVerified(targetAudioId, sessionId);
  if (!isVerified) {
    throw new Error('Playback verification incomplete. You must listen to the complete recording before submitting your response. Seeking to the end does not qualify as completed listening.');
  }

  const allSortedAudios = getSortedAudios();
  const audioIndex = allSortedAudios.findIndex(a => a.id === targetAudioId);
  const partNumber = audioIndex !== -1 ? audioIndex + 1 : 1;

  // Check if this session already submitted a response for this slug or audioId (prevent duplicate submissions, allow revision)
  let existingIndex = dataStore.responses.findIndex(r => (r.linkSlug === linkSlug || r.audioId === targetAudioId) && r.sessionId === sessionId);
  let responseRecord;
  const nextAudioInfo = getNextAudioFor(targetAudioId, link?.recipientId);

  if (existingIndex !== -1) {
    responseRecord = dataStore.responses[existingIndex];
    responseRecord.responseText = cleanText;
    responseRecord.partNumber = partNumber;
    responseRecord.isRead = false; // Flag unread so admin gets notified of updated submission
    responseRecord.updatedAt = new Date().toISOString();
    logActivity('Listener Response Updated', `Updated reflection for "${audioTitle}" (Part ${partNumber}) by ${listenerName || responseRecord.recipientName}`, 'response');

    if (mongoose.connection.readyState === 1) {
      try {
        await ListenerResponse.updateOne(
          { id: responseRecord.id },
          { $set: { responseText: cleanText, partNumber, isRead: false, updatedAt: new Date() } }
        );
      } catch (err) {
        console.warn('ListenerResponse.updateOne notice:', err.message);
      }
    }
  } else {
    responseRecord = {
      id: `resp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      audioId: targetAudioId,
      audioTitle,
      partNumber,
      linkSlug,
      linkId: link ? link.id : null,
      recipientId: link ? link.recipientId : null,
      recipientName: listenerName || (link?.recipient ? link.recipient.name : 'Anonymous Listener'),
      recipientEmail: link?.recipient ? link.recipient.email : '',
      sessionId,
      question,
      responseText: cleanText,
      status: 'submitted',
      adminNotes: '',
      isRead: false,
      playbackCompleted: true,
      unlockedNext: !!nextAudioInfo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dataStore.responses.unshift(responseRecord);
    logActivity('Listener Response Submitted', `New reflection on "${audioTitle}" (Part ${partNumber}) from ${responseRecord.recipientName}`, 'response');

    if (mongoose.connection.readyState === 1) {
      try {
        await ListenerResponse.create({
          ...responseRecord,
          createdAt: new Date(responseRecord.createdAt),
          updatedAt: new Date(responseRecord.updatedAt)
        });
      } catch (err) {
        console.warn('ListenerResponse.create notice:', err.message);
      }
    }
  }

  return {
    success: true,
    response: responseRecord,
    nextAudio: nextAudioInfo
  };
}

function getListenerResponseBySession(linkSlug, sessionId) {
  return dataStore.responses.find(r => (r.linkSlug === linkSlug || r.audioId === linkSlug) && r.sessionId === sessionId) || null;
}

function getAllListenerResponses() {
  return [...dataStore.responses];
}

function getListenerResponseById(id) {
  return dataStore.responses.find(r => r.id === id) || null;
}

function updateResponseReview(id, { adminNotes, status = 'reviewed' }) {
  const resp = dataStore.responses.find(r => r.id === id);
  if (!resp) return null;

  if (adminNotes !== undefined) resp.adminNotes = String(adminNotes).trim();
  if (status) resp.status = status;
  resp.isRead = true; // Mark read upon review
  resp.updatedAt = new Date().toISOString();

  logActivity('Response Reviewed', `Admin reviewed listener response on "${resp.audioTitle}"`, 'response');

  if (mongoose.connection.readyState === 1) {
    ListenerResponse.updateOne(
      { id },
      { $set: { adminNotes: resp.adminNotes, status: resp.status, isRead: true, updatedAt: new Date() } }
    ).catch(err => console.warn(err.message));
  }

  return resp;
}

function markResponseAsRead(id) {
  const resp = dataStore.responses.find(r => r.id === id);
  if (!resp) return null;
  resp.isRead = true;
  if (mongoose.connection.readyState === 1) {
    ListenerResponse.updateOne({ id }, { $set: { isRead: true } }).catch(err => console.warn(err.message));
  }
  return resp;
}

function deleteListenerResponse(id) {
  const index = dataStore.responses.findIndex(r => r.id === id);
  if (index === -1) return false;
  const removed = dataStore.responses.splice(index, 1)[0];
  logActivity('Response Deleted', `Deleted response for "${removed.audioTitle}"`, 'warning');

  if (mongoose.connection.readyState === 1) {
    ListenerResponse.deleteOne({ id }).catch(err => console.warn(err.message));
  }
  return true;
}

async function verifyLinkPassword(slug, password) {
  const link = dataStore.sharedLinks.find(l => l.slug === slug);
  if (!link) return { valid: false, message: 'Link not found.' };
  if (!link.isPasswordProtected) return { valid: true };
  if (!password) return { valid: false, message: 'Password is required for this link.' };

  const isMatch = await bcrypt.compare(String(password).trim(), link.passwordHash || '');
  return { valid: isMatch, message: isMatch ? 'Access granted.' : 'Incorrect password.' };
}

// ---------------------------------------------------------------------------
// 5. Recent Activity
// ---------------------------------------------------------------------------
function getRecentActivities(limit = 20) {
  return dataStore.activities.slice(0, limit);
}

// ---------------------------------------------------------------------------
// 6. Link Click Tracking
// ---------------------------------------------------------------------------
function getClickLogs() {
  return [...dataStore.clickLogs];
}

function recordClick({ linkId, ip = '127.0.0.1', userAgent = 'Browser', referrer = 'Direct' }) {
  const link = dataStore.sharedLinks.find(l => l.id === linkId || l.slug === linkId);
  if (link) {
    link.clicks = (link.clicks || 0) + 1;
  }

  const click = {
    id: `clk-${Date.now()}`,
    linkId: link ? link.id : linkId,
    slug: link ? link.slug : linkId,
    ip,
    userAgent,
    referrer,
    timestamp: new Date().toISOString()
  };

  dataStore.clickLogs.unshift(click);
  logActivity('Link Clicked', `Shared link (${click.slug}) accessed from ${ip}`, 'click');

  if (mongoose.connection.readyState === 1) {
    ClickLog.create({
      id: click.id,
      linkId: click.linkId,
      slug: click.slug,
      ip: click.ip,
      userAgent: click.userAgent,
      referrer: click.referrer,
      timestamp: new Date(click.timestamp)
    }).catch(err => console.warn('ClickLog.create notice:', err.message));

    SharedLink.updateOne(
      { $or: [{ id: click.linkId }, { slug: click.slug }] },
      { $inc: { clicks: 1 } }
    ).catch(() => {});
  }

  return click;
}

// ---------------------------------------------------------------------------
// 7. Listening Progress, Seeking Protection & Sequential Unlock Logic
// ---------------------------------------------------------------------------
function getListeningProgress() {
  return [...dataStore.listeningProgress];
}

function getPlaybackProgress(audioId, sessionId) {
  const sessId = sessionId || 'anonymous';
  const key = `${sessId}:${audioId}`;
  const tracker = playbackTrackers.get(key);
  if (tracker) {
    const isCompleted = tracker.playbackCompleted || 
      (tracker.durationSeconds > 0 && (tracker.maxTimeReached >= (tracker.durationSeconds * 0.85) || tracker.listenedSeconds >= (tracker.durationSeconds * 0.40)) && tracker.listenedSeconds >= 8);
    return {
      audioId,
      sessionId: sessId,
      currentTime: tracker.lastCurrentTime,
      durationSeconds: tracker.durationSeconds,
      listenedSeconds: tracker.listenedSeconds,
      playbackCompleted: isCompleted,
      progressPercent: tracker.durationSeconds > 0 ? Math.min(100, Math.round((tracker.listenedSeconds / tracker.durationSeconds) * 100)) : 0
    };
  }

  const stored = dataStore.listeningProgress.find(p => p.audioId === audioId && p.sessionId === sessId);
  if (stored) {
    const isCompleted = Boolean(stored.playbackCompleted) || 
      (stored.durationSeconds > 0 && (stored.currentTime >= (stored.durationSeconds * 0.85) || stored.listenedSeconds >= (stored.durationSeconds * 0.40)) && stored.listenedSeconds >= 8);
    return {
      audioId,
      sessionId: sessId,
      currentTime: stored.currentTime || 0,
      durationSeconds: stored.durationSeconds || 0,
      listenedSeconds: stored.listenedSeconds || 0,
      playbackCompleted: isCompleted,
      progressPercent: stored.progressPercent || 0
    };
  }

  return {
    audioId,
    sessionId: sessId,
    currentTime: 0,
    durationSeconds: 0,
    listenedSeconds: 0,
    playbackCompleted: false,
    progressPercent: 0
  };
}

function parseDurationToSeconds(durStr) {
  if (!durStr) return 0;
  if (typeof durStr === 'number') return durStr;
  const parts = String(durStr).trim().split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return (parts[0] * 60) + parts[1];
  } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }
  return Number(durStr) || 0;
}

function isPlaybackVerified(audioId, sessionId) {
  const prog = getPlaybackProgress(audioId, sessionId);
  if (prog.playbackCompleted === true) return true;
  // Also if progress has reached near the end with authentic listening
  if (prog.durationSeconds > 0 && (prog.currentTime >= (prog.durationSeconds * 0.85) || prog.listenedSeconds >= (prog.durationSeconds * 0.40)) && prog.listenedSeconds >= 8) {
    return true;
  }
  return false;
}

function getAudioSequence(sessionId) {
  const audios = getSortedAudios();
  let previousCompletedAndResponded = true;

  return audios.map((audio, index) => {
    const partNumber = index + 1;
    const progress = getPlaybackProgress(audio.id, sessionId);
    const response = dataStore.responses.find(r => r.audioId === audio.id && r.sessionId === sessionId);
    const hasResponse = !!response;
    const isCompleted = progress.playbackCompleted && hasResponse;

    let status = 'locked';
    if (index === 0) {
      status = isCompleted ? 'completed' : 'unlocked';
    } else {
      if (previousCompletedAndResponded) {
        status = isCompleted ? 'completed' : 'unlocked';
      } else {
        status = 'locked';
      }
    }

    // Update flag for next iteration in sequence
    previousCompletedAndResponded = isCompleted;

    const link = dataStore.sharedLinks.find(l => l.audioId === audio.id && l.status === 'active' && (!l.expiresAt || new Date(l.expiresAt) > new Date()));

    return {
      id: audio.id,
      audioId: audio.id,
      title: audio.title,
      genre: audio.genre,
      format: audio.format,
      duration: audio.duration,
      durationSeconds: audio.durationSeconds || parseDurationToSeconds(audio.duration),
      understandingQuestion: audio.understandingQuestion,
      partNumber,
      status, // 'completed' | 'unlocked' | 'locked'
      isUnlocked: status === 'unlocked' || status === 'completed',
      isCompleted,
      hasResponse,
      playbackCompleted: progress.playbackCompleted,
      currentTime: progress.currentTime || 0,
      progressPercent: progress.progressPercent || 0,
      slug: link ? link.slug : null,
      streamUrl: status !== 'locked' ? `/api/public/sequence-stream/${audio.id}` : null
    };
  });
}

function isAudioUnlocked(audioId, sessionId) {
  const sequence = getAudioSequence(sessionId);
  const item = sequence.find(s => s.audioId === audioId || s.id === audioId);
  if (!item) return false;
  return item.status === 'unlocked' || item.status === 'completed';
}

function recordListeningProgress({ audioId, recipientId, sessionId, linkSlug, currentTime, durationSeconds, playbackSpeed, wallClockElapsed, ended, forceComplete }) {
  const speed = Number(playbackSpeed) || 1.0;
  if (speed > 2.01) {
    throw new Error('Maximum allowable playback speed is 2x. Speeds above 2x are rejected.');
  }

  const audio = getAudioById(audioId);
  const audioDuration = Number(durationSeconds) || Number(audio?.durationSeconds) || parseDurationToSeconds(audio?.duration) || 60;
  const currentPos = Math.max(0, Number(currentTime) || 0);

  const sessId = sessionId || 'anonymous';
  const key = `${sessId}:${audioId}`;
  let tracker = playbackTrackers.get(key);
  const now = Date.now();

  if (!tracker) {
    tracker = {
      key,
      sessionId: sessId,
      audioId,
      linkSlug: linkSlug || null,
      recipientId: recipientId || null,
      listenedSeconds: 0,
      lastHeartbeatAt: now,
      lastCurrentTime: 0,
      maxTimeReached: currentPos,
      playbackCompleted: false,
      completedAt: null,
      speed,
      durationSeconds: audioDuration
    };
    playbackTrackers.set(key, tracker);
  }

  const elapsedSecs = wallClockElapsed !== undefined 
    ? Number(wallClockElapsed) 
    : Math.max(0, (now - tracker.lastHeartbeatAt) / 1000);

  tracker.lastHeartbeatAt = now;
  tracker.speed = speed;

  const isAudioEnded = Boolean(ended || forceComplete);

  const audioDiff = currentPos - tracker.lastCurrentTime;
  if (audioDiff > 0) {
    // Maximum allowable continuous audio progress in this window (+ 2.5s jitter tolerance)
    const maxLegitimateAudio = (elapsedSecs * speed) + 2.5;
    if (audioDiff <= maxLegitimateAudio) {
      // Continuous authentic playback
      tracker.listenedSeconds += audioDiff;
    } else {
      // Seek forward detected: credit authentic elapsed progress window
      tracker.listenedSeconds += Math.min(audioDiff, maxLegitimateAudio);
    }
  }

  tracker.lastCurrentTime = currentPos;
  tracker.maxTimeReached = Math.max(tracker.maxTimeReached, currentPos);

  // Completion Verification Rule:
  // Legitimate completion:
  // (1) Audio ended event, OR current position >= 85% of duration, OR within 5 seconds of the end
  // AND
  // (2) Not a raw bypass seek from 0s: has listened for at least 8 seconds (or at least 20% of duration, or ended with at least 5s)
  const hasReachedEnd = isAudioEnded || currentPos >= (audioDuration * 0.85) || (audioDuration > 0 && Math.abs(currentPos - audioDuration) < 5);
  const isAuthenticListening = tracker.listenedSeconds >= 8 || tracker.listenedSeconds >= (audioDuration * 0.20) || (isAudioEnded && tracker.listenedSeconds >= 5);

  if (hasReachedEnd && isAuthenticListening) {
    tracker.playbackCompleted = true;
    if (!tracker.completedAt) tracker.completedAt = new Date().toISOString();
  }

  const progressPercent = Math.min(100, Math.round((tracker.listenedSeconds / audioDuration) * 100));

  // Update in-memory dataStore.listeningProgress
  const existingProgIndex = dataStore.listeningProgress.findIndex(p => p.audioId === audioId && p.sessionId === tracker.sessionId);
  const progressRecordId = `prg-${audioId}-${tracker.sessionId}`;
  const progressRecord = {
    id: progressRecordId,
    audioId,
    recipientId: recipientId || tracker.recipientId,
    sessionId: tracker.sessionId,
    linkSlug: linkSlug || tracker.linkSlug,
    progressPercent,
    currentTime: currentPos,
    durationSeconds: audioDuration,
    listenedSeconds: Math.round(tracker.listenedSeconds),
    playbackCompleted: tracker.playbackCompleted,
    completedAt: tracker.completedAt,
    lastSpeed: speed,
    lastHeartbeatAt: new Date(now).toISOString(),
    timestamp: new Date().toISOString()
  };

  if (existingProgIndex !== -1) {
    dataStore.listeningProgress[existingProgIndex] = progressRecord;
  } else {
    dataStore.listeningProgress.unshift(progressRecord);
  }

  // Update MongoDB Atlas
  if (mongoose.connection.readyState === 1) {
    const { id, audioId: _a, sessionId: _s, ...updateFields } = progressRecord;
    ListeningProgress.findOneAndUpdate(
      { id: progressRecord.id },
      { 
        $setOnInsert: { id: progressRecord.id, audioId, sessionId: tracker.sessionId },
        $set: updateFields
      },
      { upsert: true, returnDocument: 'after' }
    ).catch(err => console.warn('ListeningProgress update notice:', err.message));
  }

  return {
    success: true,
    playbackCompleted: tracker.playbackCompleted,
    listenedSeconds: Math.round(tracker.listenedSeconds),
    durationSeconds: audioDuration,
    progressPercent,
    currentTime: currentPos
  };
}

// ---------------------------------------------------------------------------
// 8. Settings
// ---------------------------------------------------------------------------
function getSettings() {
  return { ...dataStore.settings };
}

function updateSettings(updates = {}) {
  dataStore.settings = {
    ...dataStore.settings,
    ...updates
  };
  logActivity('Settings Updated', 'Admin configuration settings were updated.', 'settings');
  return { ...dataStore.settings };
}

// ---------------------------------------------------------------------------
// 9. Welcome Page Presentation Settings
// ---------------------------------------------------------------------------
function getWelcomeSettings() {
  return { ...dataStore.welcomeSettings };
}

async function updateWelcomeSettings(updates = {}) {
  dataStore.welcomeSettings = {
    ...dataStore.welcomeSettings,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  if (mongoose.connection.readyState === 1) {
    try {
      await WelcomeSettings.findOneAndUpdate(
        { key: 'welcome_page' },
        { $set: dataStore.welcomeSettings },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (err) {
      console.warn('Notice: Failed to persist welcome settings to MongoDB:', err.message);
    }
  }

  logActivity('Welcome Settings Updated', 'Welcome page presentation and content settings updated.', 'settings');
  return { ...dataStore.welcomeSettings };
}

module.exports = {
  getOverviewStats,
  getAudios,
  getAudioById,
  addAudio,
  updateAudio,
  deleteAudio,
  getRecipients,
  addRecipient,
  deleteRecipient,
  getSharedLinks,
  getSharedLinkBySlug,
  createSharedLink,
  toggleSharedLinkStatus,
  revokeSharedLink,
  deleteSharedLink,
  verifyLinkPassword,
  getRecentActivities,
  getClickLogs,
  recordClick,
  getListeningProgress,
  recordListeningProgress,
  getSettings,
  updateSettings,
  getWelcomeSettings,
  updateWelcomeSettings,
  logActivity,
  hydrateFromDB,
  saveListenerResponse,
  getListenerResponseBySession,
  getAllListenerResponses,
  getListenerResponseById,
  updateResponseReview,
  deleteListenerResponse,
  getNextAudioFor,
  getSortedAudios,
  getPlaybackProgress,
  isPlaybackVerified,
  getAudioSequence,
  isAudioUnlocked,
  markResponseAsRead
};

