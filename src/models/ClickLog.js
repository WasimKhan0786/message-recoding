const mongoose = require('mongoose');

const clickLogSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  linkId: {
    type: String,
    index: true
  },
  slug: {
    type: String,
    index: true
  },
  ip: {
    type: String,
    default: '127.0.0.1'
  },
  userAgent: {
    type: String,
    default: 'Browser'
  },
  referrer: {
    type: String,
    default: 'Direct'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.models.ClickLog || mongoose.model('ClickLog', clickLogSchema);

