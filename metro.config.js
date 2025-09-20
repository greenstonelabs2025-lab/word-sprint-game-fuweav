
const { createMetroConfiguration } = require("@expo/metro-config");

/**
 * Clean Metro config for Expo:
 * - No custom reporters or cache stores
 * - No imports from Metro internals
 * - Uses only public @expo/metro-config API
 */
module.exports = createMetroConfiguration(__dirname);
