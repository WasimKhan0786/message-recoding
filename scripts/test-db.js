#!/usr/bin/env node

/**
 * AudioFlow - MongoDB Connection Verification Script
 * Tests connectivity, authentication, and database ping.
 * Credentials are safe and passwords are automatically masked.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { maskMongoUri } = require('../src/config/db');

async function testConnection() {
  console.log('====================================================');
  console.log('🍃 AudioFlow — MongoDB Database Connection Test');
  console.log('====================================================\n');

  const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/audioflow';
  const maskedUri = maskMongoUri(rawUri);

  console.log('Parameters:');
  console.log(`  • Connection URI: ${maskedUri}`);
  console.log(`  • Driver:         Mongoose v${mongoose.version}`);
  console.log('\nAttempting connection to MongoDB...');

  const startTime = Date.now();

  try {
    const conn = await mongoose.connect(rawUri, {
      dbName: process.env.MONGODB_DB_NAME || 'audioflow',
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });

    const elapsedMs = Date.now() - startTime;
    console.log('----------------------------------------------------');
    console.log(`✅ SUCCESS (${elapsedMs}ms)`);
    console.log(`Status:        Connected`);
    console.log(`Host:          ${conn.connection.host}`);
    console.log(`Port:          ${conn.connection.port || 'default'}`);
    console.log(`Database Name: ${conn.connection.name}`);

    // Ping database
    const adminDb = conn.connection.db.admin();
    const pingResult = await adminDb.ping();
    console.log(`Ping Result:   ${pingResult.ok === 1 ? 'OK (Responsive)' : JSON.stringify(pingResult)}`);

    // List collections
    const collections = await conn.connection.db.listCollections().toArray();
    console.log(`Collections:   ${collections.length > 0 ? collections.map(c => c.name).join(', ') : 'None yet (New Database)'}`);

    console.log('====================================================\n');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    console.log('----------------------------------------------------');
    console.error(`❌ CONNECTION FAILED (${elapsedMs}ms)`);
    console.error(`Error:   ${error.message}`);
    console.log('\n💡 Troubleshooting Tips:');
    if (error.message.includes('ECONNREFUSED') || error.message.includes('connect ECONNREFUSED')) {
      console.log('  1. If running locally, make sure your MongoDB service is started (e.g. `mongod` or MongoDB Compass).');
      console.log('  2. If using MongoDB Atlas, check your network access (IP Access List) in the Atlas console.');
      console.log('  3. Update MONGODB_URI in your .env file with your cluster connection string:');
      console.log('     MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/audioflow');
    } else if (error.message.includes('Authentication failed') || error.message.includes('bad auth')) {
      console.log('  1. Please check the username and password in your MONGODB_URI connection string.');
    }
    console.log('====================================================\n');
    process.exit(1);
  }
}

testConnection();
