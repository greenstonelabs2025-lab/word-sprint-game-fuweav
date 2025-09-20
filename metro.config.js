const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Remove custom cache configuration that's causing the import error
// Metro will use its default caching mechanism

module.exports = config;
