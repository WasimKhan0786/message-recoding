const mongoose = require('mongoose');

const sharedLinkSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  slug: {
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
  recipientId: {
    type: String,
    default: null,
    index: true
  },
  notes: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'disabled', 'revoked'],
    default: 'active'
  },
  isPasswordProtected: {
    type: Boolean,
    default: false
  },
  passwordHash: {
    type: String,
    default: null
  },
  clicks: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date,
    default: null // null indicates permanent link
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.SharedLink || mongoose.model('SharedLink', sharedLinkSchema);

