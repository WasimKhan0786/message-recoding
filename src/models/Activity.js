const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    default: 'info'
  },
  action: {
    type: String,
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);

