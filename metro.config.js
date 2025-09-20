
const { createMetroConfiguration } = require("@expo/metro-config");

/**
 * Clean Metro config for Expo:
 * - No custom reporters or cache stores
 * - No imports from Metro internals
 */
module.exports = createMetroConfiguration(__dirname);
