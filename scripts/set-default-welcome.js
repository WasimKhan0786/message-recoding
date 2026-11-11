const mongoose = require('mongoose');
require('dotenv').config();
const WelcomeSettings = require('../src/models/WelcomeSettings');

async function update() {
  await mongoose.connect(process.env.MONGODB_URI);
  await WelcomeSettings.findOneAndUpdate(
    { key: 'welcome_page' },
    { 
      $set: {
        heading: 'A Message Especially for You',
        description: 'I have something important and personal that I would like to share with you. Please take a moment to read this message before continuing.',
        thankYouMessage: 'Thank you for your time, care, and attentive listening.'
      }
    },
    { upsert: true }
  );
  console.log('Welcome settings updated in MongoDB to user preference');
  await mongoose.disconnect();
}
update();

