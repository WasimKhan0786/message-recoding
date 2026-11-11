const mongoose = require('mongoose');

const welcomeSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'welcome_page'
  },
  enabled: {
    type: Boolean,
    default: true
  },
  heading: {
    type: String,
    default: 'A Message Especially for You'
  },
  description: {
    type: String,
    default: 'I have something important and personal that I would like to share with you. Please take a moment to read this message before continuing.'
  },
  letterBody: {
    type: String,
    default: 'Dear Friend,\n\nI have prepared this personal digital letter and voice recordings especially for you. Some thoughts and feelings are too meaningful to be lost in hasty text messages, so I wanted to speak to you directly in my own voice.\n\nTake your time, read through the words below, and listen when you are in a quiet, comfortable space where you can reflect in peace.\n\nWarmly,\nYour Friend'
  },
  disclaimer: {
    type: String,
    default: 'This space is private and created solely for you. Anything you write in response will be delivered directly and privately to me. Please take your time to listen sequentially.'
  },
  listeningInstructions: {
    type: String,
    default: '1. Find a calm and quiet space.\n2. Headphones are recommended for clear listening.\n3. Recordings are presented in sequence—finish each part and write your reflection to unlock the next chapter.'
  },
  thankYouMessage: {
    type: String,
    default: 'Thank you for your time, care, and attentive listening.'
  },
  imageUrl: {
    type: String,
    default: '/api/public/welcome-image'
  },
  imageKey: {
    type: String,
    default: null
  },
  imageBucket: {
    type: String,
    default: null
  },
  imageContentType: {
    type: String,
    default: 'image/jpeg'
  },
  localFallbackPath: {
    type: String,
    default: null
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.WelcomeSettings || mongoose.model('WelcomeSettings', welcomeSettingsSchema);

