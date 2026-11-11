const mongoose = require('mongoose');

const listenerResponseSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  audioId: {
    type: String,
    required: true,
    index: true
  },
  audioTitle: {
    type: String,
    required: true
  },
  linkSlug: {
    type: String,
    required: true,
    index: true
  },
  linkId: {
    type: String,
    default: null
  },
  recipientId: {
    type: String,
    default: null
  },
  recipientName: {
    type: String,
    default: 'Anonymous Listener'
  },
  recipientEmail: {
    type: String,
    default: ''
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  question: {
    type: String,
    required: true
  },
  responseText: {
    type: String,
    required: true,
    trim: true
  },
  partNumber: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['submitted', 'reviewed'],
    default: 'submitted'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  playbackCompleted: {
    type: Boolean,
    default: true
  },
  unlockedNext: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.ListenerResponse || mongoose.model('ListenerResponse', listenerResponseSchema);

