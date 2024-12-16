// test-connection.js
require('dotenv').config();
const mongoose = require('mongoose');

console.log('Testing MongoDB connection...');

// Mask password in connection string for safe logging
const maskedUri = process.env.MONGODB_URI.replace(/:([^:@]{8})[^:@]*@/, ':****@');
console.log('Attempting to connect to:', maskedUri);

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Successfully connected to MongoDB!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Connection error:', err);
        process.exit(1);
    });