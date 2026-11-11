const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  group: {
    type: String,
    default: 'General',
    trim: true
  },
  notes: {
    type: String,
    default: '',
    trim: true
  },
  sharedLinksCount: {
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

module.exports = mongoose.models.Recipient || mongoose.model('Recipient', recipientSchema);

