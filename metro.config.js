
const { createMetroConfiguration } = require("@expo/metro-config");

/**
 * Minimal, public-only Metro configuration for Expo projects.
 * - No custom cache stores
 * - No resolver hacks
 * - No direct Metro internal imports
 */
module.exports = createMetroConfiguration(__dirname);
