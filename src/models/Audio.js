const mongoose = require('mongoose');

const audioSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  genre: {
    type: String,
    default: 'General',
    trim: true
  },
  format: {
    type: String,
    default: 'MP3 128k',
    trim: true
  },
  duration: {
    type: String,
    default: '00:00'
  },
  durationSeconds: {
    type: Number,
    default: 0
  },
  fileSize: {
    type: String,
    default: ''
  },
  sizeBytes: {
    type: Number,
    default: 0
  },
  s3Key: {
    type: String,
    default: null
  },
  s3Bucket: {
    type: String,
    default: null
  },
  cid: {
    type: String,
    default: null
  },
  originalFilename: {
    type: String,
    default: null
  },
  originalFormat: {
    type: String,
    default: 'MP3'
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  sequenceOrder: {
    type: Number,
    default: 0
  },
  partNumber: {
    type: Number,
    default: 1
  },
  understandingQuestion: {
    type: String,
    default: 'What did you understand from this recording?',
    trim: true
  },
  nextAudioId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    default: 'Ready'
  },
  shareCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.Audio || mongoose.model('Audio', audioSchema);

