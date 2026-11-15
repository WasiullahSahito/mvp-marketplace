// Lets the app import the ONE shared pricing function from ../packages/shared
// (same file the web app and the unit tests use).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const shared = path.resolve(__dirname, '../packages/shared');
config.watchFolders = [shared];
config.resolver.extraNodeModules = { '@marketplace/shared': shared };

module.exports = config;
