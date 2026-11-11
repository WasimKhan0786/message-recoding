const mongoose = require('mongoose');

const listeningProgressSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  audioId: {
    type: String,
    required: true,
    index: true
  },
  recipientId: {
    type: String,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  linkSlug: {
    type: String,
    index: true
  },
  progressPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  currentTime: {
    type: Number,
    default: 0
  },
  durationSeconds: {
    type: Number,
    default: 0
  },
  listenedSeconds: {
    type: Number,
    default: 0
  },
  playbackCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  lastSpeed: {
    type: Number,
    default: 1.0
  },
  lastHeartbeatAt: {
    type: Date,
    default: Date.now
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.ListeningProgress || mongoose.model('ListeningProgress', listeningProgressSchema);
